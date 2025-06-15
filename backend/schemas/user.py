from pydantic import BaseModel, EmailStr
from typing import Optional

# Base response schema for User
class UserResponseBase(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        orm_mode = True

# Profile details for responses
class FarmerProfileResponse(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    district: str

    class Config:
        orm_mode = True

class IndividualProfileResponse(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    phone_number: str
    street: str
    city_town: str
    post_code: str

    class Config:
        orm_mode = True

class BusinessProfileResponse(BaseModel):
    business_name: str
    contact_name: str
    phone_number: str
    street: str
    city_town: str
    post_code: str

    class Config:
        orm_mode = True

# Full user response including profile info
class UserResponse(UserResponseBase):
    farmer_profile: Optional[FarmerProfileResponse]
    individual_profile: Optional[IndividualProfileResponse]
    business_profile: Optional[BusinessProfileResponse]


# Login schema
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Base user create with role
class UserCreateBase(BaseModel):
    email: EmailStr
    password: str
    role: str  # 'farmer', 'individual', 'business'


# Specific registration schemas per role

class FarmerCreate(UserCreateBase):
    first_name: str
    last_name: str
    phone_number: str
    district: str


class IndividualCreate(UserCreateBase):
    first_name: str
    last_name: str
    date_of_birth: str
    phone_number: str
    street: str
    city_town: str
    post_code: str


class BusinessCreate(UserCreateBase):
    business_name: str
    contact_name: str
    phone_number: str
    street: str
    city_town: str
    post_code: str
