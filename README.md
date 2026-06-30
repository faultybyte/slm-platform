# Forge

Forge is a self-hosted AI platform for running Small language models behind a clean, OpenAI-compatible API. It bundles inference, retrieval-augmented generation (RAG), dataset/fine-tuning pipelines, and an API gateway with key management — all controlled from a single dashboard.

## Features

- **Local inference** — Spin up and route requests to `llama.cpp` models running in Docker containers, no cloud dependency required.
- **OpenAI-compatible API gateway** — `/v1/chat/completions` and `/v1/models` endpoints that work with existing OpenAI SDKs and tooling.
- **API key management** — Issue, revoke, and track usage of scoped API keys for external consumers, with per-key token usage logs.
- **PII / safety checking** — Requests are screened before being routed to a model.
- **RAG pipeline** — Upload documents, chunk and embed them, and tune retrieval at query time (top-k, similarity threshold, context budget).
- **Dataset tooling** — Process, quarantine, review, and export training datasets, with support for editing individual training pairs.
- **Model fine-tuning** — Launch, pause, resume, and stop training jobs, with live log streaming.
- **Chat playground** — Streaming chat UI with adjustable inference parameters for quick experimentation.
- **Auth & settings** — User registration/login, account settings, and password management.

## Tech Stack

**Backend**
- FastAPI with async SQLAlchemy ORM
- PostgreSQL
- Docker (container lifecycle management for `llama.cpp` inference servers)

**Frontend**
- Next.js (TypeScript)
- shadcn/ui + Tailwind CSS
- Geist font

## Project Structure

```
.
├── main.py                  # FastAPI app entrypoint, lifespan, router registration
├── models.py                 # SQLAlchemy ORM models
├── schemas.py                 # Pydantic request/response schemas
├── database.py                 # DB engine/session setup
├── init_db.py                   # DB initialization script
├── seeder.py                     # Seeds default/system models
├── auth_utils.py                  # Auth/JWT helpers
├── docker_manager.py                # llama.cpp container lifecycle management
├── pii_scanner.py                     # PII/safety screening for gateway requests
├── dataset_processor.py                # Dataset chunking/processing pipeline
├── rag_worker.py                         # RAG ingestion, embedding, retrieval
├── training_worker.py                     # Fine-tuning job orchestration
├── migrations/                              # SQL migrations + apply script
├── routes/                                   # FastAPI routers
│   ├── auth.py            # Register, login, logout, current user
│   ├── inference.py       # OpenAI-compatible chat completions
│   ├── api_keys.py        # API key CRUD + usage logs
│   ├── conversations.py   # Conversation/message history
│   ├── documents.py       # Document upload for RAG
│   ├── datasets.py        # Dataset CRUD, processing, quarantine review
│   ├── training.py        # Model training job control
│   ├── settings.py        # User settings & password changes
│   └── landing.py         # Public landing info
└── src/                                     # Next.js frontend
    ├── app/                # App router pages (dashboard, login, register, etc.)
    ├── components/         # UI components (dashboard, playground, datasets, models, auth)
    └── lib/                 # API client, config, hooks, validation
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL
- Docker (for running local inference containers)

### Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment variables (database URL, JWT secret, etc.)
cp .env.example .env

# Run database migrations and seed default models
python init_db.py

# Start the API server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs are served at `/docs`.

### Frontend Setup

```bash
cd src
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

## API Gateway

Forge exposes an OpenAI-compatible endpoint so it can be used as a drop-in replacement for the OpenAI API in existing tools:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-model-name",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Every request to the gateway passes through a four-stage pipeline: API key validation → PII/safety check → model resolution → inference routing to the appropriate `llama.cpp` container.

API keys can be created, viewed, and revoked from the **Endpoints** page in the dashboard, which also shows token usage and ready-to-copy code snippets for external integrations.

## License

Add your license here.