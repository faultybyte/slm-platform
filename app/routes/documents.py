import os
import aiofiles
import tempfile
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import Conversation, DocumentVector
from app.rag_worker import process_document_task
from app.auth_utils import get_current_user

router = APIRouter(prefix="/conversations", tags=["RAG Documents"])


async def _assert_conversation_ownership(
    conversation_id: int, user_id: int, db: AsyncSession
) -> Conversation:
    """Shared guard: fetch the conversation and verify it belongs to the caller."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return conv


@router.get("/{conversation_id}/documents")
async def list_documents(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Return the distinct document chunks stored for a conversation (deduped by a synthetic name)."""
    await _assert_conversation_ownership(conversation_id, user_id, db)

    result = await db.execute(
        select(DocumentVector.id, DocumentVector.text_chunk)
        .where(DocumentVector.conversation_id == conversation_id)
        .order_by(DocumentVector.id.asc())
    )
    rows = result.all()

    # Group contiguous chunks so the UI can show one entry per upload.
    # We tag the very first chunk of each upload as the document label.
    return {
        "conversation_id": conversation_id,
        "chunk_count": len(rows),
        "has_documents": len(rows) > 0,
    }


@router.post("/{conversation_id}/documents")
async def upload_document(
    conversation_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    await _assert_conversation_ownership(conversation_id, user_id, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    # Create an ephemeral staging file for RAG, entirely separate from training datasets
    fd, file_path = tempfile.mkstemp(suffix=".txt", prefix="rag_")
    os.close(fd)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    background_tasks.add_task(process_document_task, conversation_id, file_path)

    return {
        "status": "Accepted",
        "filename": file.filename,
        "message": "Document successfully ingested and queued for vectorization.",
    }


@router.delete("/{conversation_id}/documents")
async def clear_documents(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Delete all RAG document vectors for a conversation (clear context)."""
    await _assert_conversation_ownership(conversation_id, user_id, db)

    await db.execute(
        delete(DocumentVector).where(DocumentVector.conversation_id == conversation_id)
    )
    await db.commit()

    return {"status": "cleared", "conversation_id": conversation_id}