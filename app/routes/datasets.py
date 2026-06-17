import os
import json
import aiofiles
from fastapi import APIRouter, UploadFile, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Dataset
from app.auth_utils import get_current_user

router = APIRouter(prefix="/datasets", tags=["Fine-Tuning Datasets"])

@router.post("/")
async def upload_dataset(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    # 1. Format Enforcement
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Strict format enforcement: Only .jsonl files are permitted."
        )

    valid_rows = 0
    content = await file.read()
    
    try:
        lines = content.decode('utf-8').splitlines()
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be valid UTF-8.")

    # 2. Schema Verification
    for index, line in enumerate(lines):
        if not line.strip():
            continue  # Forgive trailing blank lines at the end of the file
            
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=f"Schema violation at line {index + 1}: Invalid JSON object.")

        if "messages" not in data or not isinstance(data["messages"], list):
            raise HTTPException(status_code=400, detail=f"Schema violation at line {index + 1}: Missing or invalid root 'messages' array.")

        # 3. Role Validation
        for msg in data["messages"]:
            if "role" not in msg or msg["role"] not in ["user", "assistant", "system"]:
                raise HTTPException(status_code=400, detail=f"Role validation failed at line {index + 1}: Actor designation must be 'user', 'assistant', or 'system'.")
            if "content" not in msg or not isinstance(msg["content"], str) or not msg["content"].strip():
                raise HTTPException(status_code=400, detail=f"Content validation failed at line {index + 1}: Content body cannot be empty.")
        
        valid_rows += 1

    if valid_rows == 0:
        raise HTTPException(status_code=400, detail="Dataset cannot be empty.")

    # 4. Error Isolation Cleared: Save to persistent volume
    file_path = os.path.join("storage/datasets", file.filename)
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(content)

    # Register successfully in the database
    new_dataset = Dataset(
        user_id=user_id,
        filename=file.filename,
        file_path=file_path,
        row_count=valid_rows
    )
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)

    return {
        "status": "Verified and Stored",
        "dataset_id": new_dataset.id,
        "row_count": valid_rows
    }
