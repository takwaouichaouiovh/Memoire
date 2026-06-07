"""Tests for auth and notifications APIs (file-backed stores)."""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    monkeypatch.setenv("JWT_SECRET", "test-secret-please-rotate")

    import app.users_store as users_store
    import app.notifications_store as notif_store
    import app.api.admin as admin_api

    monkeypatch.setattr(users_store, "_STORE_PATH", data_dir / "users.json")
    monkeypatch.setattr(notif_store, "_STORE_PATH", data_dir / "notifications.json")
    monkeypatch.setattr(admin_api, "_BACKLOG_PATH", data_dir / "backlog.json")
    monkeypatch.setattr(admin_api, "_SESSIONS_PATH", data_dir / "sessions.json")

    from app import auth as auth_mod
    auth_mod._LOGIN_ATTEMPTS.clear()

    from app.main import app
    return TestClient(app)


def _register(client: TestClient, email: str, password: str = "Secret123", role: str = "po") -> dict:
    res = client.post("/api/auth/register", json={"email": email, "password": password, "role": role})
    assert res.status_code == 200, res.text
    return res.json()


def _auth(headers_token: str) -> dict:
    return {"Authorization": f"Bearer {headers_token}"}


def test_register_login_me(client):
    body = _register(client, "alice@example.com")
    token = body["access_token"]
    assert body["user"]["email"] == "alice@example.com"

    me = client.get("/api/auth/me", headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"

    login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "Secret123"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "po"


def test_password_policy_rejects_weak(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "weak@example.com", "password": "allletters"},
    )
    assert res.status_code == 400


def test_login_invalid_credentials_then_rate_limit(client):
    _register(client, "bob@example.com")
    for _ in range(5):
        bad = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "wrongpwd1"})
        assert bad.status_code == 401
    blocked = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "Secret123"})
    assert blocked.status_code == 429


def test_notifications_protected_and_persisted(client):
    body = _register(client, "carol@example.com")
    token = body["access_token"]
    h = _auth(token)

    anon = client.get("/api/notifications/")
    assert anon.status_code == 401

    listed = client.get("/api/notifications/", headers=h)
    assert listed.status_code == 200
    assert listed.json()["unread_count"] >= 1

    push = client.post(
        "/api/notifications/",
        headers=h,
        json={"title": "T", "message": "M", "kind": "info"},
    )
    assert push.status_code == 200
    nid = push.json()["id"]

    read = client.patch(f"/api/notifications/{nid}/read", headers=h)
    assert read.status_code == 200

    read_all = client.post("/api/notifications/read-all", headers=h)
    assert read_all.status_code == 200
    assert read_all.json()["unread_count"] == 0


def test_notifications_user_isolation(client):
    a = _register(client, "user-a@example.com")
    b = _register(client, "user-b@example.com")
    headers_a = _auth(a["access_token"])
    headers_b = _auth(b["access_token"])

    client.post(
        "/api/notifications/",
        headers=headers_a,
        json={"title": "A only", "message": "for A", "kind": "info"},
    )
    list_a = client.get("/api/notifications/", headers=headers_a).json()
    list_b = client.get("/api/notifications/", headers=headers_b).json()
    titles_a = [n["title"] for n in list_a["items"]]
    titles_b = [n["title"] for n in list_b["items"]]
    assert "A only" in titles_a
    assert "A only" not in titles_b


def test_rbac_backlog_requires_po(client):
    viewer = _register(client, "viewer@example.com", role="viewer")
    po = _register(client, "po@example.com", role="po")

    payload = {"features": []}
    forbidden = client.put(
        "/api/prioritization/backlog",
        headers=_auth(viewer["access_token"]),
        json=payload,
    )
    assert forbidden.status_code == 403

    ok = client.put(
        "/api/prioritization/backlog",
        headers=_auth(po["access_token"]),
        json=payload,
    )
    assert ok.status_code == 200


def test_rbac_admin_only_reset(client):
    po = _register(client, "po2@example.com", role="po")
    admin = _register(client, "admin@example.com", role="admin")

    blocked = client.post("/api/admin/reset-demo", headers=_auth(po["access_token"]))
    assert blocked.status_code == 403

    ok = client.post("/api/admin/reset-demo", headers=_auth(admin["access_token"]))
    assert ok.status_code == 200
    assert ok.json()["backlog_cleared"] is True


def test_change_password_flow(client):
    body = _register(client, "dave@example.com", password="OrigPwd1")
    token = body["access_token"]

    res = client.post(
        "/api/auth/change-password",
        headers=_auth(token),
        json={"current_password": "wrong", "new_password": "NewPwd1234"},
    )
    assert res.status_code == 401

    res = client.post(
        "/api/auth/change-password",
        headers=_auth(token),
        json={"current_password": "OrigPwd1", "new_password": "tooshort"},
    )
    assert res.status_code == 400

    res = client.post(
        "/api/auth/change-password",
        headers=_auth(token),
        json={"current_password": "OrigPwd1", "new_password": "NewPwd1234"},
    )
    assert res.status_code == 200

    relog = client.post(
        "/api/auth/login",
        json={"email": "dave@example.com", "password": "NewPwd1234"},
    )
    assert relog.status_code == 200
