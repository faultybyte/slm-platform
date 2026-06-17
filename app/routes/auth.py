from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
from app.auth_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Structural check for existing identity signatures
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email signature already registered within host database."
        )
    
    # Encrypt raw data layers and save block
    hashed = hash_password(user_in.password)
    new_user = User(email=user_in.email, hashed_password=hashed)
    db.add(new_user)
    await db.flush()
    return new_user

@router.post("/login", response_model=Token)
async def login(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect local identity parameters or security signatures.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate encrypted signature token context
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_current_user_profile(
    db: AsyncSession = Depends(get_db), 
    user_id: int = Depends(get_current_user)
):
    """Returns current user identity and token consumption telemetry for the global Navbar."""
    # Assuming your User model has email or username fields. 
    # If tracking tokens dynamically, you can sum message token usages or read a user column.
    result = await db.execute(text("SELECT email, total_tokens_consumed FROM users WHERE id = :id"), {"id": user_id})
    user_row = result.fetchone()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
        
    return {
        "id": user_id,
        "email": user_row[0],
        "token_count": user_row[1] or 0, # Maps directly to 'Tokens: 150k' on the frontend Navbar
        "role": "developer"
    }
