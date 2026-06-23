from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Model

# Assuming this lives in your training.py or config, import it here
SUPPORTED_MODELS = {
    "llama3.2-1b": {"display_name": "Base: Llama 3.2 1B", "gguf_path": "storage/models/llama3.2-1B.gguf"},
    "deepseek-r1-distill-qwen-1.5b": {"display_name": "Base: Deepseek-R1-Distill-Qwen-1.5B", "gguf_path": "storage/models/Deepseek-R1-Distill-Qwen-1.5B.gguf"},
    "gemma3-1b": {"display_name": "Base: Gemma 3 1B", "gguf_path": "storage/models/gemma3-1B.gguf"},
    "qwen2.5-3b": {"display_name": "Base: Qwen2.5 3B", "gguf_path": "storage/models/Qwen2.5-3B.gguf"},
}

async def seed_system_models():
    """Injects base models into the database as global system resources."""
    async with AsyncSessionLocal() as db:
        for key, config in SUPPORTED_MODELS.items():
            # Check if this exact base model is already registered
            stmt = select(Model).where(
                Model.display_name == config["display_name"], 
                Model.is_base_model == True
            )
            result = await db.execute(stmt)
            existing_model = result.scalars().first()

            if not existing_model:
                system_model = Model(
                    user_id=None, # Owned by the system!
                    display_name=config["display_name"],
                    base_model_path=config["gguf_path"],
                    status="READY", # Base models are instantly ready to chat
                    is_base_model=True
                )
                db.add(system_model)
                print(f"SYSTEM: Registered base model -> {config['display_name']}")
            elif existing_model.status != "READY":
                # Older seeds used lowercase "ready", while the rest of the
                # application uses uppercase status values. Repair those rows
                # on startup so existing installations are upgraded too.
                existing_model.status = "READY"
                
        await db.commit()
