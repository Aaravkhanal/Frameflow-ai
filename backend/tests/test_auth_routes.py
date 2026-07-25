import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_auth_flow():
    # Register
    email = f"testuser_{pytest.importorskip('uuid').uuid4().hex[:6]}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test User", "password": "password123"},
    )
    assert reg_resp.status_code == 200
    data = reg_resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == email

    token = data["access_token"]

    # Get Current User
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # Login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # Invalid Login
    fail_login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrongpassword"},
    )
    assert fail_login.status_code == 401
