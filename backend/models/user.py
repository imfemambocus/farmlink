from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'farmer', 'individual', 'business'

    farmer_profile = relationship("FarmerProfile", back_populates="user", uselist=False)
    individual_profile = relationship("IndividualProfile", back_populates="user", uselist=False)
    business_profile = relationship("BusinessProfile", back_populates="user", uselist=False)


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    district = Column(String, nullable=False)

    user = relationship("User", back_populates="farmer_profile")


class IndividualProfile(Base):
    __tablename__ = "individual_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    street = Column(String, nullable=False)
    city_town = Column(String, nullable=False)
    post_code = Column(String, nullable=False)

    user = relationship("User", back_populates="individual_profile")


class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    business_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    street = Column(String, nullable=False)
    city_town = Column(String, nullable=False)
    post_code = Column(String, nullable=False)

    user = relationship("User", back_populates="business_profile")
