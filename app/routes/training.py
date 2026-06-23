import os
import sys
import subprocess
import asyncio
import aiofiles
import time
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, update
import psutil
from sse_starlette.sse import EventSourceResponse
from app.database import get_db
from app.models import Model, Dataset
from app.auth_utils import get_current_user
from pathlib import Path
from uuid import uuid4

router = APIRouter(prefix="/models", tags=["Fine-Tuning Architecture"])

SUPPORTED_MODELS = {
    "llama3.2-1b": {
        "hf_id": "meta-llama/Llama-3.2-1B-Instruct",
        "gguf_path": "storage/models/llama3.2-1B.gguf",
        "display_name": "Llama 3.2 1B Instruct",
    },
    "qwen2.5-3b": {
        "hf_id": "Qwen/Qwen2.5-3B-Instruct",
        "gguf_path": "storage/models/Qwen2.5-3B.gguf",
        "display_name": "Qwen 2.5 3B Instruct",
    },
    "deepseek-r1-distill-qwen-1.5b": {
        "hf_id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "gguf_path": "storage/models/Deepseek-R1-Distill-Qwen-1.5B.gguf",
        "display_name": "DeepSeek-R1 Distill Qwen 1.5B",
    },
    "gemma3-1b": {
        "hf_id": "google/gemma-3-1b-it",
        "gguf_path": "storage/models/gemma3-1B.gguf",
        "display_name": "Gemma 3 1B IT",
    },
}

DEFAULT_BASE_MODEL = "llama3.2-1b"


@router.get("/")
async def list_models(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Returns System Base Models + User's Custom Fine-Tunes + User-Uploaded models."""
    sql = select(Model).where(
        or_(Model.user_id == user_id, Model.is_base_model == True)
    ).order_by(Model.id.asc())

    result = await db.execute(sql)
    models = result.scalars().all()

    return [
        {
            "id": m.id,
            "display_name": m.display_name,
            "status": m.status.upper(),
            "base_model_key": getattr(m, "base_model_key", None),
            "dataset_id": getattr(m, "dataset_id", None),
            "is_uploaded": bool(getattr(m, "is_uploaded", False)),
            "is_base_model": m.is_base_model,
            "created_at": m.created_at,
        }
        for m in models
    ]


class RegisterModelRequest(BaseModel):
    display_name: str
    dataset_id: int
    base_model_key: str = "llama3.2-1b"


@router.post("/")
async def register_model(
    payload: RegisterModelRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    base_model_key = payload.base_model_key
    if base_model_key not in SUPPORTED_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported base model. Choose from: {list(SUPPORTED_MODELS.keys())}",
        )

    dataset = await db.get(Dataset, payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
    try:
        if int(dataset.user_id) != int(user_id):
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
    except ValueError:
        if dataset.user_id != user_id:
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")

    new_model = Model(
        user_id=user_id,
        display_name=payload.display_name,
        dataset_id=payload.dataset_id,
        base_model_key=base_model_key,
        base_model_path=SUPPORTED_MODELS[base_model_key]["gguf_path"],
        status="PENDING",
        is_uploaded=False,
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    return {
        "status": "Model Registered",
        "model_id": new_model.id,
        "dataset_path": dataset.file_path,
        "base_model": base_model_key,
    }


@router.post("/upload")
async def upload_model(
    file: UploadFile = File(...),
    display_name: str = Form(...),
    base_model_key: str = Form(default="custom"),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Accepts a user-supplied model file, saves it to disk, and registers it
    in the database. Status is set to READY so it can be used in chat
    immediately; it can also be fine-tuned later via /train.
    """
    original_name = Path(file.filename or "model").name
    ext = Path(original_name).suffix.lower()
    if ext not in {".gguf", ".bin", ".safetensors", ".pt", ".pth"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: .gguf, .bin, .safetensors, .pt, .pth",
        )

    if not display_name.strip():
        raise HTTPException(status_code=400, detail="display_name is required.")

    os.makedirs("storage/uploaded_models", exist_ok=True)
    stored_filename = f"user_{user_id}_{uuid4().hex}{ext}"
    save_path = f"storage/uploaded_models/{stored_filename}"

    # Stream to disk in chunks to handle large model files without OOM
    try:
        with open(save_path, "wb") as f_out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                f_out.write(chunk)
    except Exception as e:
        # Clean up partial file
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Failed to save model file: {e}")

    new_model = Model(
        user_id=user_id,
        display_name=display_name.strip(),
        base_model_key=base_model_key,
        base_model_path=save_path,
        adapter_path=None,
        dataset_id=None,
        status="READY",
        is_base_model=False,
        is_uploaded=True,
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    return {
        "id": new_model.id,
        "display_name": new_model.display_name,
        "status": new_model.status,
        "base_model_key": new_model.base_model_key,
        "is_uploaded": True,
        "is_base_model": False,
        "created_at": new_model.created_at,
    }


class TrainRequest(BaseModel):
    dataset_path: Optional[str] = None
    base_model_key: str = DEFAULT_BASE_MODEL
    # Training hyperparameters — forwarded to the worker
    num_epochs: int = 3
    learning_rate: float = 2e-4
    batch_size: int = 1
    warmup_steps: int = 10
    max_seq_length: int = 512


@router.post("/{model_id}/train")
async def start_training(
    model_id: int,
    payload: TrainRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    model = await db.get(Model, model_id)
    if not model or model.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model registry entry not found.")

    # Allow training from PENDING or FAILED (first run / retry),
    # AND from READY or COMPLETED (retrain on uploaded/completed models).
    if model.status not in ("PENDING", "FAILED", "READY", "COMPLETED"):
        raise HTTPException(
            status_code=400,
            detail=f"Model cannot be trained from its current status: {model.status}",
        )

    # Resolve dataset
    dataset_path = payload.dataset_path
    if not dataset_path:
        if not model.dataset_id:
            raise HTTPException(status_code=400, detail="No dataset provided or registered for this model.")
        dataset = await db.get(Dataset, model.dataset_id)
        if not dataset or dataset.user_id != user_id:
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
        dataset_path = dataset.file_path

    # Resolve base model key — fall back to default if 'custom' or unknown
    base_model_key = payload.base_model_key or model.base_model_key or DEFAULT_BASE_MODEL
    if base_model_key not in SUPPORTED_MODELS:
        base_model_key = DEFAULT_BASE_MODEL
    hf_id = SUPPORTED_MODELS[base_model_key]["hf_id"]

    os.makedirs("storage/logs", exist_ok=True)
    err_log_path = f"storage/logs/worker_sysout_{model_id}.log"
    sysout_file = open(err_log_path, "a")

    # Reset to PENDING so the worker transitions it correctly
    await db.execute(update(Model).where(Model.id == model_id).values(status="PENDING"))
    await db.commit()

    worker_cmd = [
        sys.executable, "-m", "app.training_worker",
        str(model_id),
        dataset_path,
        hf_id,
        str(payload.num_epochs),
        str(payload.learning_rate),
        str(payload.batch_size),
        str(payload.warmup_steps),
        str(payload.max_seq_length),
    ]
    proc = subprocess.Popen(worker_cmd, stdout=sysout_file, stderr=subprocess.STDOUT)

    try:
        await db.execute(update(Model).where(Model.id == model_id).values(worker_pid=proc.pid))
        await db.commit()
    except Exception:
        pass

    return {
        "status": "Processing",
        "message": "Training process spawned successfully.",
        "pid": proc.pid,
    }


@router.post("/{model_id}/stop")
async def stop_training(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model or not model.worker_pid:
        raise HTTPException(status_code=404, detail="Active worker not found for model.")

    try:
        p = psutil.Process(model.worker_pid)
        p.terminate()
        p.wait(timeout=5)
    except psutil.NoSuchProcess:
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop worker: {e}")

    await db.execute(update(Model).where(Model.id == model_id).values(worker_pid=None, status="FAILED"))
    await db.commit()
    return {"status": "Stopped"}


@router.post("/{model_id}/pause")
async def pause_training(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model or not model.worker_pid:
        raise HTTPException(status_code=404, detail="Active worker not found for model.")

    try:
        psutil.Process(model.worker_pid).suspend()
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process already exited.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause worker: {e}")

    await db.execute(update(Model).where(Model.id == model_id).values(status="PAUSED"))
    await db.commit()
    return {"status": "Paused"}


@router.post("/{model_id}/resume")
async def resume_training(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model or not model.worker_pid:
        raise HTTPException(status_code=404, detail="Active worker not found for model.")

    try:
        psutil.Process(model.worker_pid).resume()
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process already exited.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume worker: {e}")

    await db.execute(update(Model).where(Model.id == model_id).values(status="TRAINING"))
    await db.commit()
    return {"status": "Resumed"}


@router.delete("/{model_id}", status_code=204)
async def delete_model(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found.")

    # If a worker is active for this model, try to terminate it first so files
    # can be removed safely and we don't leave orphaned processes.
    try:
        if getattr(model, "worker_pid", None):
            try:
                p = psutil.Process(model.worker_pid)
                p.terminate()
                p.wait(timeout=5)
            except psutil.NoSuchProcess:
                pass
            except Exception:
                # best-effort; continue with delete even if we couldn't stop it
                pass
    except Exception:
        # ignore any attribute/access errors and continue
        pass

    for path in [model.adapter_path, model.base_model_path if model.is_uploaded else None]:
        if path:
            try:
                if os.path.isfile(path):
                    os.remove(path)
                elif os.path.isdir(path):
                    import shutil
                    shutil.rmtree(path, ignore_errors=True)
            except Exception:
                pass

    await db.delete(model)
    await db.commit()


async def log_tailer(log_path: str):
    for _ in range(10):
        if os.path.exists(log_path):
            break
        await asyncio.sleep(0.5)

    if not os.path.exists(log_path):
        yield {"event": "error", "data": "Failed to locate tracking log file on host volume."}
        return

    async with aiofiles.open(log_path, "r") as f:
        while True:
            line = await f.readline()
            if not line:
                await asyncio.sleep(0.3)
                continue

            clean_line = line.strip()
            if clean_line == "JOB_FINISHED":
                yield {"event": "complete", "data": "Training telemetry stream closed."}
                break

            yield {"event": "log", "data": clean_line}


@router.get("/{model_id}/logs/stream")
async def stream_training_logs(model_id: int, user_id: int = Depends(get_current_user)):
    log_path = f"storage/logs/training_{model_id}.log"
    return EventSourceResponse(log_tailer(log_path))


@router.get("/{model_id}/logs")
async def get_historical_model_logs(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    model_record = await db.get(Model, model_id)
    if not model_record or model_record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model target logs not found.")

    log_file_path = f"storage/logs/training_{model_id}.log"
    if not os.path.exists(log_file_path):
        return {"logs": f"Status: {model_record.status}. Log buffer is empty."}

    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            log_data = f.read()
        return {"model_id": model_id, "status": model_record.status, "logs": log_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")