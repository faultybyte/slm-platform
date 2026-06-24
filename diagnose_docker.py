#!/usr/bin/env python3
"""
Docker Diagnostic Script
Helps troubleshoot container startup issues
"""
import os
import sys
import docker
import socket
from pathlib import Path

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def check_docker_daemon():
    print_header("1. Docker Daemon Status")
    try:
        client = docker.from_env()
        info = client.info()
        print(f"✓ Docker daemon is running")
        print(f"  - Docker version: {client.version()['Version']}")
        print(f"  - Containers: {info['Containers']}")
        print(f"  - Available memory: {info['MemTotal'] / (1024**3):.1f} GB")
        return True
    except Exception as e:
        print(f"✗ Docker daemon not accessible: {e}")
        print("  Fix: Start Docker Desktop or Docker daemon")
        return False

def check_docker_image():
    print_header("2. Docker Image Status")
    try:
        client = docker.from_env()
        images = client.images.list()
        llama_image = None
        for img in images:
            if "llama.cpp" in str(img.tags):
                llama_image = img
                break
        
        if llama_image:
            print(f"✓ Docker image found: {llama_image.tags}")
            return True
        else:
            print("✗ Docker image not found: ghcr.io/ggml-org/llama.cpp:server")
            print("  Attempting to pull image...")
            try:
                client.images.pull("ghcr.io/ggml-org/llama.cpp:server")
                print("✓ Image pulled successfully")
                return True
            except Exception as pull_err:
                print(f"✗ Failed to pull image: {pull_err}")
                return False
    except Exception as e:
        print(f"✗ Error checking Docker images: {e}")
        return False

def check_storage_directories():
    print_header("3. Storage Directories")
    base_path = Path("storage")
    models_path = base_path / "models"
    adapters_path = base_path / "adapters"
    
    issues = []
    
    if not base_path.exists():
        print(f"✗ storage/ directory not found")
        issues.append("storage dir")
    else:
        print(f"✓ storage/ directory exists")
    
    if not models_path.exists():
        print(f"✗ storage/models/ directory not found")
        models_path.mkdir(parents=True, exist_ok=True)
        print(f"  Created storage/models/")
        issues.append("models dir was created")
    else:
        print(f"✓ storage/models/ directory exists")
        model_files = list(models_path.glob("*.gguf"))
        if model_files:
            print(f"  Found {len(model_files)} model file(s):")
            for f in model_files:
                size_gb = f.stat().st_size / (1024**3)
                print(f"    - {f.name} ({size_gb:.2f} GB)")
        else:
            print(f"  ✗ No .gguf model files found in storage/models/")
            issues.append("missing model files")
    
    if not adapters_path.exists():
        print(f"✗ storage/adapters/ directory not found")
        adapters_path.mkdir(parents=True, exist_ok=True)
        print(f"  Created storage/adapters/")
        issues.append("adapters dir was created")
    else:
        print(f"✓ storage/adapters/ directory exists")
    
    return len(issues) == 0, issues

def check_ports():
    print_header("4. Network Ports")
    test_ports = [8000, 8001, 8080, 5432]
    
    for port in test_ports:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        
        if result == 0:
            print(f"⚠ Port {port} is already in use (container may be already running)")
        else:
            print(f"✓ Port {port} is available")

def check_existing_containers():
    print_header("5. Existing Containers")
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        
        llama_containers = [c for c in containers if "llama" in c.name.lower()]
        
        if llama_containers:
            print(f"Found {len(llama_containers)} llama container(s):")
            for c in llama_containers:
                print(f"  - {c.name}: {c.status}")
                if c.status == "exited":
                    print(f"    Logs: {c.logs(tail=5).decode()[:200]}")
        else:
            print("No existing llama containers found")
        
        return True
    except Exception as e:
        print(f"✗ Error listing containers: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("  Docker Container Diagnostic")
    print("="*60)
    
    checks = []
    
    checks.append(("Docker Daemon", check_docker_daemon()))
    checks.append(("Docker Image", check_docker_image()))
    
    storage_ok, storage_issues = check_storage_directories()
    checks.append(("Storage Directories", storage_ok))
    
    check_ports()
    check_existing_containers()
    
    # Summary
    print_header("Summary")
    all_passed = True
    for check_name, passed in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {check_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n✓ All checks passed! Docker environment is ready.")
        print("\nYou can now:")
        print("  1. Start the backend: uv run python -m app.main")
        print("  2. Create a new chat in the UI")
        print("  3. Select a model and send a message")
        print("  4. Monitor the terminal for container startup logs")
    else:
        print("\n✗ Some checks failed. Review the issues above.")
        print("\nCommon fixes:")
        print("  - Ensure Docker Desktop is running (Windows/Mac)")
        print("  - Ensure Docker daemon is running (Linux)")
        print("  - Check internet connection for pulling images")
        print("  - Ensure storage/models/ contains .gguf files")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
