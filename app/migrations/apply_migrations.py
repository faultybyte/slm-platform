import asyncio
from sqlalchemy import text
from app.database import engine

async def apply():
    async with engine.begin() as conn:
        # Add new columns if they don't exist (Postgres supports IF NOT EXISTS)
        try:
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS base_model_key VARCHAR;"))
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS dataset_id INTEGER;"))
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS worker_pid INTEGER;"))
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;"))
            print("Migrations applied: added base_model_key, dataset_id, worker_pid, pinned")
        except Exception as e:
            print("Migration failed:", e)

if __name__ == '__main__':
    asyncio.run(apply())
