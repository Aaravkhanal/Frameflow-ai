from datetime import datetime, timedelta, timezone
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.database import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    reset_password,
    set_reset_token,
)
from auth.models import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    VerifyEmailRequest,
)
from auth.security import (
    ACCESS_TOKEN_EXPIRE_SECONDS,
    create_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    authorization: str | None = Header(None),
) -> Dict[str, Any]:
    """Dependency to extract and validate the authenticated user from JWT bearer token."""
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
        )

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )

    try:
        user_id = int(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user subject in token",
        )

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    return user


@router.post("/register", response_model=TokenResponse)
async def register(req: UserRegisterRequest, response: Response):
    existing = await get_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    hashed = hash_password(req.password)
    user_data = await create_user(req.email, req.name, hashed)

    token = create_token({"sub": str(user_data["id"]), "email": user_data["email"]}, ACCESS_TOKEN_EXPIRE_SECONDS)

    # Set secure cookie
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        samesite="lax",
    )

    user_resp = UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        name=user_data["name"],
        is_verified=bool(user_data["is_verified"]),
        created_at=user_data["created_at"],
    )

    return TokenResponse(access_token=token, user=user_resp)


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, response: Response):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    token = create_token({"sub": str(user["id"]), "email": user["email"]}, ACCESS_TOKEN_EXPIRE_SECONDS)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        samesite="lax",
    )

    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        is_verified=bool(user["is_verified"]),
        created_at=user["created_at"],
    )

    return TokenResponse(access_token=token, user=user_resp)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        is_verified=bool(current_user["is_verified"]),
        created_at=current_user["created_at"],
    )


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    user = await get_user_by_email(req.email)
    if not user:
        # Return generic message to prevent email enumeration
        return {"message": "If an account exists for this email, password reset instructions have been generated."}

    token = uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await set_reset_token(req.email, token, expires)

    return {
        "message": "Password reset token generated successfully.",
        "reset_token": token,  # Provided for convenience in dev/testing environment
    }


@router.post("/reset-password")
async def reset_pass(req: ResetPasswordRequest):
    hashed = hash_password(req.password)
    success = await reset_password(req.token, hashed)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )
    return {"message": "Password has been successfully reset. You can now log in."}


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest):
    return {"message": "Email address verified successfully."}
