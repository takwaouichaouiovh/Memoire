"""File-backed users store used by the first auth implementation.

The goal is to provide a production-shaped auth flow quickly without forcing a
full SQL migration in the same sprint.
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypedDict


Role = Literal["admin", "po", "viewer"]


class UserRecord(TypedDict):
    id: str
    email: str
    password_hash: str
    role: Role
    created_at: str
    updated_at: str
    last_login_at: str | None


_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "users.json"
_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_all() -> list[UserRecord]:
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


def _write_all(users: list[UserRecord]) -> None:
    with _STORE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(users, fh, ensure_ascii=False, indent=2)


def list_users() -> list[UserRecord]:
    with _LOCK:
        return _read_all()


def get_user_by_email(email: str) -> UserRecord | None:
    email_l = email.strip().lower()
    with _LOCK:
        users = _read_all()
        return next((u for u in users if u["email"].lower() == email_l), None)


def get_user_by_id(user_id: str) -> UserRecord | None:
    with _LOCK:
        users = _read_all()
        return next((u for u in users if u["id"] == user_id), None)


def create_user(email: str, password_hash: str, role: Role = "po") -> UserRecord:
    email_l = email.strip().lower()
    with _LOCK:
        users = _read_all()
        if any(u["email"].lower() == email_l for u in users):
            raise ValueError(f"User with email {email_l} already exists")

        user: UserRecord = {
            "id": str(uuid.uuid4()),
            "email": email_l,
            "password_hash": password_hash,
            "role": role,
            "created_at": _now(),
            "updated_at": _now(),
            "last_login_at": None,
        }
        users.append(user)
        _write_all(users)
        return user


def touch_last_login(user_id: str) -> None:
    with _LOCK:
        users = _read_all()
        changed = False
        for user in users:
            if user["id"] == user_id:
                now = _now()
                user["last_login_at"] = now
                user["updated_at"] = now
                changed = True
                break
        if changed:
            _write_all(users)


def update_password(user_id: str, password_hash: str) -> bool:
    with _LOCK:
        users = _read_all()
        for user in users:
            if user["id"] == user_id:
                user["password_hash"] = password_hash
                user["updated_at"] = _now()
                _write_all(users)
                return True
        return False
