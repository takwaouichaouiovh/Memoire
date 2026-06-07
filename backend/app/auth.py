"""Authentication helpers and FastAPI dependencies."""

from __future__ import annotations

import os
import re
import threading
import time
import warnings
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.users_store import get_user_by_id


JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALG = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "120"))

if JWT_SECRET == "change-me-in-production":
    warnings.warn(
        "JWT_SECRET is using the default insecure value. Set JWT_SECRET env var in production.",
        RuntimeWarning,
        stacklevel=2,
    )

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str
    email: str
    role: Literal["admin", "po", "viewer"]
    exp: int


class AuthUser(BaseModel):
    id: str
    email: str
    role: Literal["admin", "po", "viewer"]


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")


def validate_password_strength(password: str) -> None:
    if not _PASSWORD_RE.match(password or ""):
        raise HTTPException(
            status_code=400,
            detail="Password must be 8-128 chars and contain at least one letter and one digit.",
        )


_LOGIN_ATTEMPTS: dict[str, list[float]] = {}
_LOGIN_LOCK = threading.Lock()
LOGIN_WINDOW_SECONDS = 60
LOGIN_MAX_FAILED = 5


def _prune_attempts(attempts: list[float], now: float) -> list[float]:
    return [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]


def check_login_allowed(identifier: str) -> None:
    now = time.time()
    key = identifier.strip().lower()
    with _LOGIN_LOCK:
        attempts = _prune_attempts(_LOGIN_ATTEMPTS.get(key, []), now)
        _LOGIN_ATTEMPTS[key] = attempts
        if len(attempts) >= LOGIN_MAX_FAILED:
            raise HTTPException(
                status_code=429,
                detail="Too many failed login attempts. Try again in a minute.",
            )


def record_login_failure(identifier: str) -> None:
    key = identifier.strip().lower()
    with _LOGIN_LOCK:
        attempts = _prune_attempts(_LOGIN_ATTEMPTS.get(key, []), time.time())
        attempts.append(time.time())
        _LOGIN_ATTEMPTS[key] = attempts


def reset_login_failures(identifier: str) -> None:
    key = identifier.strip().lower()
    with _LOGIN_LOCK:
        _LOGIN_ATTEMPTS.pop(key, None)


def create_access_token(*, user_id: str, email: str, role: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _decode_token(token: str) -> TokenPayload:
    try:
        raw = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return TokenPayload(**raw)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc


def get_current_user(
    cred: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUser:
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")

    payload = _decode_token(cred.credentials)
    record = get_user_by_id(payload.sub)
    if record is None:
        raise HTTPException(status_code=401, detail="User not found")

    return AuthUser(id=record["id"], email=record["email"], role=record["role"])


def require_role(*allowed: Literal["admin", "po", "viewer"]):
    def _dep(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _dep
