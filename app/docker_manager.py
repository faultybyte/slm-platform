import os
import time
import socket
import docker
import httpx
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for running sync Docker operations from async context
_docker_executor = ThreadPoolExecutor(max_workers=2)

try:
    client = docker.from_env()
    logger.info("Docker client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Docker client: {e}")
    client = None

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
        for attempt in range(timeout):
            try:
                response = await http_client.get(url)
                if response.status_code == 200:
                    logger.info(f"Container on port {port} is healthy")
                    return True
            except httpx.RequestError as e:
                if attempt % 10 == 0:  # Log every 10 attempts to avoid spam
                    logger.debug(f"Health check attempt {attempt}/{timeout} for port {port}: {e}")
            await asyncio.sleep(1)
    logger.error(f"Container on port {port} failed health check after {timeout}s")
    return False

def _run_container_sync(base_gguf_path: str, adapter_gguf_path: str, port: int, container_name: str) -> tuple:
    """Synchronous Docker container spawn (runs in thread pool)."""
    if not client:
        raise RuntimeError("Docker client is not available. Is Docker daemon running?")
    
    pwd = os.getcwd()
    
    # Extract just the filenames for the internal container paths
    base_file = os.path.basename(base_gguf_path)
    command = f"-m /models/{base_file} --host 0.0.0.0 --port 8080 -c 2048"
    
    if adapter_gguf_path:
        adapter_file = os.path.basename(adapter_gguf_path)
        command += f" --lora /adapters/{adapter_file}"

    logger.info(f"Spawning Docker container '{container_name}' on port {port} with command: {command}")
    
    try:
        # Check if container already exists (cleanup from previous run)
        try:
            existing = client.containers.get(container_name)
            logger.warning(f"Container {container_name} already exists, stopping and removing it")
            existing.stop()
            existing.remove()
        except docker.errors.NotFound:
            pass
        
        # Ensure storage directories exist
        models_dir = os.path.join(pwd, "storage/models")
        adapters_dir = os.path.join(pwd, "storage/adapters")
        os.makedirs(models_dir, exist_ok=True)
        os.makedirs(adapters_dir, exist_ok=True)
        
        # Verify model file exists
        model_path = os.path.join(pwd, base_gguf_path)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        logger.debug(f"Model file found: {model_path}")
        
        # Run the container
        container = client.containers.run(
            "ghcr.io/ggml-org/llama.cpp:server",
            command,
            name=container_name,
            detach=True,
            remove=False,  # Don't auto-remove to help with debugging
            ports={'8080/tcp': port},
            volumes={
                models_dir: {'bind': '/models', 'mode': 'ro'},
                adapters_dir: {'bind': '/adapters', 'mode': 'ro'}
            }
        )
        logger.info(f"Container {container_name} started with ID: {container.id[:12]}")
        return (True, port)
        
    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        raise
    except docker.errors.ImageNotFound:
        logger.error(f"Docker image 'ghcr.io/ggml-org/llama.cpp:server' not found. Pulling it...")
        try:
            client.images.pull("ghcr.io/ggml-org/llama.cpp:server")
            logger.info("Image pulled successfully, retrying container spawn")
            # Retry after pulling image
            return _run_container_sync(base_gguf_path, adapter_gguf_path, port, container_name)
        except Exception as pull_err:
            logger.error(f"Failed to pull Docker image: {pull_err}")
            raise RuntimeError(f"Docker image pull failed: {pull_err}")
    except docker.errors.APIError as e:
        logger.error(f"Docker API error: {e}")
        raise RuntimeError(f"Docker API error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error spawning container: {e}")
        raise RuntimeError(f"Failed to spawn Docker container: {e}")

async def get_or_start_container(base_gguf_path: str, adapter_gguf_path: str = None) -> int:
    """Spawns an isolated Docker container for the specific model combination if one doesn't exist."""
    fleet_key = f"{base_gguf_path}|{adapter_gguf_path}"
    
    if fleet_key in _active_fleet:
        logger.debug(f"Container for {fleet_key} already running on port {_active_fleet[fleet_key]}")
        return _active_fleet[fleet_key]

    port = get_free_port()
    container_name = f"llama-srv-{port}"

    logger.info(f"Starting container spawn process for {fleet_key} on port {port}...")
    
    try:
        # Run Docker container spawn in thread pool to avoid blocking async context
        loop = asyncio.get_event_loop()
        success, returned_port = await loop.run_in_executor(
            _docker_executor,
            _run_container_sync,
            base_gguf_path,
            adapter_gguf_path,
            port,
            container_name
        )
    except Exception as e:
        logger.error(f"Failed to spawn container: {e}")
        raise RuntimeError(f"Container spawn failed: {e}")

    # Hold until the container physically reports it is ready
    logger.info(f"Waiting for container {container_name} to become healthy...")
    is_healthy = await wait_for_health(port, timeout=600)
    
    if not is_healthy:
        logger.error(f"Container on port {port} failed health check, stopping...")
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(_docker_executor, lambda: client.containers.get(container_name).stop())
        except Exception as stop_err:
            logger.warning(f"Failed to stop container: {stop_err}")
        raise RuntimeError(f"Container on port {port} timed out during initialization.")

    _active_fleet[fleet_key] = port
    logger.info(f"Container {container_name} is ready and tracking in fleet")
    return port
