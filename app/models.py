from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    total_tokens_consumed = Column(Integer, default=0)
    settings = Column(Text, nullable=True)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="datasets")
    pipeline = relationship(
        "DatasetPipeline",
        back_populates="dataset",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    display_name = Column(String, nullable=False)
    base_model_path = Column(String, nullable=False)
    base_model_key = Column(String, nullable=True)
    dataset_id = Column(Integer, nullable=True)
    worker_pid = Column(Integer, nullable=True)
    adapter_path = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    is_base_model = Column(Boolean, default=False, nullable=False)
    is_uploaded = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="models")
    conversations = relationship("Conversation", back_populates="model")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="SET NULL"), nullable=True)
    session_title = Column(String, default="New Chat", nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="conversations")
    model = relationship("Model", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    document_vectors = relationship("DocumentVector", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    payload_content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class DocumentVector(Base):
    __tablename__ = "document_vectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    text_chunk = Column(Text, nullable=False)
    embedding_matrix = Column(Vector(384), nullable=False)

    conversation = relationship("Conversation", back_populates="document_vectors")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key_hash = Column(String, unique=True, index=True)
    display_prefix = Column(String)
    name = Column(String, default="My API Key")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # ── Usage tracking ──────────────────────────────────────────────────────
    # None = unlimited
    token_limit = Column(Integer, nullable=True, default=1_000_000)
    tokens_used = Column(Integer, nullable=False, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="api_keys")
    usage_logs = relationship(
        "ApiKeyUsageLog",
        back_populates="api_key",
        cascade="all, delete-orphan",
    )


class ApiKeyUsageLog(Base):
    """Per-request audit trail for API key usage."""
    __tablename__ = "api_key_usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(
        Integer,
        ForeignKey("api_keys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_id = Column(Integer, nullable=True)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=True)
    status_code = Column(Integer, default=200)
    pii_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    api_key = relationship("ApiKey", back_populates="usage_logs")


class DatasetPipeline(Base):
    """Tracks every stage of the 6-layer preprocessing pipeline for a Dataset."""
    __tablename__ = "dataset_pipelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    pipeline_status = Column(String, nullable=False, default="PROCESSING")
    error_message   = Column(Text, nullable=True)
    pipeline_logs   = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    raw_file_path        = Column(String, nullable=True)
    output_file_path     = Column(String, nullable=True)
    quarantine_file_path = Column(String, nullable=True)

    schema_type      = Column(String, nullable=True)
    total_rows_raw   = Column(Integer, nullable=True)
    total_rows_clean = Column(Integer, nullable=True)
    rows_removed     = Column(Integer, nullable=True)
    duplicate_count  = Column(Integer, nullable=True)
    dedup_threshold  = Column(Float, nullable=True, default=0.85)
    chunk_size       = Column(Integer, nullable=True, default=500)
    chunk_overlap    = Column(Integer, nullable=True, default=50)
    lora_config      = Column(Text, nullable=True)

    dataset = relationship("Dataset", back_populates="pipeline")
