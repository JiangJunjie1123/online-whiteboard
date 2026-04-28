from pydantic import BaseModel
from typing import Any, Optional


class ShapeStyle(BaseModel):
    strokeColor: str = "#1a1a1a"
    strokeWidth: int = 3
    fillColor: str = "transparent"
    opacity: float = 1
    fontSize: Optional[int] = None


class Shape(BaseModel):
    id: str
    type: str  # brush, rectangle, circle, arrow, text
    points: list[float]
    style: ShapeStyle
    text: Optional[str] = None
    rotation: Optional[float] = None
    userId: Optional[str] = None


class UserInfo(BaseModel):
    id: str
    name: str
    color: str
    cursor: Optional[dict] = None


class RoomState(BaseModel):
    id: str
    users: list[UserInfo]
    shapes: list[Shape]


class ClientMessage(BaseModel):
    type: str  # join_room, operation, cursor_move, request_sync
    roomId: Optional[str] = None
    userName: Optional[str] = None
    role: Optional[str] = None
    shape: Optional[Shape] = None
    action: Optional[str] = None  # draw, delete, clear, update
    position: Optional[dict] = None
    shapeId: Optional[str] = None
