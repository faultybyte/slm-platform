from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ApiKey, ApiKeyUsageLog
from app.auth_utils import get_current_user, generate_api_key

router = APIRouter(prefix="/api-keys", tags=["Developer Settings"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str = Field(default="My API Key", min_length=1, max_length=80)
    token_limit: int | None = Field(
        default=1_000_000,
        ge=1_000,
        description="Maximum total tokens this key may consume. Omit for unlimited.",
    )


class UpdateKeyRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    token_limit: int | None = Field(default=None, ge=1_000)
    is_active: bool | None = None


class KeyRow(BaseModel):
    id: int
    name: str
    prefix: str
    is_active: bool
    token_limit: int | None
    tokens_used: int
    usage_pct: float
    last_used_at: str | None
    created_at: str


class CreateKeyResponse(BaseModel):
    message: str
    plain_text_key: str
    key: KeyRow


# ── Helpers ────────────────────────────────────────────────────────────────────

def _format_key(k: ApiKey) -> KeyRow:
    pct = 0.0
    if k.token_limit and k.token_limit > 0:
        pct = round(min((k.tokens_used or 0) / k.token_limit * 100, 100), 2)
    return KeyRow(
        id=k.id,
        name=k.name or "Unnamed key",
        prefix=k.display_prefix or "sk-local-???...",
        is_active=bool(k.is_active),
        token_limit=k.token_limit,
        tokens_used=k.tokens_used or 0,
        usage_pct=pct,
        last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
        created_at=k.created_at.isoformat() if k.created_at else datetime.now(timezone.utc).isoformat(),
    )


async def _own_key(key_id: int, user_id: int, db: AsyncSession) -> ApiKey:
    key = await db.get(ApiKey, key_id)
    if not key or key.user_id != user_id:
        raise HTTPException(status_code=404, detail="API key not found.")
    return key


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=CreateKeyResponse, status_code=201)
async def create_api_key(
    body: CreateKeyRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    raw_key, key_hash, display_prefix = generate_api_key()
    now = datetime.now(timezone.utc)

    new_key = ApiKey(
        user_id=user_id,
        key_hash=key_hash,
        display_prefix=display_prefix,
        name=body.name,
        token_limit=body.token_limit,
        tokens_used=0,
        is_active=True,
        created_at=now,          # set explicitly so it's never None after refresh
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    return CreateKeyResponse(
        message="Save this key now — it will never be shown again.",
        plain_text_key=raw_key,
        key=_format_key(new_key),
    )


@router.get("/", response_model=list[KeyRow])
async def list_api_keys(
    include_revoked: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    stmt = select(ApiKey).where(ApiKey.user_id == user_id)
    if not include_revoked:
        stmt = stmt.where(ApiKey.is_active == True)
    stmt = stmt.order_by(ApiKey.created_at.desc().nullslast())
    result = await db.execute(stmt)
    keys = result.scalars().all()
    return [_format_key(k) for k in keys]


@router.patch("/{key_id}", response_model=KeyRow)
async def update_api_key(
    key_id: int,
    body: UpdateKeyRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    key = await _own_key(key_id, user_id, db)
    if body.name is not None:
        key.name = body.name
    if body.token_limit is not None:
        key.token_limit = body.token_limit
    if body.is_active is not None:
        key.is_active = body.is_active
    await db.commit()
    await db.refresh(key)
    return _format_key(key)


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    key = await _own_key(key_id, user_id, db)
    key.is_active = False
    await db.commit()


@router.get("/{key_id}/usage", response_model=list[dict])
async def get_key_usage(
    key_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    await _own_key(key_id, user_id, db)
    stmt = (
        select(ApiKeyUsageLog)
        .where(ApiKeyUsageLog.api_key_id == key_id)
        .order_by(ApiKeyUsageLog.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {
            "id":                log.id,
            "model_id":          log.model_id,
            "prompt_tokens":     log.prompt_tokens,
            "completion_tokens": log.completion_tokens,
            "total_tokens":      log.total_tokens,
            "latency_ms":        log.latency_ms,
            "status_code":       log.status_code,
            "pii_blocked":       log.pii_blocked,
            "created_at":        log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]
