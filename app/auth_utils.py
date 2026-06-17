import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt

import secrets
import hashlib
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import ApiKey

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Fully localized secret parameters
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-localized-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

security = HTTPBearer()

def hash_password(password: str) -> str:
    # Generate salt and hash the password using native bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Verify using native bcrypt directly against the byte strings
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Extracts the JWT from the Authorization header and returns the active User ID."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise ValueError()
        return int(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate secure identity signatures.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
def generate_api_key():
    """Generates a secure random API key and its corresponding SHA-256 hash."""
    raw_key = f"sk-local-{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    display_prefix = raw_key[:12] + "..."
    return raw_key, key_hash, display_prefix

async def get_user_from_smart_token(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
) -> int:
    # Path A: It's an API Key
    if token.startswith("sk-"):
        incoming_hash = hashlib.sha256(token.encode()).hexdigest()
        sql = select(ApiKey).where(ApiKey.key_hash == incoming_hash, ApiKey.is_active == True)
        result = await db.execute(sql)
        api_key_record = result.scalars().first()
        
        if not api_key_record:
            raise HTTPException(status_code=401, detail="Invalid or revoked API Key.")
        return api_key_record.user_id

    # Path B: It's a JWT (Handle it inline cleanly)
    else:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: int = payload.get("sub")
            if user_id is None:
                raise HTTPException(status_code=401, detail="Invalid token payload.")
            return int(user_id)
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Could not validate secure identity signatures.")
