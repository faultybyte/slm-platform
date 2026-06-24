"""
Run once on startup (or manually) to add new columns without dropping tables.
Safe to run multiple times — each ALTER TABLE is guarded by a column existence check.
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def apply():
    async with AsyncSessionLocal() as db:
        # Add is_uploaded column if it doesn't exist yet
        await db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='models' AND column_name='is_uploaded'
                ) THEN
                    ALTER TABLE models ADD COLUMN is_uploaded BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END$$;
        """))
        await db.commit()
        print("MIGRATION: is_uploaded column ensured on models table.")
        # Add settings column on users table to store serialized user preferences
        await db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='users' AND column_name='settings'
                ) THEN
                    ALTER TABLE users ADD COLUMN settings TEXT;
                END IF;
            END$$;
        """))
        await db.commit()
        print("MIGRATION: settings column ensured on users table.")


if __name__ == "__main__":
    asyncio.run(apply())
