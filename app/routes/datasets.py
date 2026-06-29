"""
Dataset routes — covers both direct JSONL import and the full 6-layer processing pipeline.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from uuid import uuid4

import aiofiles
import os
from fastapi import (
    APIRouter, Body, Depends, File, Form, HTTPException, Query,
    UploadFile, status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dataset, DatasetPipeline
from app.auth_utils import get_current_user
from app.dataset_processor import (
    run_pipeline, write_jsonl, generate_lora_config,
)

router = APIRouter(prefix="/datasets", tags=["Dataset Management"])

ACCEPTED_EXTENSIONS = {'.jsonl', '.csv', '.xlsx', '.xls', '.pdf', '.txt', '.docx', '.doc', '.json'}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_own_dataset(
    dataset_id: int, user_id: int, db: AsyncSession
) -> tuple[Dataset, DatasetPipeline]:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    result2 = await db.execute(
        select(DatasetPipeline).where(DatasetPipeline.dataset_id == dataset_id)
    )
    pipe = result2.scalar_one_or_none()
    return ds, pipe  # type: ignore[return-value]


def _read_jsonl_page(path: str, page: int, page_size: int) -> tuple[list[dict], int]:
    rows = []
    try:
        with open(path, encoding='utf-8') as f:
            all_rows = [json.loads(line) for line in f if line.strip()]
        total = len(all_rows)
        start = (page - 1) * page_size
        rows = all_rows[start: start + page_size]
        return rows, total
    except Exception:
        return [], 0


def _read_all_jsonl(path: str) -> list[dict]:
    try:
        with open(path, encoding='utf-8') as f:
            return [json.loads(line) for line in f if line.strip()]
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# GET /datasets/   — list all
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_datasets(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(Dataset).where(Dataset.user_id == user_id))
    datasets = result.scalars().all()

    output = []
    for d in datasets:
        result2 = await db.execute(
            select(DatasetPipeline).where(DatasetPipeline.dataset_id == d.id)
        )
        pipe = result2.scalar_one_or_none()
        output.append({
            "id":          d.id,
            "filename":    d.filename,
            "file_path":   d.file_path,
            "row_count":   d.row_count,
            "uploaded_at": d.uploaded_at,
            "pipeline": {
                "pipeline_status":  pipe.pipeline_status,
                "schema_type":      pipe.schema_type,
                "total_rows_raw":   pipe.total_rows_raw,
                "total_rows_clean": pipe.total_rows_clean,
                "rows_removed":     pipe.rows_removed,
                "duplicate_count":  pipe.duplicate_count,
                "dedup_threshold":  pipe.dedup_threshold,
                "chunk_size":       pipe.chunk_size,
                "chunk_overlap":    pipe.chunk_overlap,
            } if pipe else None,
        })
    return output


# ─────────────────────────────────────────────────────────────────────────────
# POST /datasets/process  — upload any format, run pipeline
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/process", status_code=202)
async def process_dataset(
    file: UploadFile = File(...),
    filename: str = Form(...),
    dedup_threshold: float = Form(default=0.85),
    chunk_size: int = Form(default=500),
    chunk_overlap: int = Form(default=50),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Upload any file format; run the 6-layer pipeline; return review-ready summary."""
    original_name = Path(file.filename or "upload").name
    ext = Path(original_name).suffix.lower()
    if ext not in ACCEPTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(sorted(ACCEPTED_EXTENSIONS))}",
        )

    display_name = filename.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Dataset name is required.")

    uid = uuid4().hex
    os.makedirs("storage/datasets/raw",        exist_ok=True)
    os.makedirs("storage/datasets/processed",  exist_ok=True)
    os.makedirs("storage/datasets/quarantine", exist_ok=True)

    raw_path        = f"storage/datasets/raw/user_{user_id}_{uid}{ext}"
    output_path     = f"storage/datasets/processed/user_{user_id}_{uid}.jsonl"
    quarantine_path = f"storage/datasets/quarantine/user_{user_id}_{uid}_quarantine.jsonl"

    # Stream raw file to disk in chunks
    try:
        async with aiofiles.open(raw_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 256)
                if not chunk:
                    break
                await out.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Create placeholder DB records
    new_dataset = Dataset(
        user_id=user_id,
        filename=display_name,
        file_path=output_path,
        row_count=0,
    )
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)

    pipe = DatasetPipeline(
        dataset_id=new_dataset.id,
        pipeline_status="PROCESSING",
        raw_file_path=raw_path,
        output_file_path=output_path,
        quarantine_file_path=quarantine_path,
        dedup_threshold=dedup_threshold,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    db.add(pipe)
    await db.commit()
    await db.refresh(pipe)

    # Run pipeline in thread pool (CPU-bound work)
    try:
        summary = await asyncio.to_thread(
            run_pipeline,
            raw_path, original_name, output_path, quarantine_path,
            dedup_threshold, chunk_size, chunk_overlap,
        )
    except Exception as e:
        await db.execute(
            update(DatasetPipeline)
            .where(DatasetPipeline.id == pipe.id)
            .values(pipeline_status="FAILED", error_message=str(e))
        )
        await db.execute(
            update(Dataset).where(Dataset.id == new_dataset.id).values(row_count=0)
        )
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")

    # Persist results
    await db.execute(
        update(DatasetPipeline)
        .where(DatasetPipeline.id == pipe.id)
        .values(
            pipeline_status="REVIEW",
            schema_type=summary["schema_type"],
            total_rows_raw=summary["total_rows_raw"],
            total_rows_clean=summary["total_rows_clean"],
            rows_removed=summary["rows_removed"],
            duplicate_count=summary["duplicate_count"],
            lora_config=json.dumps(summary["lora_config"]),
            pipeline_logs="\n".join(summary["logs"]),
        )
    )
    await db.execute(
        update(Dataset).where(Dataset.id == new_dataset.id).values(row_count=summary["total_rows_clean"])
    )
    await db.commit()

    return {
        "id":              new_dataset.id,
        "filename":        display_name,
        "pipeline_status": "REVIEW",
        **{k: summary[k] for k in (
            "schema_type", "total_rows_raw", "total_rows_clean",
            "rows_removed", "duplicate_count", "lora_config", "preview_samples", "logs",
        )},
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /datasets/{id}/summary
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/summary")
async def get_summary(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    ds, pipe = await _get_own_dataset(dataset_id, user_id, db)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline record not found.")

    # Random 5-sample preview from live JSONL (reflects edits)
    all_pairs = _read_all_jsonl(pipe.output_file_path or "")
    import random
    preview = random.sample(all_pairs, min(5, len(all_pairs)))

    return {
        "id":               ds.id,
        "filename":         ds.filename,
        "pipeline_status":  pipe.pipeline_status,
        "schema_type":      pipe.schema_type,
        "total_rows_raw":   pipe.total_rows_raw,
        "total_rows_clean": pipe.total_rows_clean,
        "rows_removed":     pipe.rows_removed,
        "duplicate_count":  pipe.duplicate_count,
        "dedup_threshold":  pipe.dedup_threshold,
        "chunk_size":       pipe.chunk_size,
        "chunk_overlap":    pipe.chunk_overlap,
        "lora_config":      json.loads(pipe.lora_config) if pipe.lora_config else None,
        "pipeline_logs":    (pipe.pipeline_logs or "").splitlines(),
        "preview_samples":  preview,
        "row_count":        ds.row_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /datasets/{id}/quarantine   — paginated
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/quarantine")
async def get_quarantine(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    _, pipe = await _get_own_dataset(dataset_id, user_id, db)
    if not pipe or not pipe.quarantine_file_path:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    items, total = _read_jsonl_page(pipe.quarantine_file_path, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ─────────────────────────────────────────────────────────────────────────────
# PUT /datasets/{id}/restore   — move rows from quarantine → main JSONL
# ─────────────────────────────────────────────────────────────────────────────

class RestoreRequest(BaseModel):
    row_ids: List[str]


@router.put("/{dataset_id}/restore")
async def restore_rows(
    dataset_id: int,
    payload: RestoreRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    ds, pipe = await _get_own_dataset(dataset_id, user_id, db)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline record not found.")

    id_set = set(payload.row_ids)

    # Partition quarantine
    qrows = _read_all_jsonl(pipe.quarantine_file_path or "")
    to_restore = [r for r in qrows if r.get("_id") in id_set]
    remaining  = [r for r in qrows if r.get("_id") not in id_set]

    if not to_restore:
        raise HTTPException(status_code=404, detail="None of the requested rows found in quarantine.")

    # Strip rejection_reason and append to main JSONL
    main_rows = _read_all_jsonl(pipe.output_file_path or "")
    for r in to_restore:
        r.pop("rejection_reason", None)
        # Ensure it has a messages key
        if "messages" not in r and "text" in r:
            r["messages"] = [
                {"role": "user",      "content": r["text"]},
                {"role": "assistant", "content": ""},
            ]
        main_rows.append(r)

    # Rewrite both files
    write_jsonl(main_rows, pipe.output_file_path)
    write_jsonl(remaining, pipe.quarantine_file_path)

    new_count = len(main_rows)
    await db.execute(update(Dataset).where(Dataset.id == dataset_id).values(row_count=new_count))
    await db.execute(
        update(DatasetPipeline)
        .where(DatasetPipeline.dataset_id == dataset_id)
        .values(
            total_rows_clean=new_count,
            rows_removed=len(remaining),
            lora_config=json.dumps(generate_lora_config(new_count)),
        )
    )
    await db.commit()

    return {"restored": len(to_restore), "total_rows_clean": new_count}


# ─────────────────────────────────────────────────────────────────────────────
# POST /datasets/{id}/reprocess   — re-run layers 3 & 4 with new params
# ─────────────────────────────────────────────────────────────────────────────

class ReprocessRequest(BaseModel):
    dedup_threshold: float = Field(default=0.85, ge=0.5, le=1.0)
    remove_duplicates: bool = True
    remove_short: bool = True
    chunk_size: int = Field(default=500, ge=100, le=4096)
    chunk_overlap: int = Field(default=50, ge=0, le=500)


@router.post("/{dataset_id}/reprocess")
async def reprocess_dataset(
    dataset_id: int,
    payload: ReprocessRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    ds, pipe = await _get_own_dataset(dataset_id, user_id, db)
    if not pipe or not pipe.raw_file_path:
        raise HTTPException(status_code=400, detail="No raw file available for reprocessing.")

    if not os.path.exists(pipe.raw_file_path):
        raise HTTPException(status_code=400, detail="Raw file no longer on disk.")

    await db.execute(
        update(DatasetPipeline)
        .where(DatasetPipeline.dataset_id == dataset_id)
        .values(pipeline_status="PROCESSING")
    )
    await db.commit()

    original_name = Path(pipe.raw_file_path).name
    # Strip the uuid prefix to get original extension
    ext = Path(pipe.raw_file_path).suffix
    original_name_for_detect = f"file{ext}"

    threshold = payload.dedup_threshold if payload.remove_duplicates else 1.01

    try:
        summary = await asyncio.to_thread(
            run_pipeline,
            pipe.raw_file_path,
            original_name_for_detect,
            pipe.output_file_path,
            pipe.quarantine_file_path,
            threshold,
            payload.chunk_size,
            payload.chunk_overlap,
        )
    except Exception as e:
        await db.execute(
            update(DatasetPipeline)
            .where(DatasetPipeline.dataset_id == dataset_id)
            .values(pipeline_status="FAILED", error_message=str(e))
        )
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Reprocessing failed: {e}")

    await db.execute(
        update(DatasetPipeline)
        .where(DatasetPipeline.dataset_id == dataset_id)
        .values(
            pipeline_status="REVIEW",
            schema_type=summary["schema_type"],
            total_rows_raw=summary["total_rows_raw"],
            total_rows_clean=summary["total_rows_clean"],
            rows_removed=summary["rows_removed"],
            duplicate_count=summary["duplicate_count"],
            dedup_threshold=payload.dedup_threshold,
            chunk_size=payload.chunk_size,
            chunk_overlap=payload.chunk_overlap,
            lora_config=json.dumps(summary["lora_config"]),
            pipeline_logs="\n".join(summary["logs"]),
            error_message=None,
        )
    )
    await db.execute(
        update(Dataset)
        .where(Dataset.id == dataset_id)
        .values(row_count=summary["total_rows_clean"])
    )
    await db.commit()

    return {
        "pipeline_status": "REVIEW",
        **{k: summary[k] for k in (
            "schema_type", "total_rows_raw", "total_rows_clean",
            "rows_removed", "duplicate_count", "lora_config", "preview_samples",
        )},
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUT /datasets/{id}/edit-pair   — inline edit a Q&A pair
# ─────────────────────────────────────────────────────────────────────────────

class EditPairRequest(BaseModel):
    pair_id: str
    user_message: str
    assistant_message: str


@router.put("/{dataset_id}/edit-pair")
async def edit_pair(
    dataset_id: int,
    payload: EditPairRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    _, pipe = await _get_own_dataset(dataset_id, user_id, db)
    if not pipe or not pipe.output_file_path:
        raise HTTPException(status_code=404, detail="Pipeline output not found.")

    rows = _read_all_jsonl(pipe.output_file_path)
    updated = False
    for row in rows:
        if row.get("_id") == payload.pair_id:
            row["messages"] = [
                {"role": "user",      "content": payload.user_message},
                {"role": "assistant", "content": payload.assistant_message},
            ]
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Pair ID not found in dataset.")

    write_jsonl(rows, pipe.output_file_path)
    return {"updated": True, "pair_id": payload.pair_id}



# ─────────────────────────────────────────────────────────────────────────────
# GET /datasets/{id}/download  — stream processed JSONL to client
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),   # ← typed as int, consistent with every other endpoint
):
    dataset, pipe = await _get_own_dataset(dataset_id, user_id, db)  # ← user_id not id
    if not pipe or not pipe.output_file_path:
        raise HTTPException(
            status_code=404,
            detail="Processed file not found. Run the pipeline first.",
        )
    path = pipe.output_file_path
    if not os.path.isfile(path):
        raise HTTPException(
            status_code=404,
            detail=f"File missing on disk: {path}",
        )
    safe_name = dataset.filename.replace(" ", "_") + "_processed.jsonl"
    return FileResponse(
        path=path,
        media_type="application/x-ndjson",
        filename=safe_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /datasets/{id}  (single dataset detail)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    ds, pipe = await _get_own_dataset(dataset_id, user_id, db)
    return {
        "id":          ds.id,
        "filename":    ds.filename,
        "file_path":   ds.file_path,
        "row_count":   ds.row_count,
        "uploaded_at": ds.uploaded_at,
        "pipeline":    {
            "pipeline_status":  pipe.pipeline_status,
            "schema_type":      pipe.schema_type,
            "total_rows_raw":   pipe.total_rows_raw,
            "total_rows_clean": pipe.total_rows_clean,
            "rows_removed":     pipe.rows_removed,
            "duplicate_count":  pipe.duplicate_count,
        } if pipe else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /datasets/{id}
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    ds, pipe = await _get_own_dataset(dataset_id, user_id, db)

    # Remove all associated files
    if pipe:
        for path in [pipe.raw_file_path, pipe.output_file_path, pipe.quarantine_file_path]:
            if path:
                try:
                    Path(path).unlink(missing_ok=True)
                except Exception:
                    pass
    else:
        try:
            Path(ds.file_path).unlink(missing_ok=True)
        except Exception:
            pass

    await db.delete(ds)
    await db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# POST /datasets/  — legacy direct JSONL import (kept for backward compat)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def upload_jsonl_direct(
    file: UploadFile = File(...),
    filename: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Direct JSONL import — bypasses pipeline, marks as COMPLETED immediately."""
    original_name = Path(file.filename or "").name
    if not original_name.lower().endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="Direct import only accepts .jsonl files. Use /datasets/process for other formats.")

    display_name = filename.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Dataset name is required.")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be valid UTF-8.")

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    row_count = 0
    errors = []
    for i, line in enumerate(lines):
        try:
            data = json.loads(line)
            if "messages" not in data:
                errors.append({"line": i + 1, "error": "Missing 'messages' array."})
            else:
                row_count += 1
        except json.JSONDecodeError:
            errors.append({"line": i + 1, "error": "Invalid JSON."})

    if not row_count:
        raise HTTPException(status_code=422, detail="No valid rows found.")
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Malformed JSONL", "errors": errors})

    os.makedirs("storage/datasets/processed", exist_ok=True)
    uid = uuid4().hex
    out_path = f"storage/datasets/processed/user_{user_id}_{uid}.jsonl"
    async with aiofiles.open(out_path, "w", encoding="utf-8") as f:
        await f.write(text)

    ds = Dataset(user_id=user_id, filename=display_name, file_path=out_path, row_count=row_count)
    db.add(ds)
    await db.commit()
    await db.refresh(ds)

    pipe = DatasetPipeline(
        dataset_id=ds.id,
        pipeline_status="COMPLETED",
        schema_type="jsonl_messages",
        total_rows_raw=row_count,
        total_rows_clean=row_count,
        output_file_path=out_path,
        lora_config=json.dumps(generate_lora_config(row_count)),
    )
    db.add(pipe)
    await db.commit()

    return {
        "id":          ds.id,
        "filename":    ds.filename,
        "file_path":   ds.file_path,
        "row_count":   ds.row_count,
        "uploaded_at": ds.uploaded_at,
    }