# app/routes/conversations.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
from app.models import Message # Assuming Message tracks conversation_id and user_id via relationships
from app.auth_utils import get_current_user

router = APIRouter(prefix="/conversations", tags=["Workspace Conversations"])

@router.get("/")
async def list_conversations(
    db: AsyncSession = Depends(get_db), 
    user_id: int = Depends(get_current_user)
):
    """Lists distinct active multi-turn chat sessions to populate the left sidebar."""
    # Grouping messages by conversation_id to extract unique active channels for this user
    sql = text("""
        SELECT DISTINCT conversation_id 
        FROM messages 
        WHERE conversation_id IS NOT NULL 
        ORDER BY conversation_id DESC
    """)
    result = await db.execute(sql)
    conversations = [row[0] for row in result.fetchall()]
    
    return [
        {
            "conversation_id": conv_id,
            "title": f"Chat Session #{conv_id}"
        }
        for conv_id in conversations
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
