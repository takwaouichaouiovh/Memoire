"""File-backed notification store.

This store is intentionally simple and deterministic for the current phase.
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypedDict


NotificationKind = Literal["info", "success", "warning", "error"]


class NotificationRecord(TypedDict):
    id: str
    user_id: str
    title: str
    message: str
    kind: NotificationKind
    read: bool
    created_at: str
    metadata: dict


_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "notifications.json"
_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_all() -> list[NotificationRecord]:
    if not _STORE_PATH.exists():
        return []
    try:
        with _STORE_PATH.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
        if isinstance(raw, list):
            return raw
        return []
    except (json.JSONDecodeError, OSError):
        return []


def _write_all(items: list[NotificationRecord]) -> None:
    with _STORE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=2)


def create_notification(
    *,
    user_id: str,
    title: str,
    message: str,
    kind: NotificationKind = "info",
    metadata: dict | None = None,
) -> NotificationRecord:
    with _LOCK:
        items = _read_all()
        item: NotificationRecord = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title.strip(),
            "message": message.strip(),
            "kind": kind,
            "read": False,
            "created_at": _now(),
            "metadata": metadata or {},
        }
        items.append(item)
        _write_all(items)
        return item


def list_notifications(user_id: str, *, limit: int = 50) -> list[NotificationRecord]:
    with _LOCK:
        items = [n for n in _read_all() if n["user_id"] == user_id]
    items.sort(key=lambda n: n["created_at"], reverse=True)
    return items[: max(1, min(limit, 200))]


def unread_count(user_id: str) -> int:
    with _LOCK:
        return sum(1 for n in _read_all() if n["user_id"] == user_id and not n.get("read", False))


def mark_read(user_id: str, notification_id: str) -> bool:
    with _LOCK:
        items = _read_all()
        changed = False
        for n in items:
            if n["id"] == notification_id and n["user_id"] == user_id:
                if not n.get("read", False):
                    n["read"] = True
                    changed = True
                break
        if changed:
            _write_all(items)
        return changed


def mark_all_read(user_id: str) -> int:
    with _LOCK:
        items = _read_all()
        changed = 0
        for n in items:
            if n["user_id"] == user_id and not n.get("read", False):
                n["read"] = True
                changed += 1
        if changed:
            _write_all(items)
        return changed


def delete_notification(user_id: str, notification_id: str) -> bool:
    with _LOCK:
        items = _read_all()
        before = len(items)
        items = [n for n in items if not (n["id"] == notification_id and n["user_id"] == user_id)]
        if len(items) != before:
            _write_all(items)
            return True
        return False
