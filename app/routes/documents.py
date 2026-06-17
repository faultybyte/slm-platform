import os
import aiofiles
import tempfile
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException
from app.rag_worker import process_document_task

router = APIRouter(prefix="/conversations", tags=["RAG Documents"])

@router.post("/{conversation_id}/documents")
async def upload_document(
    conversation_id: int, 
    file: UploadFile, 
    background_tasks: BackgroundTasks
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    # Create an ephemeral staging file for RAG, entirely separate from training datasets
    fd, file_path = tempfile.mkstemp(suffix=".txt", prefix="rag_")
    os.close(fd) # Close the file descriptor so aiofiles can manage it securely
    
    # Save the file asynchronously to the temporary path
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    # Dispatch the background worker using the ephemeral path
    background_tasks.add_task(process_document_task, conversation_id, file_path)

    return {
        "status": "Accepted", 
        "filename": file.filename, 
        "message": "Document successfully ingested and queued for vectorization."
    }
