import os
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")

supabase: Optional[Client] = None
if url and key:
    supabase = create_client(url, key)

def get_current_user_from_token(token: str):
    """
    Validates a JWT token using Supabase and returns the user object.
    Returns None if invalid.
    """
    if not supabase or not token:
        return None
        
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            return None
        return res.user
    except Exception as e:
        return None
