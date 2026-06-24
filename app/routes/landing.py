from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import Model

router = APIRouter(prefix="/landing", tags=["Landing"])


@router.get("/", summary="Landing info")
async def landing_info(db: AsyncSession = Depends(get_db)):
    # Basic feature list and quick model listing for the landing page
    features = [
        {"title": "Absolute Privacy", "desc": "Your data never leaves your machine."},
        {"title": "Zero Latency", "desc": "Run models locally for instant responses."},
        {"title": "Model Management", "desc": "Hot-swap models and configure parameters."},
    ]

    result = await db.execute(select(Model).where(Model.is_base_model == True))
    base_models = result.scalars().all()
    models = [
        {"id": m.id, "name": m.display_name, "path": m.base_model_path} for m in base_models
    ]

    return {"features": features, "models": models}
