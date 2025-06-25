from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.user import (
    FarmerCreate, IndividualCreate, BusinessCreate,
    UserLogin, UserResponse, FarmerProfileUpdate, IndividualProfileUpdate, BusinessProfileUpdate,
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


@router.put("/profile", response_model=UserResponse)
def update_profile(profile_data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        if current_user.role == 'farmer':
            update_data = FarmerProfileUpdate(**profile_data)
            profile = current_user.farmer_profile
        elif current_user.role == 'individual':
            update_data = IndividualProfileUpdate(**profile_data)
            profile = current_user.individual_profile
        elif current_user.role == 'business':
            update_data = BusinessProfileUpdate(**profile_data)
            profile = current_user.business_profile
        else:
            raise HTTPException(status_code=400, detail="Invalid user role")

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Update only provided fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if value is not None:
                setattr(profile, field, value)

        db.commit()
        db.refresh(current_user)

        return current_user

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))