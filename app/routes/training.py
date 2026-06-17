import os
import subprocess
import asyncio
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.database import get_db
from app.models import Model, Dataset
from app.auth_utils import get_current_user

router = APIRouter(prefix="/models", tags=["Fine-Tuning Architecture"])

SUPPORTED_MODELS = {
    "tinyllama": {
        "hf_id": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "gguf_path": "storage/models/tinyllama.gguf"
    },
    "qwen": {
        "hf_id": "Qwen/Qwen1.5-0.5B-Chat",
        "gguf_path": "storage/models/qwen.gguf" # Assuming you download this later
    }
}

@router.post("/")
async def register_model(
    display_name: str,
    dataset_id: int,
    base_model_key: str = "tinyllama", # Default to TinyLlama
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    if base_model_key not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported base model. Choose from: {list(SUPPORTED_MODELS.keys())}")

    dataset = await db.get(Dataset, dataset_id)
    if not dataset or dataset.user_id != user_id:
        raise HTTPException(status_code=404, detail="Dataset not found or unauthorized.")

    new_model = Model(
        user_id=user_id,
        display_name=display_name,
        # Save the specific GGUF path for the selected SLM
        base_model_path=SUPPORTED_MODELS[base_model_key]["gguf_path"], 
        status="PENDING"
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    return {"status": "Model Registered", "model_id": new_model.id, "dataset_path": dataset.file_path, "base_model": base_model_key}

@router.post("/{model_id}/train")
async def start_training(
    model_id: int,
    dataset_path: str,
    base_model_key: str = "tinyllama",
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    model = await db.get(Model, model_id)
    if not model or model.user_id != user_id:
        raise HTTPException(status_code=404, detail="Model registry entry not found.")
    if model.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Model cannot be trained. Current status: {model.status}")

    # Lookup the HuggingFace Repository ID dynamically
    hf_id = SUPPORTED_MODELS[base_model_key]["hf_id"]

    err_log_path = f"storage/logs/worker_sysout_{model_id}.log"
    sysout_file = open(err_log_path, "a")

    # Pass the dynamic HuggingFace ID to the worker as the 4th argument!
    worker_cmd = ["uv", "run", "python", "-m", "app.training_worker", str(model_id), dataset_path, hf_id]
    subprocess.Popen(worker_cmd, stdout=sysout_file, stderr=subprocess.STDOUT)

    return {"status": "Processing", "message": "Isolated training process spawned successfully."}

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
