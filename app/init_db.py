import asyncio
from sqlalchemy import text
from app.database import engine, Base
import app.models  # Ensures models are imported into metadata registry

async def init_models():
    async with engine.begin() as conn:
        # Pre-initialize vector extension inside the connection context
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
        # Clean sync structural build
        print("Initializing isolated local database structures...")
        await conn.run_sync(Base.metadata.create_all)
        print("Database synchronization completed successfully.")

if __name__ == "__main__":
    asyncio.run(init_models())
