"""Auth API — register/login/me."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import (
    AuthUser,
    check_login_allowed,
    create_access_token,
    get_current_user,
    hash_password,
    record_login_failure,
    reset_login_failures,
    validate_password_strength,
    verify_password,
)
from app.notifications_store import create_notification
from app.users_store import create_user, get_user_by_email, touch_last_login

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "po", "viewer"] = "po"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest) -> AuthResponse:
    validate_password_strength(req.password)

    if get_user_by_email(req.email) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = create_user(req.email, hash_password(req.password), role=req.role)
    token = create_access_token(user_id=user["id"], email=user["email"], role=user["role"])

    create_notification(
        user_id=user["id"],
        title="Welcome to POSTIE",
        message="Your account is ready. You can now use protected workspace features.",
        kind="success",
    )

    return AuthResponse(
        access_token=token,
        user=AuthUser(id=user["id"], email=user["email"], role=user["role"]),
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    check_login_allowed(req.email)
    user = get_user_by_email(req.email)
    if user is None or not verify_password(req.password, user["password_hash"]):
        record_login_failure(req.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    reset_login_failures(req.email)
    touch_last_login(user["id"])
    token = create_access_token(user_id=user["id"], email=user["email"], role=user["role"])

    create_notification(
        user_id=user["id"],
        title="Login successful",
        message="You are connected to POSTIE.",
        kind="info",
    )

    return AuthResponse(
        access_token=token,
        user=AuthUser(id=user["id"], email=user["email"], role=user["role"]),
    )


@router.get("/me", response_model=AuthUser)
async def me(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    return user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> dict:
    validate_password_strength(req.new_password)
    record = get_user_by_email(user.email)
    if record is None or not verify_password(req.current_password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    from app.users_store import update_password

    update_password(record["id"], hash_password(req.new_password))
    create_notification(
        user_id=record["id"],
        title="Password changed",
        message="Your password was updated successfully.",
        kind="success",
    )
    return {"changed": True}
