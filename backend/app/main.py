import json
import uuid
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .models import Shape, UserInfo, ClientMessage

app = FastAPI(title="Whiteboard Collab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
]

# In-memory store
rooms: dict = {}  # roomId -> { shapes: dict[id->Shape], users: dict[id->UserInfo] }
connections: dict = {}  # connection_id -> { ws: WebSocket, userId: str, roomId: str }


def get_user_color(room_id: str) -> str:
    room = rooms.get(room_id)
    if not room:
        return USER_COLORS[0]
    used_colors = {u.color for u in room["users"].values()}
    for c in USER_COLORS:
        if c not in used_colors:
            return c
    return random.choice(USER_COLORS)


async def broadcast_to_room(room_id: str, message: dict, exclude_conn_id: str = None):
    """Send message to all connections in a room, optionally excluding one."""
    for conn_id, conn in list(connections.items()):
        if conn["roomId"] == room_id and conn_id != exclude_conn_id:
            try:
                await conn["ws"].send_json(message)
            except Exception:
                pass


async def send_to_connection(conn_id: str, message: dict):
    """Send a message to a specific connection."""
    conn = connections.get(conn_id)
    if conn:
        try:
            await conn["ws"].send_json(message)
        except Exception:
            pass


async def handle_join_room(ws: WebSocket, data: ClientMessage, conn_id: str):
    """Handle user joining or creating a room."""
    room_id = data.roomId or str(uuid.uuid4())[:8]
    user_name = data.userName or f"用户{random.randint(100, 999)}"

    if room_id not in rooms:
        rooms[room_id] = {
            "shapes": {},
            "users": {},
        }

    room = rooms[room_id]
    user_color = get_user_color(room_id)
    user_id = str(uuid.uuid4())[:8]

    user_info = UserInfo(id=user_id, name=user_name, color=user_color)
    room["users"][user_id] = user_info

    connections[conn_id] = {"ws": ws, "userId": user_id, "roomId": room_id}

    # Send room state to the new user
    await send_to_connection(conn_id, {
        "type": "room_state",
        "roomId": room_id,
        "userId": user_id,
        "users": [u.model_dump() for u in room["users"].values()],
        "shapes": [s.model_dump() for s in room["shapes"].values()],
    })

    # Broadcast user_joined to other users
    await broadcast_to_room(room_id, {
        "type": "user_joined",
        "user": user_info.model_dump(),
    }, exclude_conn_id=conn_id)


async def handle_operation(ws: WebSocket, data: ClientMessage, conn_id: str):
    """Handle shape operations (draw, delete, clear, update)."""
    conn = connections.get(conn_id)
    if not conn:
        return

    room_id = conn["roomId"]
    room = rooms.get(room_id)
    if not room:
        return

    action = data.action or "draw"

    if action == "draw":
        shape = data.shape
        if shape:
            shape.userId = conn["userId"]
            room["shapes"][shape.id] = shape
            await broadcast_to_room(room_id, {
                "type": "operation",
                "action": "draw",
                "shape": shape.model_dump(),
            }, exclude_conn_id=conn_id)

    elif action == "delete":
        shape_id = data.shapeId
        if shape_id and shape_id in room["shapes"]:
            del room["shapes"][shape_id]
            await broadcast_to_room(room_id, {
                "type": "operation",
                "action": "delete",
                "shapeId": shape_id,
            }, exclude_conn_id=conn_id)

    elif action == "clear":
        room["shapes"].clear()
        await broadcast_to_room(room_id, {
            "type": "operation",
            "action": "clear",
        }, exclude_conn_id=conn_id)

    elif action == "update":
        shape = data.shape
        if shape and shape.id in room["shapes"]:
            room["shapes"][shape.id] = shape
            await broadcast_to_room(room_id, {
                "type": "operation",
                "action": "update",
                "shape": shape.model_dump(),
            }, exclude_conn_id=conn_id)


async def handle_cursor_move(ws: WebSocket, data: ClientMessage, conn_id: str):
    """Handle cursor position updates."""
    conn = connections.get(conn_id)
    if not conn or not data.position:
        return

    room_id = conn["roomId"]
    await broadcast_to_room(room_id, {
        "type": "cursor_update",
        "userId": conn["userId"],
        "position": data.position,
    }, exclude_conn_id=conn_id)


async def handle_request_sync(ws: WebSocket, data: ClientMessage, conn_id: str):
    """Resend full room state to a user."""
    conn = connections.get(conn_id)
    if not conn:
        return
    room_id = conn["roomId"]
    room = rooms.get(room_id)
    if not room:
        return

    await send_to_connection(conn_id, {
        "type": "room_state",
        "roomId": room_id,
        "userId": conn["userId"],
        "users": [u.model_dump() for u in room["users"].values()],
        "shapes": [s.model_dump() for s in room["shapes"].values()],
    })


async def handle_disconnect(conn_id: str):
    """Clean up when a user disconnects."""
    conn = connections.pop(conn_id, None)
    if not conn:
        return

    room_id = conn["roomId"]
    user_id = conn["userId"]
    room = rooms.get(room_id)
    if not room:
        return

    room["users"].pop(user_id, None)

    # Broadcast user_left
    await broadcast_to_room(room_id, {"type": "user_left", "userId": user_id})

    # Clean up empty rooms
    if not room["users"]:
        del rooms[room_id]


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    conn_id = str(uuid.uuid4())

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data_dict = json.loads(raw)
                data = ClientMessage(**data_dict)
            except (json.JSONDecodeError, Exception) as e:
                await ws.send_json({"type": "error", "message": f"Invalid message: {str(e)}"})
                continue

            if data.type == "join_room":
                await handle_join_room(ws, data, conn_id)
            elif data.type == "operation":
                await handle_operation(ws, data, conn_id)
            elif data.type == "cursor_move":
                await handle_cursor_move(ws, data, conn_id)
            elif data.type == "request_sync":
                await handle_request_sync(ws, data, conn_id)
            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {data.type}"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await handle_disconnect(conn_id)
