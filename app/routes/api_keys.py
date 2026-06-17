from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import ApiKey
from app.auth_utils import get_current_user, generate_api_key

router = APIRouter(prefix="/api-keys", tags=["Developer Settings"])

@router.post("/")
async def create_api_key(name: str = "My API Key", db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Generates a new key. The plain_text_key is ONLY returned this one time!"""
    raw_key, key_hash, display_prefix = generate_api_key()
    
    new_key = ApiKey(
        user_id=user_id,
        key_hash=key_hash,
        display_prefix=display_prefix,
        name=name
    )
    db.add(new_key)
    await db.commit()
    
    return {
        "message": "Please save this key securely. You will not be able to view it again.",
        "plain_text_key": raw_key,
        "name": name
    }

@router.get("/")
async def list_api_keys(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Returns the safe display prefixes for the dashboard."""
    sql = select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.is_active == True)
    result = await db.execute(sql)
    keys = result.scalars().all()
    
    return [{"id": k.id, "name": k.name, "prefix": k.display_prefix, "created": k.created_at} for k in keys]
