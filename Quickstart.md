# Quickstart

This gets Forge running locally: Postgres with `pgvector`, the FastAPI backend, the Next.js frontend, and Docker for spawning inference containers.

## 1. Prerequisites

Make sure you have:

- **Docker** installed and running (`docker info` should succeed)
- **PostgreSQL 15+** installed and running
- **Python 3.11+**
- **Node.js 18+** and a package manager (`npm`, `pnpm`, or `yarn`)
- At least one **GGUF model file** to chat with (see step 5)

## 2. Clone and lay out the repo

```bash
git clone https://github.com/faultybyte/slm-platform forge
cd forge
```

The backend lives at the repo root; the frontend lives in `frontend/`.

## 3. Set up PostgreSQL + pgvector

Create the database and user the backend expects (or adjust `DATABASE_URL` later to match whatever you choose):

```bash
psql -U postgres -c "CREATE USER admin WITH PASSWORD 'securepassword';"
psql -U postgres -c "CREATE DATABASE aibackend OWNER admin;"
```

`pgvector` gets enabled automatically on startup (`init_db.py` runs `CREATE EXTENSION IF NOT EXISTS vector;`), but the extension files need to be installed on the Postgres server itself first. On most systems:

```bash
# Debian/Ubuntu
sudo apt install postgresql-15-pgvector

# macOS (Homebrew)
brew install pgvector

# Or build from source: https://github.com/pgvector/pgvector#installation
```

## 4. Backend setup

From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

```bash
pip install .
```

Set environment variables (or put them in a `.env` and load it however you prefer):

```bash
export DATABASE_URL="postgresql+asyncpg://admin:securepassword@localhost:5432/aibackend"
export JWT_SECRET_KEY="replace-with-a-long-random-value"
```

Initialize the database schema:

```bash
python init_db.py
```

## 5. Add a base model

The backend expects at least the default model referenced in `seeder.py` to exist on disk before you can chat. Create the model storage directories and drop in a GGUF file:

```bash
mkdir -p storage/models storage/adapters storage/uploaded_models storage/datasets storage/logs
```

Download a small GGUF model (e.g. from Hugging Face) and place it at one of the paths `seeder.py` expects, for example:

```bash
storage/models/llama3.2-1B.gguf
```

If you're using a different model or filename, either rename your file to match an entry in `seeder.py`, or update `seeder.py`'s `SUPPORTED_MODELS` dict to point at the file you have.

## 6. Pull the inference image

```bash
docker pull ghcr.io/ggml-org/llama.cpp:server
```

The backend spawns containers from this image on demand — you don't need to run it manually, just make sure it's pulled and Docker is reachable.

## 7. Start the backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On startup it will run migrations, seed system base models into the database, and expose:

- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## 8. Frontend setup

```bash
cd frontend
npm install
```

Set the backend URL (only needed if it's not on the default `http://localhost:8000`):

```bash
export API_URL="http://localhost:8000"
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## 9. Create an account and chat

1. Go to `/register` and create a user (or hit `POST /auth/register` directly):

   ```bash
   curl -X POST http://localhost:8000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "you@example.com", "password": "yourpassword"}'
   ```

2. Log in through the UI, or via:

   ```bash
   curl -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "you@example.com", "password": "yourpassword"}'
   ```

3. From the dashboard, open the playground, pick a base model, and start chatting. The first message to a given model will take a little while as its `llama.cpp` container spins up — watch the backend logs for `SYSTEM: Spawning inference container ...`.

## Troubleshooting

- **`docker.errors.DockerException` on first chat request** — Docker daemon isn't running or isn't reachable by the user running the backend. On Linux, make sure your user is in the `docker` group or run the backend with appropriate permissions.
- **Container starts but health check times out** — check `docker logs llama-srv-<port>`; usually means the GGUF path is wrong or the file is corrupted/incompatible with the pulled `llama.cpp` server image.
- **`relation "document_vectors" does not exist`** — `init_db.py` wasn't run, or it ran before `pgvector` was installed on the Postgres server. Install the extension, then rerun `init_db.py`.
- **Login works but every other request 401s** — check that `JWT_SECRET_KEY` is set consistently; if the backend restarts with a different value than what issued your token, existing sessions become invalid.
- **Frontend can't reach the backend** — confirm `API_URL` is set in the frontend's environment and points at the running backend; remember this variable is intentionally server-side only (no `NEXT_PUBLIC_` prefix), so it must be set wherever the Next.js server process runs, not just in the browser.
