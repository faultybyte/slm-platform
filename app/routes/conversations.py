# app/routes/conversations.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
from pydantic import BaseModel
from app.models import Message # Assuming Message tracks conversation_id and user_id via relationships
from app.auth_utils import get_current_user
from app.models import Conversation
from sqlalchemy import delete

router = APIRouter(prefix="/conversations", tags=["Workspace Conversations"])

@router.get("/")
async def list_conversations(
    db: AsyncSession = Depends(get_db), 
    user_id: int = Depends(get_current_user)
):
    """Lists distinct active multi-turn chat sessions to populate the left sidebar, filtered by user."""
    # Fetch only conversations belonging to the current user, ordered by pinned first, then by creation date
    sql = select(Conversation).where(Conversation.user_id == user_id).order_by(
        Conversation.pinned.desc(), Conversation.created_at.desc()
    )
    result = await db.execute(sql)
    conversations = result.scalars().all()
    
    return [
        {
            "conversation_id": conv.id,
            "title": conv.session_title or "Untitled Chat",
            "model_id": conv.model_id,
            "pinned": conv.pinned,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.created_at.isoformat()
        }
        for conv in conversations
    ]

@router.get("/{conversation_id}/messages")
async def get_conversation_history(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Hydrates the main canvas layout with complete multi-turn logs when a historical chat is selected."""
    sql = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id.asc())
    result = await db.execute(sql)
    messages = result.scalars().all()
    
    if not messages:
        return []
        
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.payload_content,
            "created_at": msg.created_at
        }
        for msg in messages
    ]


class UpdateConversationRequest(BaseModel):
    title: str | None = None
    pinned: bool | None = None


@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: int,
    request: UpdateConversationRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    # Ensure conversation belongs to user (simple ownership check)
    sql = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(sql)
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Apply updates
    changed = False
    if request.title is not None:
        conv.session_title = request.title
        changed = True
    if request.pinned is not None:
        # store pinned state on the instance; model may be migrated later
        setattr(conv, "pinned", bool(request.pinned))
        changed = True

    if changed:
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

    return {"conversation_id": conv.id, "title": conv.session_title, "pinned": getattr(conv, "pinned", False)}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    # Ensure conversation exists and ownership
    sql = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(sql)
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Delete conversation (cascade will remove messages and related vectors)
    await db.execute(delete(Conversation).where(Conversation.id == conversation_id))
    await db.commit()

    return {"status": "deleted"}

# The expected JSON payload from the frontend
class CreateConversationRequest(BaseModel):
    model_id: int | None = None
    session_title: str = "New Chat"

@router.post("/")
async def create_conversation(
    request: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Initializes a new workspace session and returns the official DB ID."""
    new_conv = Conversation(
        user_id=user_id,
        model_id=request.model_id,
        session_title=request.session_title
    )
    
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv) # Refreshes the object to grab the auto-incremented ID
    
    return {
        "id": new_conv.id, 
        "title": new_conv.session_title, 
        "model_id": new_conv.model_id
    }
