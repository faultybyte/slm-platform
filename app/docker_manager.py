import os
import time
import socket
import docker
import httpx
import asyncio

client = docker.from_env()

# A dictionary tracking which model combinations are currently running and on what port
# Key: "base_path|adapter_path", Value: Port Integer
_active_fleet = {}

def get_free_port() -> int:
    """Asks the host OS for a random, unused network port."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

async def wait_for_health(port: int, timeout: int = 600) -> bool:
    """Polls the container until it is fully loaded into RAM and ready to accept traffic."""
    url = f"http://127.0.0.1:{port}/health"
    async with httpx.AsyncClient() as http_client:
        for _ in range(timeout):
            try:
                response = await http_client.get(url)
                if response.status_code == 200:
                    return True
            except httpx.RequestError:
                pass
            await asyncio.sleep(1)
    return False

async def get_or_start_container(base_gguf_path: str, adapter_gguf_path: str = None) -> int:
    """Spawns an isolated Docker container for the specific model combination if one doesn't exist."""
    fleet_key = f"{base_gguf_path}|{adapter_gguf_path}"
    
    if fleet_key in _active_fleet:
        return _active_fleet[fleet_key]

    port = get_free_port()
    pwd = os.getcwd()
    
    # Extract just the filenames for the internal container paths
    base_file = os.path.basename(base_gguf_path)
    command = f"-m /models/{base_file} --host 0.0.0.0 --port 8080 -c 2048"
    
    container_name = f"llama-srv-{port}"

    if adapter_gguf_path:
        adapter_file = os.path.basename(adapter_gguf_path)
        command += f" --lora /adapters/{adapter_file}"

    print(f"SYSTEM: Spawning new inference container on port {port}...")
    
    try:
        container = client.containers.run(
            "ghcr.io/ggml-org/llama.cpp:server",
            command,
            name=container_name,
            detach=True,
            remove=True, # Auto-destroy the container when stopped to keep your system clean
            ports={'8080/tcp': port},
            volumes={
                f"{pwd}/storage/models": {'bind': '/models', 'mode': 'ro'},
                f"{pwd}/storage/adapters": {'bind': '/adapters', 'mode': 'ro'}
            }
        )
    except Exception as e:
        raise RuntimeError(f"Failed to spawn Docker container: {str(e)}")

    # Hold the FastAPI thread until the container physically reports it is ready
    is_healthy = await wait_for_health(port)
    if not is_healthy:
        client.containers.get(container_name).stop()
        raise RuntimeError(f"Container on port {port} timed out during initialization.")

    _active_fleet[fleet_key] = port
    return port
