import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from sse_starlette.sse import EventSourceResponse

from app.database import get_db, AsyncSessionLocal
from app.models import Message, Model
from app.rag_worker import embedding_model
from app.docker_manager import get_or_start_container
from app.auth_utils import get_current_user

router = APIRouter(prefix="/v1", tags=["API Gateway"])


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


async def prepare_rag_and_messages(request: ChatCompletionRequest, db: AsyncSession) -> list[dict]:
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
            WHERE conversation_id = :conv_id ORDER BY embedding_matrix <=> CAST(:emb AS vector) LIMIT 3
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


async def stream_generator(llama_url: str, payload: dict, conversation_id: int | None):
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

        if conversation_id and full_ai_response:
            async with AsyncSessionLocal() as save_db:
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    payload_content=full_ai_response.strip(),
                )
                save_db.add(assistant_msg)
                await save_db.commit()
    except Exception as e:
        yield {"event": "error", "data": json.dumps({"detail": f"Backend Exception: {str(e)}"})}


@router.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """OpenAI-compatible gateway supporting streaming and non-streaming modes."""

    # Default: use the system tinyllama base model path
    base_path = "storage/models/tinyllama.gguf"
    adapter_path = None

    model_identifier = request.model
    if model_identifier.startswith("model_"):
        model_identifier = model_identifier.removeprefix("model_")

    try:
        model_id = int(model_identifier)
    except ValueError:
        if request.model not in {"tinyllama", "default"}:
            raise HTTPException(status_code=400, detail="Invalid model identifier format.")
    else:
        model_record = await db.get(Model, model_id)

        if not model_record or (
            not model_record.is_base_model and model_record.user_id != user_id
        ):
            raise HTTPException(status_code=404, detail="Model not found or unauthorized access.")

        status_upper = model_record.status.upper()
        if status_upper not in {"READY", "COMPLETED"}:
            raise HTTPException(
                status_code=400,
                detail=f"Model is not ready for inference. Current status: {model_record.status}",
            )

        base_path = model_record.base_model_path
        adapter_path = model_record.adapter_path  # may be None or an HF dir

    # Provision / reuse a llama.cpp Docker container
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

    if request.stream:
        return EventSourceResponse(stream_generator(llama_url, payload, request.conversation_id))

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(llama_url, json=payload)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Downstream inference engine failure: {response.text}",
                )
            response_data = response.json()
            ai_text = (
                response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            )
            if request.conversation_id and ai_text:
                assistant_msg = Message(
                    conversation_id=request.conversation_id,
                    role="assistant",
                    payload_content=ai_text.strip(),
                )
                db.add(assistant_msg)
                await db.commit()
            return response_data
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Downstream engine connection failed: {exc}",
        )
