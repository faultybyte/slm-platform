"""
Run once on startup to apply all schema changes safely.
Every ALTER TABLE is guarded — safe to run multiple times.
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def apply():
    async with AsyncSessionLocal() as db:
        try:
            # ── Existing migrations ────────────────────────────────────────
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

            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS base_model_key VARCHAR;"))
            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS dataset_id INTEGER;"))
            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS worker_pid INTEGER;"))
            await db.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;"))

            # ── API Key usage tracking columns ─────────────────────────────
            await db.execute(text("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS token_limit  INTEGER DEFAULT 1000000;"))
            await db.execute(text("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tokens_used  INTEGER NOT NULL DEFAULT 0;"))
            await db.execute(text("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;"))

            # ── Users: total_tokens_consumed ───────────────────────────────
            await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tokens_consumed INTEGER DEFAULT 0;"))

            # ── API key usage logs table ───────────────────────────────────
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS api_key_usage_logs (
                    id                SERIAL PRIMARY KEY,
                    api_key_id        INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
                    user_id           INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
                    model_id          INTEGER,
                    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
                    completion_tokens INTEGER NOT NULL DEFAULT 0,
                    total_tokens      INTEGER NOT NULL DEFAULT 0,
                    latency_ms        INTEGER,
                    status_code       INTEGER DEFAULT 200,
                    pii_blocked       BOOLEAN DEFAULT FALSE,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """))

            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key "
                "ON api_key_usage_logs(api_key_id);"
            ))
            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_usage_logs_user "
                "ON api_key_usage_logs(user_id);"
            ))
            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_usage_logs_created "
                "ON api_key_usage_logs(created_at DESC);"
            ))

            # ── Dataset pipelines table ────────────────────────────────────
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS dataset_pipelines (
                    id               SERIAL PRIMARY KEY,
                    dataset_id       INTEGER NOT NULL UNIQUE REFERENCES datasets(id) ON DELETE CASCADE,
                    pipeline_status  VARCHAR(32)  NOT NULL DEFAULT 'PROCESSING',
                    error_message    TEXT,
                    pipeline_logs    TEXT,
                    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    raw_file_path        TEXT,
                    output_file_path     TEXT,
                    quarantine_file_path TEXT,
                    schema_type      VARCHAR(64),
                    total_rows_raw   INTEGER,
                    total_rows_clean INTEGER,
                    rows_removed     INTEGER,
                    duplicate_count  INTEGER,
                    dedup_threshold  FLOAT   DEFAULT 0.85,
                    chunk_size       INTEGER DEFAULT 500,
                    chunk_overlap    INTEGER DEFAULT 50,
                    lora_config      TEXT
                );
            """))

            await db.commit()
            print("MIGRATION: All schema changes applied successfully.")

        except Exception as e:
            print(f"MIGRATION FAILED: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(apply())
