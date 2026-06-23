import os
import time
import socket
import docker
import httpx
import asyncio

client = docker.from_env()

# Key: "base_path|adapter_path_or_none", Value: port int
_active_fleet: dict[str, int] = {}


def get_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


async def wait_for_health(port: int, timeout: int = 600) -> bool:
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


def _is_gguf_file(path: str) -> bool:
    return os.path.isfile(path) and path.lower().endswith(".gguf")


def _is_hf_adapter_dir(path: str) -> bool:
    """Returns True if path looks like a saved PEFT/HF adapter directory."""
    if not path or not os.path.isdir(path):
        return False
    return (
        os.path.exists(os.path.join(path, "adapter_config.json"))
        or os.path.exists(os.path.join(path, "config.json"))
    )


def _container_model_path(host_path: str) -> str:
    """
    Map a host-side storage path to its container-mounted path.

    The Docker run command mounts three directories:
      storage/models          → /models
      storage/adapters        → /adapters
      storage/uploaded_models → /uploaded_models

    This helper ensures the -m flag inside the container always points to the
    correct mount, regardless of which storage subdirectory the GGUF lives in.
    """
    norm = host_path.replace("\\", "/")
    fname = os.path.basename(host_path)

    if "storage/uploaded_models" in norm:
        return f"/uploaded_models/{fname}"
    if "storage/adapters" in norm:
        return f"/adapters/{fname}"
    # Default: storage/models or any other location maps to /models
    return f"/models/{fname}"


async def get_or_start_container(base_gguf_path: str, adapter_path: str | None = None) -> int:
    """
    Resolves which GGUF file to use for the base and (optionally) the adapter,
    then starts a llama.cpp Docker container if one is not already running.

    Adapter handling:
      - If adapter_path is a .gguf file  → pass via --lora to llama.cpp
      - If adapter_path is an HF dir     → look for a converted .gguf beside it
      - If no usable adapter             → run base model only (valid when the
                                           merged GGUF is already set as base_model_path)
    """
    # Resolve adapter: prefer a pre-converted GGUF adjacent to an HF dir
    resolved_adapter: str | None = None
    if adapter_path:
        if _is_gguf_file(adapter_path):
            resolved_adapter = adapter_path
        elif _is_hf_adapter_dir(adapter_path):
            # training_worker converts to <dir>.gguf after training
            gguf_candidate = adapter_path.rstrip("/").rstrip("\\") + ".gguf"
            if _is_gguf_file(gguf_candidate):
                resolved_adapter = gguf_candidate
            else:
                # No standalone adapter GGUF found — this is expected when the
                # training worker performed a merge-and-convert, making the
                # merged GGUF the new base_model_path. Serve base only.
                print(
                    f"SYSTEM: Adapter dir found at {adapter_path} but no .gguf sibling "
                    "— the merged GGUF is already set as base_model_path. Serving base only."
                )

    fleet_key = f"{base_gguf_path}|{resolved_adapter}"
    if fleet_key in _active_fleet:
        # Verify container is still alive
        port = _active_fleet[fleet_key]
        try:
            container_name = f"llama-srv-{port}"
            client.containers.get(container_name)
            return port
        except docker.errors.NotFound:
            del _active_fleet[fleet_key]

    if not os.path.isfile(base_gguf_path):
        raise RuntimeError(
            f"Base GGUF model not found at '{base_gguf_path}'. "
            "Ensure the file is present in storage/models/, storage/adapters/, "
            "or storage/uploaded_models/ depending on model type."
        )

    port = get_free_port()
    pwd = os.getcwd()

    # Map the host GGUF path to the correct container mount point
    container_base = _container_model_path(base_gguf_path)
    command = f"-m {container_base} --host 0.0.0.0 --port 8080 -c 2048"

    volumes = {
        f"{pwd}/storage/models": {"bind": "/models", "mode": "ro"},
        f"{pwd}/storage/adapters": {"bind": "/adapters", "mode": "ro"},
        # User-uploaded GGUFs live here
        f"{pwd}/storage/uploaded_models": {"bind": "/uploaded_models", "mode": "ro"},
    }

    if resolved_adapter:
        adapter_file = os.path.basename(resolved_adapter)
        command += f" --lora /adapters/{adapter_file}"

    container_name = f"llama-srv-{port}"
    print(f"SYSTEM: Spawning inference container '{container_name}' on port {port} ...")
    print(f"        base={base_gguf_path}  container_path={container_base}  adapter={resolved_adapter}")

    try:
        client.containers.run(
            "ghcr.io/ggml-org/llama.cpp:server",
            command,
            name=container_name,
            detach=True,
            remove=True,
            ports={"8080/tcp": port},
            volumes=volumes,
        )
    except Exception as e:
        raise RuntimeError(f"Failed to spawn Docker container: {e}")

    is_healthy = await wait_for_health(port)
    if not is_healthy:
        try:
            client.containers.get(container_name).stop()
        except Exception:
            pass
        raise RuntimeError(f"Container on port {port} timed out during initialization.")

    _active_fleet[fleet_key] = port
    return port