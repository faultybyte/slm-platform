# Quickstart
1. Install the dependencies
```bash
uv sync
```
2. Create the required directories
```bash
mkdir -p storage/datasets storage/models storage/adapters storage/logs
```
3. Start the database
```bash
docker compose up -d
```
4. Initialize the database
```bash
uv run python -m app.init_db
```
5. Start the backend
```bash
fastapi dev
```
