from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User
from app.auth_utils import get_current_user
from app.schemas import SettingsResponse, SettingsUpdate
import json

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=SettingsResponse)
async def get_user_settings(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    settings = {}
    if user.settings:
        try:
            settings = json.loads(user.settings)
        except Exception:
            settings = {}

    return {
        "default_model": settings.get("default_model", "TinyLlama 1.1B Chat (GGUF)"),
        "system_prompt": settings.get("system_prompt", "You are a helpful, respectful, and honest local AI assistant. Always answer as helpfully as possible."),
        "temperature": settings.get("temperature", 0.7),
        "max_tokens": settings.get("max_tokens", 2048),
    }


@router.put("/", response_model=SettingsResponse)
async def update_user_settings(payload: SettingsUpdate, db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.dict()
    user.settings = json.dumps(data)
    db.add(user)
    await db.flush()

    return data
