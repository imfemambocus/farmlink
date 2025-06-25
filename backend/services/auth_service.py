from sqlalchemy.orm import Session
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from core.security import get_password_hash
from schemas.user import FarmerCreate, IndividualCreate, BusinessCreate


def create_user_with_profile(db: Session, user_create):
    hashed_pw = get_password_hash(user_create.password)
    user = User(email=user_create.email, hashed_password=hashed_pw, role=user_create.role)
    db.add(user)
    db.commit()
    db.refresh(user)

    if user.role == 'farmer' and isinstance(user_create, FarmerCreate):
        profile = FarmerProfile(
            user_id=user.id,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            phone_number=user_create.phone_number,
            district=user_create.district,
        )
    elif user.role == 'individual' and isinstance(user_create, IndividualCreate):
        profile = IndividualProfile(
            user_id=user.id,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            date_of_birth=user_create.date_of_birth,
            phone_number=user_create.phone_number,
            street=user_create.street,
            city_town=user_create.city_town,
            post_code=user_create.post_code,
        )
    elif user.role == 'business' and isinstance(user_create, BusinessCreate):
        profile = BusinessProfile(
            user_id=user.id,
            business_name=user_create.business_name,
            contact_name=user_create.contact_name,
            phone_number=user_create.phone_number,
            street=user_create.street,
            city_town=user_create.city_town,
            post_code=user_create.post_code,
        )
    else:
        raise Exception("Invalid profile data")

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return user


def authenticate_user(db: Session, email: str, password: str):
    from core.security import verify_password

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
