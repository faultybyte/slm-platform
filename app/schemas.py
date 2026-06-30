from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(
        ...,
        max_length=72,
        description="Password must be 72 characters or fewer due to bcrypt limitations.",
    )


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class SettingsResponse(BaseModel):
    # Identity
    email: str = ""
    display_name: str = ""

    # Model prefs
    default_model: str = "llama-3.2-1b-instruct"
    system_prompt: str = "You are a helpful, respectful, and honest local AI assistant."
    temperature: float = 0.7
    max_tokens: int = 2048
    top_p: float = 1.0
    context_window: int = 4096

    # Storage paths
    datasets_root: str = "storage/datasets"
    adapters_root: str = "storage/adapters"
    uploaded_models_root: str = "storage/uploaded_models"
    logs_root: str = "storage/logs"
    base_models_root: str = "storage/models"

    # Docker
    docker_image: str = "ghcr.io/ggml-org/llama.cpp:server"
    docker_healthcheck_timeout: int = 600

    # General / appearance
    theme: str = "system"

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    display_name: Optional[str] = None
    default_model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    context_window: Optional[int] = None
    datasets_root: Optional[str] = None
    adapters_root: Optional[str] = None
    uploaded_models_root: Optional[str] = None
    logs_root: Optional[str] = None
    base_models_root: Optional[str] = None
    docker_image: Optional[str] = None
    docker_healthcheck_timeout: Optional[int] = None
    theme: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., max_length=72)
