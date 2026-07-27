import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel

from core.security import supabase

router = APIRouter()
security = HTTPBearer()

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
async def register_user(request: RegisterRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        res = supabase.auth.sign_up({
            "email": request.email, 
            "password": request.password,
            "options": {
                "data": {
                    "name": request.name
                }
            }
        })
        if res.user is None:
            raise HTTPException(status_code=400, detail="Registration failed.")
        return {"ok": True, "message": "Successfully registered!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login_user(request: LoginRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        res = supabase.auth.sign_in_with_password({"email": request.email, "password": request.password})
        if not res.session or not res.user:
            raise HTTPException(status_code=400, detail="Invalid credentials.")
        
        user_data = {
            "id": res.user.id,
            "email": res.user.email,
            "name": res.user.user_metadata.get("name", ""),
            "created_at": str(res.user.created_at)
        }
        
        return {
            "access_token": res.session.access_token,
            "user": user_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid login credentials")

@router.get("/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        token = credentials.credentials
        res = supabase.auth.get_user(token)
        if not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_data = {
            "id": res.user.id,
            "email": res.user.email,
            "name": res.user.user_metadata.get("name", ""),
            "created_at": str(res.user.created_at)
        }
        return user_data
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

class ForgotPasswordRequest(BaseModel):
    email: str

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        supabase.auth.reset_password_email(request.email)
        return {"ok": True, "message": "Password reset link sent to your email."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to send reset link")

class SendOtpRequest(BaseModel):
    email: str

@router.post("/send-otp")
def send_otp(request: SendOtpRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        supabase.auth.sign_in_with_otp({
            "email": request.email,
            "options": {
                "should_create_user": True
            }
        })
        return {"ok": True, "message": "OTP sent to your email."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class VerifyOtpRequest(BaseModel):
    email: str
    token: str

@router.post("/verify-otp")
def verify_otp(request: VerifyOtpRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    try:
        res = supabase.auth.verify_otp({
            "email": request.email,
            "token": request.token,
            "type": "email"
        })
        
        if not res.session or not res.user:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP.")
            
        user_data = {
            "id": res.user.id,
            "email": res.user.email,
            "name": res.user.user_metadata.get("name", request.email.split("@")[0]),
            "created_at": str(res.user.created_at)
        }
        
        return {
            "access_token": res.session.access_token,
            "user": user_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
