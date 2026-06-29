import json
import time
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, update

from sse_starlette.sse import EventSourceResponse

from app.database import get_db, AsyncSessionLocal
from app.models import Message, Model, ApiKey, ApiKeyUsageLog
from app.rag_worker import embedding_model
from app.docker_manager import get_or_start_container
from app.auth_utils import get_current_user, SECRET_KEY, ALGORITHM
from app.pii_scanner import scan_messages

import jwt

router = APIRouter(prefix="/v1", tags=["API Gateway"])
security = HTTPBearer()


# ── Token counter (litellm with graceful fallback) ─────────────────────────────

def _count_tokens(messages: list[dict] | None = None, text: str | None = None) -> int:
    try:
        import litellm
        if messages is not None:
            return litellm.token_counter(model="gpt-3.5-turbo", messages=messages)
        if text is not None:
            return litellm.token_counter(model="gpt-3.5-turbo", text=text)
        return 0
    except Exception:
        # Fallback: ~4 chars per token
        if messages:
            chars = sum(len(str(m.get("content", ""))) for m in messages)
        elif text:
            chars = len(text)
        else:
            return 0
        return max(1, chars // 4)


# ── Dual-auth dependency ───────────────────────────────────────────────────────

@dataclass
class AuthContext:
    user_id: int
    api_key: ApiKey | None = None

    @property
    def is_api_key_auth(self) -> bool:
        return self.api_key is not None


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """
    Accepts either:
      • A Forge JWT  (Authorization: Bearer eyJ...)
      • A Forge API key (Authorization: Bearer sk-local-...)

    API-key path validates: exists, is_active, within token limit.
    JWT path delegates to the existing get_current_user logic.
    """
    token = credentials.credentials

    if token.startswith("sk-local-"):
        # ── API key auth ───────────────────────────────────────────────────
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
        api_key = result.scalar_one_or_none()

        if not api_key:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not api_key.is_active:
            raise HTTPException(status_code=403, detail="This API key has been revoked.")

        if api_key.token_limit is not None:
            used = api_key.tokens_used or 0
            if used >= api_key.token_limit:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Token limit reached ({used}/{api_key.token_limit}). "
                        "Increase the limit or create a new key."
                    ),
                )

        return AuthContext(user_id=api_key.user_id, api_key=api_key)

    else:
        # ── JWT auth (existing playground path — unchanged) ────────────────
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id_str: str = payload.get("sub")
            if user_id_str is None:
                raise ValueError()
            return AuthContext(user_id=int(user_id_str))
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )


# ── Pydantic models ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    system_prompt: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    max_tokens: int = Field(default=512, ge=1, le=4096)
    stream: bool = False
    conversation_id: int | None = None


# ── Helpers (unchanged from original) ─────────────────────────────────────────

async def prepare_rag_and_messages(
    request: ChatCompletionRequest, db: AsyncSession
) -> list[dict]:
    messages_payload = [{"role": m.role, "content": m.content} for m in request.messages]
    base_system = request.system_prompt or "You are a helpful assistant."

    if not request.system_prompt and messages_payload and messages_payload[0]["role"] == "system":
        base_system = messages_payload.pop(0)["content"]

    if request.conversation_id:
        last_user_msg = request.messages[-1].content
        user_msg_db = Message(
            conversation_id=request.conversation_id,
            role="user",
            payload_content=last_user_msg,
        )
        db.add(user_msg_db)
        await db.commit()

        query_vector = list(embedding_model.embed([last_user_msg]))[0].tolist()
        rag_sql = text("""
            SELECT text_chunk FROM document_vectors
            WHERE conversation_id = :conv_id
            ORDER BY embedding_matrix <=> CAST(:emb AS vector) LIMIT 3
        """)
        rag_result = await db.execute(
            rag_sql,
            {"conv_id": request.conversation_id, "emb": str(query_vector)},
        )
        context_chunks = [row[0] for row in rag_result.fetchall()]
        if context_chunks:
            context_str = "\n".join(context_chunks)
            base_system += f"\n\nContext Information:\n{context_str}\n\nUse the context above to answer."

    messages_payload.insert(0, {"role": "system", "content": base_system})
    return messages_payload


async def stream_generator(
    llama_url: str,
    payload: dict,
    conversation_id: int | None,
    auth: AuthContext,
    prompt_tokens: int,
    db_session_factory,
):
    try:
        full_ai_response = ""
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", llama_url, json=payload) as response:
                if response.status_code != 200:
                    yield {
                        "event": "error",
                        "data": json.dumps({"detail": f"Engine error: {response.status_code}"}),
                    }
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            delta = data_json.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                full_ai_response += token
                                yield {"event": "message", "data": json.dumps({"token": token})}
                        except json.JSONDecodeError:
                            continue

        # ── Persist conversation message ───────────────────────────────────
        if conversation_id and full_ai_response:
            async with AsyncSessionLocal() as save_db:
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    payload_content=full_ai_response.strip(),
                )
                save_db.add(assistant_msg)
                await save_db.commit()

        # ── Update API key usage after streaming completes ─────────────────
        if auth.is_api_key_auth and full_ai_response:
            completion_tokens = _count_tokens(text=full_ai_response)
            total = prompt_tokens + completion_tokens
            async with AsyncSessionLocal() as usage_db:
                await usage_db.execute(
                    update(ApiKey)
                    .where(ApiKey.id == auth.api_key.id)
                    .values(
                        tokens_used=ApiKey.tokens_used + total,
                        last_used_at=datetime.now(timezone.utc),
                    )
                )
                usage_db.add(ApiKeyUsageLog(
                    api_key_id=auth.api_key.id,
                    user_id=auth.user_id,
                    model_id=None,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total,
                    latency_ms=None,
                    status_code=200,
                ))
                await usage_db.commit()

    except Exception as e:
        yield {"event": "error", "data": json.dumps({"detail": f"Backend Exception: {str(e)}"})}


# ── Main route ─────────────────────────────────────────────────────────────────

@router.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    OpenAI-compatible gateway.
    Accepts both Forge JWTs (playground) and Forge API keys (programmatic access).

    API key requests additionally go through:
      1. PII scan   — blocks emails, phone numbers, SSNs, credit cards, IPs
      2. Token gate — rejects if key is over its token_limit
      3. Usage log  — records prompt+completion tokens after each request
    """
    user_id = auth.user_id
    messages_dicts = [{"role": m.role, "content": m.content} for m in request.messages]

    # ── API key pre-flight checks ──────────────────────────────────────────
    prompt_tokens = 0
    start_time = 0.0

    if auth.is_api_key_auth:
        # 1. PII scan
        pii = scan_messages(messages_dicts)
        if not pii.is_safe:
            # Log blocked attempt
            db.add(ApiKeyUsageLog(
                api_key_id=auth.api_key.id,
                user_id=user_id,
                model_id=None,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                latency_ms=0,
                status_code=400,
                pii_blocked=True,
            ))
            await db.commit()
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Request blocked: PII detected in prompt "
                    f"({', '.join(pii.detected)}). "
                    "Remove sensitive data before retrying."
                ),
            )

        # 2. Pre-count prompt tokens and check remaining budget
        prompt_tokens = _count_tokens(messages=messages_dicts)
        if auth.api_key.token_limit is not None:
            remaining = auth.api_key.token_limit - (auth.api_key.tokens_used or 0)
            if prompt_tokens > remaining:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Insufficient token budget. "
                        f"Prompt needs ~{prompt_tokens} tokens, "
                        f"but only {remaining} remain."
                    ),
                )

        start_time = time.monotonic()

    # ── Model resolution ───────────────────────────────────────────────────
    # Accepted identifier formats (all returned by GET /v1/models):
    #   1. "model_<id>"   — numeric ID with prefix  (e.g. "model_7")
    #   2. "<int>"        — bare numeric ID          (e.g. "7")
    #   3. display-name slug — lowercased, spaces→"-" (e.g. "tinyllama", "my-hr-model")
    #      This is what /v1/models returns for base models AND is intuitive for users.
    base_path = "storage/models/tinyllama.gguf"
    adapter_path = None
    resolved_model_id = None
    model_record: Model | None = None

    raw_identifier = request.model.strip()

    # Strip "model_" prefix if present
    if raw_identifier.startswith("model_"):
        raw_identifier = raw_identifier.removeprefix("model_")

    # Try numeric ID first
    try:
        model_id_int = int(raw_identifier)
        model_record = await db.get(Model, model_id_int)
    except ValueError:
        # Not numeric — try display-name slug lookup
        # A slug is display_name.lower().replace(" ", "-"), same as /v1/models output
        result = await db.execute(select(Model))
        all_models = result.scalars().all()
        slug = raw_identifier.lower()
        for m in all_models:
            if m.display_name.lower().replace(" ", "-") == slug:
                model_record = m
                break

    if model_record is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Model '{request.model}' not found. "
                "Use GET /v1/models to list available model identifiers."
            ),
        )

    # Ownership check: base models are public; fine-tuned models are user-scoped
    if not model_record.is_base_model and model_record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model not found or unauthorized.")

    if model_record.status.upper() not in {"READY", "COMPLETED"}:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model_record.display_name}' is not ready. Current status: {model_record.status}",
        )

    resolved_model_id = model_record.id
    base_path = model_record.base_model_path
    adapter_path = model_record.adapter_path

    # ── Container provisioning ─────────────────────────────────────────────
    target_port = await get_or_start_container(base_path, adapter_path)
    llama_url = f"http://127.0.0.1:{target_port}/v1/chat/completions"

    processed_messages = await prepare_rag_and_messages(request, db)

    payload = {
        "messages": processed_messages,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "top_p": request.top_p,
        "stream": request.stream,
    }

    # ── Streaming ──────────────────────────────────────────────────────────
    if request.stream:
        return EventSourceResponse(
            stream_generator(
                llama_url,
                payload,
                request.conversation_id,
                auth,
                prompt_tokens,
                AsyncSessionLocal,
            )
        )

    # ── Non-streaming ──────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(llama_url, json=payload)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Downstream inference engine failure: {response.text}",
                )
            response_data = response.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Engine connection failed: {exc}")

    latency_ms = int((time.monotonic() - start_time) * 1000) if auth.is_api_key_auth else 0

    ai_text = (
        response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
    )

    # ── Persist conversation message ───────────────────────────────────────
    if request.conversation_id and ai_text:
        assistant_msg = Message(
            conversation_id=request.conversation_id,
            role="assistant",
            payload_content=ai_text.strip(),
        )
        db.add(assistant_msg)
        await db.commit()

    # ── Update API key token usage ─────────────────────────────────────────
    if auth.is_api_key_auth:
        completion_tokens = _count_tokens(text=ai_text)
        total_tokens = prompt_tokens + completion_tokens

        await db.execute(
            update(ApiKey)
            .where(ApiKey.id == auth.api_key.id)
            .values(
                tokens_used=ApiKey.tokens_used + total_tokens,
                last_used_at=datetime.now(timezone.utc),
            )
        )
        db.add(ApiKeyUsageLog(
            api_key_id=auth.api_key.id,
            user_id=user_id,
            model_id=resolved_model_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            status_code=200,
        ))
        await db.commit()

    return response_data


@router.get("/models")
async def list_models(
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    OpenAI-compatible /v1/models endpoint.
    Returns models accessible to the authenticated user/key.
    """
    result = await db.execute(
        select(Model).where(
            (Model.user_id == auth.user_id) | (Model.is_base_model == True)
        )
    )
    models = result.scalars().all()
    return {
        "object": "list",
        "data": [
            {
                # slug = display_name lowercased with spaces→"-", same format accepted by POST /v1/chat/completions
                "id": m.display_name.lower().replace(" ", "-"),
                "model_id": f"model_{m.id}",
                "object": "model",
                "created": int(m.created_at.timestamp()),
                "owned_by": "forge",
                "display_name": m.display_name,
                "status": m.status,
                "is_base_model": m.is_base_model,
            }
            for m in models
        ],
    }