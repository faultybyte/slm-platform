from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    # Enforce the 72-byte limit directly at the API routing layer
    password: str = Field(
        ..., 
        max_length=72, 
        description="Password must be 72 characters or fewer due to bcrypt limitations."
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
