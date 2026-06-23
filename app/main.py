from contextlib import asynccontextmanager
from fastapi import FastAPI
import docker

from app.routes import auth, training, datasets, inference, api_keys, conversations, documents
from app.seeder import seed_system_models
from app.migrations.apply_migrations import apply as apply_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB migrations then seed base models
    await apply_migrations()
    await seed_system_models()
    yield
    # Shutdown: stop all llama.cpp containers spawned this session
    try:
        client = docker.from_env()
        containers = client.containers.list(filters={"name": "llama-srv-"})
        for c in containers:
            print(f"SYSTEM: Shutting down container {c.name}")
            c.stop()
    except Exception as e:
        print(f"SYSTEM: Docker cleanup failed: {e}")


app = FastAPI(
    title="Self-Hosted AI Platform",
    description="Enterprise-grade local SLM routing platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(inference.router)
app.include_router(documents.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(api_keys.router)
app.include_router(conversations.router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "platform healthy"}
