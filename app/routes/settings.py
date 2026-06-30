from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User
from app.auth_utils import get_current_user, hash_password, verify_password
from app.schemas import SettingsResponse, SettingsUpdate, ChangePasswordRequest
import json

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULTS = {
    "default_model": "llama-3.2-1b-instruct",
    "system_prompt": "You are a helpful, respectful, and honest local AI assistant. Always answer as helpfully as possible.",
    "temperature": 0.7,
    "max_tokens": 2048,
    "top_p": 1.0,
    "context_window": 4096,
    "datasets_root": "storage/datasets",
    "adapters_root": "storage/adapters",
    "uploaded_models_root": "storage/uploaded_models",
    "logs_root": "storage/logs",
    "base_models_root": "storage/models",
    "docker_image": "ghcr.io/ggml-org/llama.cpp:server",
    "docker_healthcheck_timeout": 600,
    "theme": "system",
    "display_name": "",
}


@router.get("/", response_model=SettingsResponse)
async def get_user_settings(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    saved: dict = {}
    if user.settings:
        try:
            saved = json.loads(user.settings)
        except Exception:
            saved = {}

    merged = {**DEFAULTS, **saved}
    merged["email"] = user.email
    return merged


@router.put("/", response_model=SettingsResponse)
async def update_user_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Load existing so we do a merge (don't wipe keys from other sections)
    existing: dict = {}
    if user.settings:
        try:
            existing = json.loads(user.settings)
        except Exception:
            existing = {}

    incoming = payload.dict(exclude_unset=True)
    existing.update(incoming)

    # Update display name on the user record if provided
    if "display_name" in incoming:
        pass  # stored in settings blob; no separate column

    user.settings = json.dumps(existing)
    db.add(user)
    await db.flush()

    merged = {**DEFAULTS, **existing}
    merged["email"] = user.email
    return merged


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.hashed_password = hash_password(payload.new_password)
    db.add(user)
    await db.flush()
    return {"ok": True}
