import os
import sys
import subprocess
import asyncio
import aiofiles
import time
from fastapi import APIRouter, Depends, HTTPException, Body, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, update
import psutil
import platform
from sse_starlette.sse import EventSourceResponse
from app.database import get_db
from app.models import Model, Dataset
from app.auth_utils import get_current_user

router = APIRouter(prefix="/models", tags=["Fine-Tuning Architecture"])

SUPPORTED_MODELS = {
    "llama3.2-1b": {
        "hf_id": "meta-llama/Llama-3.2-1B-Instruct",   # full weights, not GGUF
        "gguf_path": "storage/models/llama3.2-1B.gguf"
    },
    "qwen2.5-3b": {
        "hf_id": "Qwen/Qwen2.5-3B-Instruct",
        "gguf_path": "storage/models/Qwen2.5-3B.gguf"
    },
    "deepseek-r1-distill-qwen-1.5b": {
        "hf_id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "gguf_path": "storage/models/Deepseek-R1-Distill-Qwen-1.5B.gguf"
    },
    "gemma3-1b": {
        "hf_id": "google/gemma-3-1b-it",
        "gguf_path": "storage/models/gemma3-1B.gguf"
    },
    "tinyllama": {
        "hf_id": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",  # good for testing, no auth needed
        "gguf_path": "storage/models/tinyllama.gguf"
    }
}

@router.get("/")
async def list_models(db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    """Returns System Base Models + User's Custom Fine-Tunes."""
    
    # Give me models where user_id is mine OR where it's a system base model
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
            "is_uploaded": bool(getattr(m, "adapter_path", None)),
            "is_base_model": m.is_base_model,
            "created_at": m.created_at
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
    user_id: int = Depends(get_current_user)
):
    base_model_key = payload.base_model_key
    if base_model_key not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported base model. Choose from: {list(SUPPORTED_MODELS.keys())}")

    dataset = await db.get(Dataset, payload.dataset_id)

    # Ensure ownership check is robust to possible type differences
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
    try:
        if int(dataset.user_id) != int(user_id):
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
    except ValueError:
        # If casting fails, fallback to direct comparison
        if dataset.user_id != user_id:
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")

    new_model = Model(
        user_id=user_id,
        display_name=payload.display_name,
        dataset_id=payload.dataset_id,
        base_model_key=base_model_key,
        # Save the specific GGUF path for the selected SLM
        base_model_path=SUPPORTED_MODELS[base_model_key]["gguf_path"],
        status="PENDING",
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    return {"status": "Model Registered", "model_id": new_model.id, "dataset_path": dataset.file_path, "base_model": base_model_key}

class TrainRequest(BaseModel):
    # Allow dataset_path to be optional; if omitted, server will resolve
    # the path from the registered model.dataset_id stored in the DB.
    dataset_path: Optional[str] = None
    base_model_key: str = "llama3.2-1b"


@router.post("/{model_id}/train")
async def start_training(
    model_id: int,
    payload: TrainRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    model = await db.get(Model, model_id)
    if not model or model.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model registry entry not found.")
    if model.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Model cannot be trained. Current status: {model.status}")

    # Determine dataset path: prefer client-provided, else resolve from model registry
    dataset_path = payload.dataset_path
    if not dataset_path:
        # model.dataset_id should reference a Dataset row
        if not model.dataset_id:
            raise HTTPException(status_code=400, detail="No dataset provided or registered for this model.")
        dataset = await db.get(Dataset, model.dataset_id)
        if not dataset or dataset.user_id != user_id:
            raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")
        dataset_path = dataset.file_path

    # Lookup the HuggingFace Repository ID dynamically
    hf_id = SUPPORTED_MODELS[payload.base_model_key]["hf_id"]

    err_log_path = f"storage/logs/worker_sysout_{model_id}.log"
    os.makedirs("storage/logs", exist_ok=True)
    sysout_file = open(err_log_path, "a")

    # Pass the dynamic HuggingFace ID to the worker as the 3rd argument
    # Note: invoking via python ensures the module runs in a clean process
    worker_cmd = [sys.executable, "-m", "app.training_worker", str(model_id), dataset_path, hf_id]
    proc = subprocess.Popen(worker_cmd, stdout=sysout_file, stderr=subprocess.STDOUT)

    # Persist the worker pid on the model record so we can control it later
    try:
        await db.execute(update(Model).where(Model.id == model_id).values(worker_pid=proc.pid))
        await db.commit()
    except Exception:
        pass

    return {"status": "Processing", "message": "Isolated training process spawned successfully.", "pid": proc.pid}


@router.post("/{model_id}/stop")
async def stop_training(model_id: int, db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
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
        raise HTTPException(status_code=500, detail=f"Failed to stop worker: {str(e)}")

    await db.execute(update(Model).where(Model.id == model_id).values(worker_pid=None, status="FAILED"))
    await db.commit()
    return {"status": "Stopped"}


@router.post("/{model_id}/pause")
async def pause_training(model_id: int, db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model or not model.worker_pid:
        raise HTTPException(status_code=404, detail="Active worker not found for model.")

    try:
        p = psutil.Process(model.worker_pid)
        # Use suspend on all platforms via psutil
        p.suspend()
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process already exited.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause worker: {str(e)}")

    await db.execute(update(Model).where(Model.id == model_id).values(status="PAUSED"))
    await db.commit()
    return {"status": "Paused"}


@router.post("/{model_id}/resume")
async def resume_training(model_id: int, db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user)):
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model or not model.worker_pid:
        raise HTTPException(status_code=404, detail="Active worker not found for model.")

    try:
        p = psutil.Process(model.worker_pid)
        p.resume()
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process already exited.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume worker: {str(e)}")

    await db.execute(update(Model).where(Model.id == model_id).values(status="TRAINING"))
    await db.commit()
    return {"status": "Resumed"}


@router.delete("/{model_id}", status_code=204)
async def delete_model(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Deletes a user-owned model and associated adapter file if present."""
    result = await db.execute(select(Model).where(Model.id == model_id, Model.user_id == user_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found.")

    # Remove adapter file if exists
    try:
        if model.adapter_path and os.path.exists(model.adapter_path):
            os.remove(model.adapter_path)
    except Exception:
        pass

    await db.delete(model)
    await db.commit()

async def log_tailer(log_path: str):
    """Watches the log file and yields new lines as they are written by the worker."""
    # Wait up to 5 seconds for the worker to physically create the file
    for _ in range(10):
        if os.path.exists(log_path):
            break
        await asyncio.sleep(0.5)
        
    if not os.path.exists(log_path):
        yield {"event": "error", "data": "Failed to locate tracking log file on host volume."}
        return

    async with aiofiles.open(log_path, 'r') as f:
        while True:
            line = await f.readline()
            if not line:
                # No new line yet, wait and check again
                await asyncio.sleep(0.3)
                continue
            
            clean_line = line.strip()
            if clean_line == "JOB_FINISHED":
                yield {"event": "complete", "data": "Training telemetry stream closed."}
                break
                
            yield {"event": "log", "data": clean_line}

@router.get("/{model_id}/logs/stream")
async def stream_training_logs(
    model_id: int,
    user_id: int = Depends(get_current_user)
):
    """Opens a Server-Sent Events (SSE) stream to push live training telemetry."""
    log_path = f"storage/logs/training_{model_id}.log"
    return EventSourceResponse(log_tailer(log_path))

@router.get("/{model_id}/logs")
async def get_historical_model_logs(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    """Fetches non-streaming historical log text blocks for completed/failed runs."""
    model_record = await db.get(Model, model_id)
    
    if not model_record or model_record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model target logs not found.")
        
    log_file_path = f"storage/logs/train_model_{model_id}.log"
    
    if not os.path.exists(log_file_path):
        return {"logs": f"Status: {model_record.status}. Initialization log buffer is empty."}
        
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            log_data = f.read()
        return {"model_id": model_id, "status": model_record.status, "logs": log_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract log context: {str(e)}")
