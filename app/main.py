from contextlib import asynccontextmanager
from fastapi import FastAPI
import docker
import logging

# Configure logging to see docker_manager and other debug output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from app.routes import auth, training, datasets, inference, api_keys, conversations, documents
from app.seeder import seed_system_models

# Define the cleanup lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Do nothing, scale-to-zero memory is naturally empty.
    await seed_system_models()
    yield
    # Shutdown: Clean up all dynamic containers spawned by this platform
    try:
        client = docker.from_env()
        containers = client.containers.list(filters={"name": "llama-srv-"})
        for c in containers:
            print(f"SYSTEM: Shutting down orchestrated container {c.name}")
            c.stop() # Because we used remove=True, stopping it permanently deletes it
    except Exception as e:
        print(f"SYSTEM: Docker cleanup failed: {e}")

app = FastAPI(
    title="Self-Hosted AI Platform",
    description="Enterprise-grade local SLM routing platform.",
    version="1.0.0",
    lifespan=lifespan # Attach the lifecycle hook here
)

# Connect routers
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
