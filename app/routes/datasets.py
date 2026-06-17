import os
import json
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Dataset
from app.auth_utils import get_current_user

router = APIRouter(prefix="/datasets", tags=["Dataset Management"])

@router.post("/")
async def upload_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Uploads, validates, and registers a fine-tuning dataset."""
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="Only .jsonl files are accepted.")

    # 1. Read the file into memory for synchronous validation
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be valid UTF-8 encoded text.")

    lines = text_content.splitlines()
    malformed_rows = []

    # 2. Validate structural compliance line-by-line
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        try:
            data = json.loads(line)
            
            # Check for OpenAI Chat format compliance
            if "messages" not in data or not isinstance(data["messages"], list):
                malformed_rows.append({"line": i + 1, "error": "Missing or invalid 'messages' array."})
                continue
                
            for msg in data["messages"]:
                if "role" not in msg or "content" not in msg:
                    malformed_rows.append({"line": i + 1, "error": "A message is missing 'role' or 'content'."})
                    break
                    
        except json.JSONDecodeError:
            malformed_rows.append({"line": i + 1, "error": "Invalid JSON syntax."})

    # 3. Halt Execution and Return 422 if malformed
    if malformed_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Malformed JSONL dataset", "errors": malformed_rows}
        )

    # 4. Save to Disk safely now that it is validated
    os.makedirs("storage/datasets", exist_ok=True)
    file_path = f"storage/datasets/user_{user_id}_{file.filename}"
    
    async with aiofiles.open(file_path, "w", encoding="utf-8") as out_file:
        await out_file.write(text_content)

    # 5. Record in Database
    new_dataset = Dataset(user_id=user_id, file_path=file_path)
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)

    return {"status": "Dataset Registered", "dataset_id": new_dataset.id, "file_path": file_path}

@router.get("/")
async def list_datasets(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Returns a list of all datasets owned by the user."""
    sql = select(Dataset).where(Dataset.user_id == user_id)
    result = await db.execute(sql)
    datasets = result.scalars().all()
    return [{"id": d.id, "file_path": d.file_path, "created_at": d.created_at} for d in datasets]
