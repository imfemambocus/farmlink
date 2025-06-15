from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.user import (
    FarmerCreate, IndividualCreate, BusinessCreate,
    UserLogin, UserResponse,
)
from services.auth_service import create_user_with_profile, authenticate_user
from core.security import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user, get_db
from datetime import timedelta

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register(user_data: dict, db: Session = Depends(get_db)):
    role = user_data.get('role')
    if not role:
        raise HTTPException(status_code=400, detail="Role is required")

    # Validate and parse input based on role
    if role == 'farmer':
        user_create = FarmerCreate(**user_data)
    elif role == 'individual':
        user_create = IndividualCreate(**user_data)
    elif role == 'business':
        user_create = BusinessCreate(**user_data)
    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    try:
        db_user = create_user_with_profile(db, user_create)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return db_user

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = authenticate_user(db, user.email, user.password)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer"}

@router.get("/profile", response_model=UserResponse)
def get_my_profile(current_user=Depends(get_current_user)):
    return current_user
