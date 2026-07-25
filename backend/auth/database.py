import asyncio
from datetime import datetime, timezone
import os
import sqlite3
from typing import Any, Dict, Optional

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "frameflow.db")


def get_db_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_verified INTEGER DEFAULT 1,
                    reset_token TEXT,
                    reset_token_expires TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
    finally:
        conn.close()


# Initialize database schema immediately on import
init_db()


def _get_user_by_email_sync(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email.strip(),))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _get_user_by_id_sync(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _create_user_sync(email: str, name: str, password_hash: str) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        created_at = datetime.now(timezone.utc).isoformat()
        with conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO users (email, name, password_hash, is_verified, created_at)
                VALUES (?, ?, ?, 1, ?)
                """,
                (email.strip().lower(), name.strip(), password_hash, created_at),
            )
            user_id = cur.lastrowid
        return {
            "id": user_id,
            "email": email.strip().lower(),
            "name": name.strip(),
            "is_verified": True,
            "created_at": created_at,
        }
    finally:
        conn.close()


def _set_reset_token_sync(email: str, token: str, expires_iso: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE lower(email) = lower(?)
                """,
                (token, expires_iso, email.strip()),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def _reset_password_sync(token: str, new_password_hash: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
                WHERE reset_token = ?
                """,
                (new_password_hash, token),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


# Async wrappers for non-blocking FastAPI execution
async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_user_by_email_sync, email)


async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_user_by_id_sync, user_id)


async def create_user(email: str, name: str, password_hash: str) -> Dict[str, Any]:
    return await asyncio.to_thread(_create_user_sync, email, name, password_hash)


async def set_reset_token(email: str, token: str, expires_iso: str) -> bool:
    return await asyncio.to_thread(_set_reset_token_sync, email, token, expires_iso)


async def reset_password(token: str, new_password_hash: str) -> bool:
    return await asyncio.to_thread(_reset_password_sync, token, new_password_hash)
