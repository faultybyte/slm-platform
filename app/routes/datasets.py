import os
import json
from pathlib import Path
from uuid import uuid4
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Dataset
from app.auth_utils import get_current_user

router = APIRouter(prefix="/datasets", tags=["Dataset Management"])

@router.post("/")
async def upload_dataset(
    filename: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Uploads, validates, and registers a fine-tuning dataset."""
    original_filename = Path(file.filename or "").name
    if not original_filename.lower().endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="Only .jsonl files are accepted.")

    display_name = filename.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Dataset name is required.")

    # 1. Read the file into memory for synchronous validation
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be valid UTF-8 encoded text.")

    lines = text_content.splitlines()
    malformed_rows = []
    row_count = 0

    # 2. Validate structural compliance line-by-line
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        row_count += 1
            
        try:
            data = json.loads(line)
            
            # Check for OpenAI Chat format compliance
            if "messages" not in data or not isinstance(data["messages"], list):
                malformed_rows.append({"line": i + 1, "error": "Missing or invalid 'messages' array."})
                continue
                
            for msg in data["messages"]:
                if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                    malformed_rows.append({"line": i + 1, "error": "A message is missing 'role' or 'content'."})
                    break
                    
        except json.JSONDecodeError:
            malformed_rows.append({"line": i + 1, "error": "Invalid JSON syntax."})

    # 3. Halt Execution and Return 422 if malformed
    if not row_count:
        raise HTTPException(status_code=422, detail="Dataset must contain at least one JSONL row.")

    if malformed_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Malformed JSONL dataset", "errors": malformed_rows}
        )

    # 4. Save to Disk safely now that it is validated
    os.makedirs("storage/datasets", exist_ok=True)
    stored_filename = f"user_{user_id}_{uuid4().hex}_{original_filename}"
    file_path = str(Path("storage/datasets") / stored_filename)
    
    async with aiofiles.open(file_path, "w", encoding="utf-8") as out_file:
        await out_file.write(text_content)

    # 5. Record in Database
    new_dataset = Dataset(
        user_id=user_id,
        filename=display_name,
        file_path=file_path,
        row_count=row_count,
    )
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)

    return {
        "id": new_dataset.id,
        "filename": new_dataset.filename,
        "file_path": new_dataset.file_path,
        "row_count": new_dataset.row_count,
        "uploaded_at": new_dataset.uploaded_at,
    }

@router.get("/")
async def list_datasets(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Returns a list of all datasets owned by the user."""
    sql = select(Dataset).where(Dataset.user_id == user_id)
    result = await db.execute(sql)
    datasets = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_path": d.file_path,
            "row_count": d.row_count,
            "uploaded_at": d.uploaded_at,
        }
        for d in datasets
    ]
@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Permanently deletes a dataset owned by the current user."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # Remove file from disk if it exists
    try:
        Path(dataset.file_path).unlink(missing_ok=True)
    except Exception:
        pass  # Don't block DB deletion if file is already gone

    await db.delete(dataset)
    await db.commit()