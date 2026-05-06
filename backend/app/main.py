import json
import uuid
import random
import hashlib
import os
import time
import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .models import Shape, UserInfo, ClientMessage

# ---- Auth helpers ----
JWT_SECRET = 'whiteboard-dev-secret-key-2026'
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY = 7 * 24 * 3600  # 7 days for MVP simplicity

# In-memory user store (temporary, before PostgreSQL)
_users: dict[str, dict] = {}  # email -> {id, email, password_hash, nickname}


def hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ':' + key.hex()


def verify_password(password: str, stored: str) -> bool:
    salt_hex, key_hex = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    expected_key = bytes.fromhex(key_hex)
    new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return new_key == expected_key


def create_token(user_id: str, email: str, nickname: str) -> str:
    now = int(time.time())
    payload = {
        'sub': user_id,
        'email': email,
        'nickname': nickname,
        'iat': now,
        'exp': now + JWT_EXPIRY,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, Exception):
        return None


# Track auth info per WebSocket connection
_auth_info: dict[str, dict] = {}  # conn_id -> {userId, email, nickname}


# ---- Auth Pydantic models ----
class RegisterBody(BaseModel):
    email: str
    password: str
    nickname: str


class LoginBody(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    user_id: str
    token: str
    nickname: str


class UserMeResponse(BaseModel):
    user_id: str
    email: str
    nickname: str


# ---- App ----
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

    # Use auth userId if available, otherwise generate guest ID
    auth = _auth_info.get(conn_id)
    if auth:
        user_id = auth['userId']
        if not data.userName:
            user_name = auth.get('nickname', user_name)
    else:
        user_id = f"anon_{uuid.uuid4().hex[:8]}"

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
    _auth_info.pop(conn_id, None)
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
async def websocket_endpoint(ws: WebSocket, token: str = None):
    await ws.accept()
    conn_id = str(uuid.uuid4())

    # Verify JWT token if provided
    if token:
        payload = verify_token(token)
        if payload:
            _auth_info[conn_id] = {
                'userId': payload['sub'],
                'email': payload.get('email', ''),
                'nickname': payload.get('nickname', ''),
            }

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


# ============================================================
#  Auth REST Endpoints
# ============================================================

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(body: RegisterBody):
    email = body.email.strip().lower()
    nickname = body.nickname.strip()
    password = body.password

    # Validation
    if not email or '@' not in email:
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    if not nickname:
        raise HTTPException(status_code=400, detail="昵称不能为空")
    if len(nickname) > 50:
        raise HTTPException(status_code=400, detail="昵称最长50个字符")

    if email in _users:
        raise HTTPException(status_code=400, detail="该邮箱已注册")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)

    _users[email] = {
        'id': user_id,
        'email': email,
        'password_hash': password_hash,
        'nickname': nickname,
    }

    token = create_token(user_id, email, nickname)
    return AuthResponse(user_id=user_id, token=token, nickname=nickname)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(body: LoginBody):
    email = body.email.strip().lower()
    password = body.password

    user = _users.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not verify_password(password, user['password_hash']):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_token(user['id'], user['email'], user['nickname'])
    return AuthResponse(user_id=user['id'], token=token, nickname=user['nickname'])


@app.get("/api/auth/me", response_model=UserMeResponse)
async def get_me(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证信息")

    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise HTTPException(status_code=401, detail="认证格式错误")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token无效或已过期")

    return UserMeResponse(
        user_id=payload['sub'],
        email=payload.get('email', ''),
        nickname=payload.get('nickname', ''),
    )
