"""Notifications API — persistent in-app notification center."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthUser, get_current_user
from app.notifications_store import (
    create_notification,
    delete_notification,
    list_notifications,
    mark_all_read,
    mark_read,
    unread_count,
)

router = APIRouter()


class NotificationItem(BaseModel):
    id: str
    title: str
    message: str
    kind: Literal["info", "success", "warning", "error"] = "info"
    read: bool = False
    created_at: str
    metadata: dict = Field(default_factory=dict)


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int


class CreateNotificationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=1000)
    kind: Literal["info", "success", "warning", "error"] = "info"
    metadata: dict = Field(default_factory=dict)


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    user: Annotated[AuthUser, Depends(get_current_user)],
    limit: int = 50,
) -> NotificationListResponse:
    items = list_notifications(user.id, limit=limit)
    return NotificationListResponse(
        items=[NotificationItem(**i) for i in items],
        unread_count=unread_count(user.id),
    )


@router.post("/", response_model=NotificationItem)
async def push_notification(
    req: CreateNotificationRequest,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> NotificationItem:
    item = create_notification(
        user_id=user.id,
        title=req.title,
        message=req.message,
        kind=req.kind,
        metadata=req.metadata,
    )
    return NotificationItem(**item)


@router.patch("/{notification_id}/read")
async def set_read(
    notification_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> dict:
    ok = mark_read(user.id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": notification_id, "unread_count": unread_count(user.id)}


@router.post("/read-all")
async def set_read_all(user: Annotated[AuthUser, Depends(get_current_user)]) -> dict:
    changed = mark_all_read(user.id)
    return {"read_count": changed, "unread_count": unread_count(user.id)}


@router.delete("/{notification_id}")
async def remove_notification(
    notification_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> dict:
    ok = delete_notification(user.id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"deleted": notification_id, "unread_count": unread_count(user.id)}
