from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./farmlink.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


###################################


import os
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from models.user import User

SECRET_KEY = os.getenv("SECRET_KEY", "your_super_secret_key_for_development_only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")  # Make sure this matches your route

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Database dependency function
def get_db():
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = (
        db.query(User)
        .options(
            joinedload(User.farmer_profile),
            joinedload(User.individual_profile),
            joinedload(User.business_profile),
        )
        .filter(User.email == email)
        .first()
    )
    if user is None:
        raise credentials_exception
    return user


###################################


# models/notification.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum


class NotificationTypeEnum(str, enum.Enum):
    ORDER_CREATED = "order_created"
    ORDER_STATUS_CHANGED = "order_status_changed"
    ORDER_DELIVERED = "order_delivered"
    ORDER_CANCELLED = "order_cancelled"


# Device tokens for push notifications
class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expo_push_token = Column(String, nullable=False)
    device_id = Column(String, nullable=False)  # Unique device identifier
    platform = Column(String, nullable=False)  # 'ios' or 'android'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    # Ensure one token per device per user
    __table_args__ = (
        {'extend_existing': True}
    )


# Notification history
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # For farmer-specific status

    # Notification content
    type = Column(Enum(NotificationTypeEnum), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(Text)  # JSON data for additional info

    # Status tracking
    is_read = Column(Boolean, default=False)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    read_at = Column(DateTime)

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    order = relationship("UnifiedOrder", foreign_keys=[order_id])
    farmer = relationship("User", foreign_keys=[farmer_id])


# Per-farmer status tracking for unified orders
class UnifiedOrderFarmerStatus(Base):
    __tablename__ = "unified_order_farmer_status"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Farmer-specific status (can be different from main order status)
    status = Column(String, default="confirmed")  # confirmed, processing, out_for_delivery, delivered, cancelled

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    status_changed_at = Column(DateTime, server_default=func.now())

    # Relationships
    order = relationship("UnifiedOrder")
    farmer = relationship("User", foreign_keys=[farmer_id])

    # Ensure one status record per farmer per order
    __table_args__ = (
        {'extend_existing': True}
    )


###################################


# models/order.py - UNIFIED SYSTEM ONLY
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum
from decimal import Decimal


# ==========================================
# ENUMS
# ==========================================

class OrderStatusEnum(str, enum.Enum):
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethodEnum(str, enum.Enum):
    CASH_ON_DELIVERY = "cash_on_delivery"
    MOBILE_PAYMENT = "mobile_payment"
    BANK_TRANSFER = "bank_transfer"
    DIGITAL_WALLET = "digital_wallet"
    STRIPE_CARD = "stripe_card"
    STRIPE_APPLE_PAY = "stripe_apple_pay"
    STRIPE_GOOGLE_PAY = "stripe_google_pay"


# ==========================================
# CART MODELS
# ==========================================

class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id"), nullable=False)
    farmer_product_id = Column(Integer, ForeignKey("farmer_products.id"), nullable=False)
    unit_price_id = Column(Integer, ForeignKey("product_unit_prices.id"), nullable=False)
    quantity = Column(Float, nullable=False)

    # Store price at time of adding to cart (in case farmer changes price)
    unit_price_snapshot = Column(Numeric(10, 2), nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    cart = relationship("Cart", back_populates="items")
    farmer_product = relationship("FarmerProduct")
    unit_price = relationship("ProductUnitPrice")

    @property
    def total_price(self) -> Decimal:
        return Decimal(str(self.unit_price_snapshot)) * Decimal(str(self.quantity))


# ==========================================
# UNIFIED ORDER MODELS
# ==========================================

class UnifiedOrder(Base):
    __tablename__ = "unified_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Order details
    status = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.CONFIRMED)
    total_amount = Column(Numeric(10, 2), nullable=False)
    delivery_fee = Column(Numeric(10, 2), default=0)
    final_amount = Column(Numeric(10, 2), nullable=False)

    # Customer information (snapshot at time of order)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)

    # Delivery information
    delivery_address = Column(Text, nullable=False)
    delivery_notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    delivered_at = Column(DateTime)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    items = relationship("UnifiedOrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("UnifiedPayment", back_populates="order", uselist=False)
    farmer_payments = relationship("FarmerPayment", back_populates="order", cascade="all, delete-orphan")


class UnifiedOrderItem(Base):
    __tablename__ = "unified_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    farmer_product_id = Column(Integer, ForeignKey("farmer_products.id"), nullable=False)

    # Product snapshot at time of order
    item_name = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Float, nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    # Product details for reference
    product_description = Column(Text)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    order = relationship("UnifiedOrder", back_populates="items")
    farmer = relationship("User", foreign_keys=[farmer_id])
    farmer_product = relationship("FarmerProduct")


class UnifiedPayment(Base):
    __tablename__ = "unified_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False, unique=True)
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)

    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="MUR")

    # Stripe payment information
    stripe_payment_intent_id = Column(String, unique=True)
    stripe_payment_method_id = Column(String)
    stripe_charge_id = Column(String)

    # Payment gateway response
    gateway_response = Column(Text)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime)

    # Relationships
    order = relationship("UnifiedOrder", back_populates="payment")


class FarmerPayment(Base):
    __tablename__ = "farmer_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Amount calculations
    gross_amount = Column(Numeric(10, 2), nullable=False)  # Total sales for this farmer
    platform_fee = Column(Numeric(10, 2), nullable=False)  # FarmLink's commission
    net_amount = Column(Numeric(10, 2), nullable=False)  # Amount due to farmer

    # Platform fee percentage at time of order
    platform_fee_percentage = Column(Float, default=10.0)  # 10% default commission

    # Payment status to farmer
    payment_status = Column(String, default="pending")  # pending, paid, failed
    paid_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    order = relationship("UnifiedOrder", back_populates="farmer_payments")
    farmer = relationship("User", foreign_keys=[farmer_id])


###################################


from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum


class CategoryEnum(str, enum.Enum):
    FRUITS = "fruits"
    VEGETABLES = "vegetables"


class UnitEnum(str, enum.Enum):
    KG = "kg"
    BUNCH = "bunch"
    PIECE = "piece"
    DOZEN = "dozen"
    BASKET = "basket"


class CustomerTypeEnum(str, enum.Enum):
    INDIVIDUAL = "individual"
    BUSINESS = "business"


class ItemEnum(str, enum.Enum):
    # Fruits
    APPLE = "apple"
    BANANA = "banana"
    ORANGE = "orange"
    MANGO = "mango"
    PINEAPPLE = "pineapple"
    PAPAYA = "papaya"
    GUAVA = "guava"
    LYCHEE = "lychee"
    COCONUT = "coconut"
    LEMON = "lemon"
    LIME = "lime"
    WATERMELON = "watermelon"
    MELON = "melon"
    GRAPES = "grapes"
    STRAWBERRY = "strawberry"

    # Vegetables
    TOMATO = "tomato"
    POTATO = "potato"
    ONION = "onion"
    CARROT = "carrot"
    CABBAGE = "cabbage"
    LETTUCE = "lettuce"
    SPINACH = "spinach"
    BROCCOLI = "broccoli"
    CAULIFLOWER = "cauliflower"
    BELL_PEPPER = "bell_pepper"
    CHILI = "chili"
    CUCUMBER = "cucumber"
    EGGPLANT = "eggplant"
    OKRA = "okra"
    GREEN_BEANS = "green_beans"
    PUMPKIN = "pumpkin"
    BEETROOT = "beetroot"
    RADISH = "radish"
    GINGER = "ginger"
    GARLIC = "garlic"


# Helper function to get category from item
def get_item_category(item: ItemEnum) -> CategoryEnum:
    fruits = {
        ItemEnum.APPLE, ItemEnum.BANANA, ItemEnum.ORANGE, ItemEnum.MANGO,
        ItemEnum.PINEAPPLE, ItemEnum.PAPAYA, ItemEnum.GUAVA, ItemEnum.LYCHEE,
        ItemEnum.COCONUT, ItemEnum.LEMON, ItemEnum.LIME, ItemEnum.WATERMELON,
        ItemEnum.MELON, ItemEnum.GRAPES, ItemEnum.STRAWBERRY
    }
    return CategoryEnum.FRUITS if item in fruits else CategoryEnum.VEGETABLES


class FarmerProduct(Base):
    __tablename__ = "farmer_products"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item = Column(Enum(ItemEnum), nullable=False)

    # Product status and description
    is_active = Column(Boolean, default=True)
    description = Column(Text)  # e.g., "Organic, pesticide-free"
    harvest_date = Column(DateTime)
    expiry_date = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    farmer = relationship("User", foreign_keys=[farmer_id])
    unit_prices = relationship("ProductUnitPrice", back_populates="farmer_product", cascade="all, delete-orphan")


class ProductUnitPrice(Base):
    __tablename__ = "product_unit_prices"

    id = Column(Integer, primary_key=True, index=True)
    farmer_product_id = Column(Integer, ForeignKey("farmer_products.id"), nullable=False)
    unit = Column(Enum(UnitEnum), nullable=False)
    customer_type = Column(Enum(CustomerTypeEnum), nullable=False)  # NEW: individual or business
    price_per_unit = Column(Float, nullable=False)
    quantity_available = Column(Float, nullable=False)
    minimum_order = Column(Float, default=1.0)

    # Relationships
    farmer_product = relationship("FarmerProduct", back_populates="unit_prices")

    # Ensure farmer can't have duplicate unit prices for same product, unit, and customer type
    __table_args__ = (
        UniqueConstraint('farmer_product_id', 'unit', 'customer_type', name='unique_product_unit_customer'),
    )


###################################


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


###################################


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

@router.put("/profile", response_model=UserResponse)
def update_profile(profile_data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # Validate and parse input based on user role
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
            if value is not None:  # Only update non-None values
                setattr(profile, field, value)

        db.commit()
        db.refresh(current_user)

        return current_user

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


###################################


# routes/browse.py - Updated with ML Recommendations endpoint
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from services.browse_service import BrowseService
from core.security import get_current_user, get_db
from models.product import CategoryEnum

router = APIRouter()


@router.get("/farmers")
def browse_farmers(
        district: Optional[str] = Query(None, description="Filter by district"),
        limit: int = Query(10, le=50, description="Number of farmers to return"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Browse farmers with active products (for homepage)"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse farmers")

    service = BrowseService(db)
    return service.get_featured_farmers(district=district, limit=limit)


@router.get("/products/recommendations")
def get_personalized_recommendations(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get personalized product recommendations using ML"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can get recommendations")

    service = BrowseService(db)
    return service.get_personalized_recommendations(current_user.id, current_user.role)


@router.get("/products/latest")
def browse_latest_products(
        limit: int = Query(20, le=50, description="Number of products to return"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Browse latest products from all farmers (for homepage)"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse products")

    service = BrowseService(db)
    return service.get_latest_products(limit=limit)


@router.get("/products/search")
def search_products(
        search: Optional[str] = Query(None, description="Search term"),
        category: Optional[CategoryEnum] = Query(None, description="Filter by category"),
        district: Optional[str] = Query(None, description="Filter by farmer's district"),
        min_price: Optional[float] = Query(None, description="Minimum price filter"),
        max_price: Optional[float] = Query(None, description="Maximum price filter"),
        limit: int = Query(20, le=50, description="Number of products per page"),
        offset: int = Query(0, description="Number of products to skip"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Search and filter products"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can search products")

    service = BrowseService(db)
    return service.search_products(
        search_term=search,
        category=category,
        district=district,
        min_price=min_price,
        max_price=max_price,
        limit=limit,
        offset=offset
    )


@router.get("/farmer/{farmer_id}")
def get_farmer_details(
        farmer_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer details with all their products"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can view farmer details")

    service = BrowseService(db)
    farmer = service.get_farmer_details_with_products(farmer_id)

    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    return farmer


@router.get("/categories")
def get_categories(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get product categories with counts"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse categories")

    service = BrowseService(db)
    return service.get_categories_with_counts()


@router.get("/districts")
def get_districts(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get districts with farmer and product counts"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse districts")

    service = BrowseService(db)
    return service.get_districts_with_counts()


###################################


# routes/notifications.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from models.order import UnifiedOrder, UnifiedOrderItem
from models.user import FarmerProfile
from services.notification_service import PushNotificationService
from core.security import get_current_user, get_db
from models.notification import NotificationTypeEnum, UnifiedOrderFarmerStatus
import json

router = APIRouter()


# Schemas
class DeviceTokenRegister(BaseModel):
    expo_push_token: str
    device_id: str
    platform: str  # 'ios' or 'android'


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    order_id: Optional[int]
    farmer_id: Optional[int]
    farmer_name: Optional[str]
    data: Optional[dict]
    is_read: bool
    created_at: str
    read_at: Optional[str]

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    has_next: bool


# Register device token
@router.post("/device-token")
def register_device_token(
        token_data: DeviceTokenRegister,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Register device token for push notifications"""
    service = PushNotificationService(db)

    device_token = service.register_device_token(
        user_id=current_user.id,
        expo_push_token=token_data.expo_push_token,
        device_id=token_data.device_id,
        platform=token_data.platform
    )

    return {
        "message": "Device token registered successfully",
        "token_id": device_token.id
    }


# Get user notifications
@router.get("", response_model=NotificationListResponse)
def get_notifications(
        limit: int = Query(20, le=50, description="Number of notifications to return"),
        offset: int = Query(0, description="Number of notifications to skip"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user notifications"""
    service = PushNotificationService(db)

    notifications = service.get_user_notifications(current_user.id, limit, offset)
    total = len(notifications)  # You might want to implement a proper count query
    unread_count = service.get_unread_count(current_user.id)

    # Format notifications
    formatted_notifications = []
    for notification in notifications:
        farmer_name = None
        if notification.farmer_id and notification.farmer:
            if notification.farmer.farmer_profile:
                farmer_name = f"{notification.farmer.farmer_profile.first_name} {notification.farmer.farmer_profile.last_name}"

        formatted_notifications.append(NotificationResponse(
            id=notification.id,
            type=notification.type.value,
            title=notification.title,
            message=notification.message,
            order_id=notification.order_id,
            farmer_id=notification.farmer_id,
            farmer_name=farmer_name,
            data=json.loads(notification.data) if notification.data else None,
            is_read=notification.is_read,
            created_at=notification.created_at.isoformat(),
            read_at=notification.read_at.isoformat() if notification.read_at else None
        ))

    return NotificationListResponse(
        notifications=formatted_notifications,
        total=total,
        unread_count=unread_count,
        has_next=len(notifications) == limit  # Simple check for pagination
    )


# Mark notification as read
@router.put("/{notification_id}/read")
def mark_notification_read(
        notification_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Mark notification as read"""
    service = PushNotificationService(db)

    success = service.mark_notification_as_read(notification_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}


# Mark all notifications as read
@router.put("/read-all")
def mark_all_notifications_read(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    service = PushNotificationService(db)

    updated_count = service.mark_all_notifications_as_read(current_user.id)

    return {
        "message": f"Marked {updated_count} notifications as read",
        "updated_count": updated_count
    }


# Get unread count
@router.get("/unread-count")
def get_unread_count(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get count of unread notifications"""
    service = PushNotificationService(db)

    unread_count = service.get_unread_count(current_user.id)

    return {"unread_count": unread_count}


# Get order farmer statuses (for customers to see per-farmer status)
@router.get("/order/{order_id}/farmer-statuses")
def get_order_farmer_statuses(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer statuses for a unified order - SQLite optimized"""

    # Get the order first
    order = db.query(UnifiedOrder).filter(UnifiedOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get order items to find farmer IDs
    order_items = (
        db.query(UnifiedOrderItem)
        .filter(UnifiedOrderItem.order_id == order_id)
        .all()
    )

    farmer_ids_in_order = set(item.farmer_id for item in order_items)

    # Check permissions
    if current_user.id != order.customer_id and current_user.id not in farmer_ids_in_order:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get farmer statuses
    farmer_statuses_records = (
        db.query(UnifiedOrderFarmerStatus)
        .filter(UnifiedOrderFarmerStatus.order_id == order_id)
        .all()
    )

    farmer_statuses = {fs.farmer_id: fs.status for fs in farmer_statuses_records}

    # Get farmer information separately (SQLite-friendly)
    result = {}
    for farmer_id in farmer_ids_in_order:
        # Get farmer profile separately
        farmer_profile = (
            db.query(FarmerProfile)
            .filter(FarmerProfile.user_id == farmer_id)
            .first()
        )

        if farmer_profile:
            farmer_name = f"{farmer_profile.first_name} {farmer_profile.last_name}"
            farmer_district = farmer_profile.district
        else:
            farmer_name = f"Farmer {farmer_id}"
            farmer_district = "Unknown District"

        result[farmer_id] = {
            "farmer_name": farmer_name,
            "status": farmer_statuses.get(farmer_id, "confirmed"),
            "farmer_district": farmer_district
        }

    return {"farmer_statuses": result}


###################################


# routes/orders.py - UNIFIED SYSTEM ONLY
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from models.notification import UnifiedOrderFarmerStatus
from models.user import FarmerProfile, User
from schemas.order import (
    CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse,
    UnifiedOrderResponse, UnifiedOrderListItem, UnifiedOrderUpdateRequest,
    FarmerOrderSummary
)
from services.order_service import OrderService
from core.security import get_current_user, get_db
from models.order import OrderStatusEnum, UnifiedOrder, UnifiedOrderItem

router = APIRouter()


# ==========================================
# CART ENDPOINTS
# ==========================================

@router.post("/cart/items", response_model=CartItemResponse)
def add_to_cart(
        item_data: CartItemCreate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Add item to cart"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can add items to cart")

    try:
        service = OrderService(db)
        cart_item = service.add_to_cart(current_user.id, item_data)
        return cart_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to add item to cart")


@router.get("/cart", response_model=CartResponse)
def get_cart(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user's cart"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can access cart")

    service = OrderService(db)
    return service.get_cart(current_user.id)


@router.put("/cart/items/{item_id}", response_model=CartItemResponse)
def update_cart_item(
        item_id: int,
        update_data: CartItemUpdate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update cart item quantity"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can update cart")

    try:
        service = OrderService(db)
        cart_item = service.update_cart_item(current_user.id, item_id, update_data)
        return cart_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/cart/items/{item_id}")
def remove_from_cart(
        item_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Remove item from cart"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can modify cart")

    service = OrderService(db)
    success = service.remove_from_cart(current_user.id, item_id)

    if not success:
        raise HTTPException(status_code=404, detail="Cart item not found")

    return {"message": "Item removed from cart"}


@router.delete("/cart")
def clear_cart(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Clear all items from cart"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can clear cart")

    service = OrderService(db)
    service.clear_cart(current_user.id)
    return {"message": "Cart cleared successfully"}


# ==========================================
# UNIFIED ORDER ENDPOINTS
# ==========================================

@router.get("", response_model=List[UnifiedOrderListItem])
def get_my_orders(
        status: Optional[OrderStatusEnum] = Query(None, description="Filter by order status"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user's unified orders (customers see their orders, farmers see orders containing their items)"""
    service = OrderService(db)

    if current_user.role == 'farmer':
        orders = service.get_farmer_orders(current_user.id, status)
    elif current_user.role in ['individual', 'business']:
        orders = service.get_customer_orders(current_user.id, status)
    else:
        raise HTTPException(status_code=403, detail="Invalid user role")

    # Convert to list items format
    result = []
    for order in orders:
        if current_user.role == 'farmer':
            # For farmer view - count only their items
            farmer_items = [item for item in order.items if item.farmer_id == current_user.id]
            result.append(UnifiedOrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=sum(item.total_price for item in farmer_items),  # Only farmer's portion
                item_count=len(farmer_items),
                created_at=order.created_at
            ))
        else:
            # For customer view
            farmer_ids = set(item.farmer_id for item in order.items)
            result.append(UnifiedOrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=order.final_amount,
                farmer_count=len(farmer_ids),
                item_count=len(order.items),
                created_at=order.created_at
            ))

    return result


@router.get("/{order_id}", response_model=UnifiedOrderResponse)
def get_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get unified order details"""
    service = OrderService(db)
    order = service.get_order_by_id(order_id, current_user.id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # For farmers, filter items to show only their products
    items = order.items
    farmer_total_amount = order.total_amount  # Default to full amount
    farmer_final_amount = order.final_amount  # Default to full amount

    if current_user.role == 'farmer':
        # Filter items for this farmer only
        items = [item for item in order.items if item.farmer_id == current_user.id]

        # Calculate farmer-specific totals
        farmer_total_amount = sum(item.total_price for item in items)

        # For final amount, we don't add delivery fee since that's shared
        # The farmer only gets paid for their items
        farmer_final_amount = farmer_total_amount

    return UnifiedOrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        total_amount=farmer_total_amount,  # Farmer's items only
        delivery_fee=0,  # Delivery fee is handled by platform
        final_amount=farmer_final_amount,  # Farmer's portion only
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_email=order.customer_email,
        delivery_address=order.delivery_address,
        delivery_notes=order.delivery_notes,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
        delivered_at=order.delivered_at
    )


@router.get("/{order_id}/farmers")
def get_order_farmers(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer information for an order (SQLite-optimized)"""

    # First, get the order and check permissions
    order = db.query(UnifiedOrder).filter(UnifiedOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get order items separately
    order_items = (
        db.query(UnifiedOrderItem)
        .filter(UnifiedOrderItem.order_id == order_id)
        .all()
    )

    # Check permissions
    farmer_ids_in_order = set(item.farmer_id for item in order_items)

    if current_user.id != order.customer_id and current_user.id not in farmer_ids_in_order:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get farmer info separately for each farmer
    farmers_info = {}
    for farmer_id in farmer_ids_in_order:
        # Query farmer and profile separately to avoid SQLite join issues
        farmer = db.query(User).filter(User.id == farmer_id).first()

        if farmer:
            # Get farmer profile separately
            farmer_profile = (
                db.query(FarmerProfile)
                .filter(FarmerProfile.user_id == farmer_id)
                .first()
            )

            if farmer_profile:
                farmer_name = f"{farmer_profile.first_name} {farmer_profile.last_name}"
                farmer_district = farmer_profile.district
            else:
                farmer_name = f"Farmer {farmer_id}"
                farmer_district = "Unknown District"
        else:
            farmer_name = f"Farmer {farmer_id}"
            farmer_district = "Unknown District"

        # Check for farmer status (if notification system is working)
        farmer_status = (
            db.query(UnifiedOrderFarmerStatus)
            .filter(
                UnifiedOrderFarmerStatus.order_id == order_id,
                UnifiedOrderFarmerStatus.farmer_id == farmer_id
            )
            .first()
        )

        status = farmer_status.status if farmer_status else "confirmed"

        farmers_info[farmer_id] = {
            "farmer_name": farmer_name,
            "farmer_district": farmer_district,
            "status": status
        }

    return {"farmers": farmers_info}


@router.put("/{order_id}/status", response_model=UnifiedOrderResponse)
def update_order_status(
        order_id: int,
        update_data: UnifiedOrderUpdateRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update unified order status - farmers can update orders containing their products"""
    service = OrderService(db)

    # Get the order first to check permissions
    order = service.get_order_by_id(order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Permission checks based on user role
    if current_user.role == 'farmer':
        # Check if farmer has items in this order
        farmer_items = [item for item in order.items if item.farmer_id == current_user.id]
        if not farmer_items:
            raise HTTPException(status_code=403, detail="You can only update orders containing your products")

        # Define which statuses farmers can set
        allowed_statuses = ['processing', 'out_for_delivery', 'delivered', 'cancelled']
        if update_data.status not in allowed_statuses:
            raise HTTPException(status_code=403, detail=f"Farmers cannot set status to {update_data.status}")

        # Prevent farmers from changing delivered/cancelled orders
        if order.status in ['delivered', 'cancelled']:
            raise HTTPException(status_code=403, detail="Cannot modify delivered or cancelled orders")

    elif current_user.role in ['admin', 'system']:
        # Admins can change any order to any status
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update order status")

    try:
        updated_order = service.update_order_status(order_id, current_user.id, update_data.status)

        # For farmers, filter items to show only their products in response
        items = updated_order.items
        if current_user.role == 'farmer':
            items = [item for item in updated_order.items if item.farmer_id == current_user.id]

        return UnifiedOrderResponse(
            id=updated_order.id,
            order_number=updated_order.order_number,
            status=updated_order.status,
            total_amount=updated_order.total_amount,
            delivery_fee=updated_order.delivery_fee,
            final_amount=updated_order.final_amount,
            customer_name=updated_order.customer_name,
            customer_phone=updated_order.customer_phone,
            customer_email=updated_order.customer_email,
            delivery_address=updated_order.delivery_address,
            delivery_notes=updated_order.delivery_notes,
            items=items,
            created_at=updated_order.created_at,
            updated_at=updated_order.updated_at,
            delivered_at=updated_order.delivered_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# FARMER-SPECIFIC ENDPOINTS
# ==========================================

@router.get("/farmer/orders/summary", response_model=FarmerOrderSummary)
def get_farmer_order_summary(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get order summary for farmer dashboard"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_order_summary(current_user.id)


@router.get("/farmer/earnings")
def get_farmer_earnings(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get detailed farmer earnings (uses Stripe service for detailed breakdown)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can view earnings")

    # Import here to avoid circular imports
    from services.stripe_service import StripePaymentService

    service = StripePaymentService(db)
    return service.get_farmer_earnings_summary(current_user.id)


@router.get("/farmer/sales/{period}")
def get_farmer_sales_for_period(
        period: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer sales count for specific time period"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_sales_for_period(current_user.id, period)


@router.get("/farmer/revenue/{period}")
def get_farmer_revenue_for_period(
        period: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer revenue for specific time period"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_revenue_for_period(current_user.id, period)



###################################


# routes/payments.py - UNIFIED SYSTEM ONLY
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from services.stripe_service import StripePaymentService, handle_stripe_webhook
from core.security import get_current_user, get_db
from models.order import UnifiedOrder, UnifiedPayment
import json

router = APIRouter()


# Request/Response Models
class PaymentIntentRequest(BaseModel):
    amount: int  # Amount in cents
    currency: str = "mur"
    cart_id: int
    delivery_info: dict


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str


class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str
    delivery_info: dict
    payment_method_type: str = "stripe_card"


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
def create_payment_intent(
        request: PaymentIntentRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Create a Stripe payment intent for checkout"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can create payments")

    try:
        service = StripePaymentService(db)
        result = service.create_payment_intent(
            user_id=current_user.id,
            cart_id=request.cart_id,
            delivery_info=request.delivery_info,
            amount_cents=request.amount
        )

        return PaymentIntentResponse(
            client_secret=result['client_secret'],
            payment_intent_id=result['payment_intent_id']
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm-payment")
def confirm_payment(
        request: ConfirmPaymentRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Confirm payment and create unified order after successful Stripe payment"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can confirm payments")

    try:
        service = StripePaymentService(db)
        result = service.confirm_payment_and_create_order(
            user_id=current_user.id,
            payment_intent_id=request.payment_intent_id,
            delivery_info=request.delivery_info,
            payment_method_type=request.payment_method_type
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders/{order_id}")
def get_unified_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get unified order details"""
    order = (
        db.query(UnifiedOrder)
        .filter(
            UnifiedOrder.id == order_id,
            UnifiedOrder.customer_id == current_user.id
        )
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Group items by farmer for display
    farmer_groups = {}
    for item in order.items:
        farmer_id = item.farmer_id
        if farmer_id not in farmer_groups:
            farmer = item.farmer
            farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}"
            farmer_groups[farmer_id] = {
                'farmer_id': farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer.farmer_profile.district,
                'items': [],
                'subtotal': 0
            }

        farmer_groups[farmer_id]['items'].append({
            'item_name': item.item_name,
            'unit': item.unit,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price),
            'total_price': float(item.total_price),
            'description': item.product_description
        })
        farmer_groups[farmer_id]['subtotal'] += float(item.total_price)

    return {
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'total_amount': float(order.total_amount),
        'delivery_fee': float(order.delivery_fee),
        'final_amount': float(order.final_amount),
        'customer_name': order.customer_name,
        'customer_phone': order.customer_phone,
        'delivery_address': order.delivery_address,
        'delivery_notes': order.delivery_notes,
        'farmer_groups': list(farmer_groups.values()),
        'payment': {
            'method': order.payment.payment_method if order.payment else None,
            'status': order.payment.status if order.payment else None,
            'completed_at': order.payment.completed_at.isoformat() if order.payment and order.payment.completed_at else None
        },
        'created_at': order.created_at.isoformat(),
        'updated_at': order.updated_at.isoformat()
    }


@router.get("/orders")
def get_customer_orders(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get customer's unified orders"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can view orders")

    orders = (
        db.query(UnifiedOrder)
        .filter(UnifiedOrder.customer_id == current_user.id)
        .order_by(UnifiedOrder.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        # Count farmers and items
        farmer_ids = set(item.farmer_id for item in order.items)

        result.append({
            'id': order.id,
            'order_number': order.order_number,
            'status': order.status,
            'final_amount': float(order.final_amount),
            'farmer_count': len(farmer_ids),
            'item_count': len(order.items),
            'created_at': order.created_at.isoformat()
        })

    return result


@router.get("/farmer/earnings")
def get_farmer_earnings(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer earnings summary"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can view earnings")

    service = StripePaymentService(db)
    return service.get_farmer_earnings_summary(current_user.id)


@router.post("/refund/{order_id}")
def process_refund(
        order_id: int,
        amount_cents: Optional[int] = None,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Process refund for an order (admin only in production)"""
    # In production, add proper admin role check
    try:
        service = StripePaymentService(db)
        result = service.process_refund(order_id, amount_cents)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(
        request: Request,
        stripe_signature: str = Header(None, alias="stripe-signature")
):
    """Handle Stripe webhook events"""
    try:
        payload = await request.body()
        event_data = json.loads(payload)

        result = handle_stripe_webhook(event_data, stripe_signature)
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")


###################################


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from schemas.product import (
    FarmerProductCreate, FarmerProductUpdate, FarmerProductResponse,
    ProductUnitPriceCreate, ProductUnitPriceUpdate, ProductUnitPriceResponse,
    AvailableItemsResponse, ProductListItem
)
from models.product import CategoryEnum, ItemEnum, UnitEnum, FarmerProduct
from services.product_service import (
    get_available_items, create_farmer_product, get_farmer_products,
    update_farmer_product, add_unit_price, update_unit_price,
    get_all_products, delete_farmer_product
)
from core.security import get_current_user, get_db

router = APIRouter()


# Get available items for product creation
@router.get("/items", response_model=AvailableItemsResponse)
def get_available_items_endpoint():
    """Get all available fruits and vegetables that farmers can list"""
    items = get_available_items()
    return AvailableItemsResponse(
        fruits=items["fruits"],
        vegetables=items["vegetables"]
    )


# Get available units
@router.get("/units", response_model=List[str])
def get_available_units():
    """Get all available units for pricing"""
    return [unit.value for unit in UnitEnum]


# Create a new farmer product
@router.post("", response_model=FarmerProductResponse)
def create_product(
        product_data: FarmerProductCreate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Create a new product listing (farmers only)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can create products")

    try:
        product = create_farmer_product(db, current_user.id, product_data)

        # Add the computed category field
        from models.product import get_item_category
        product.category = get_item_category(product.item)

        return product
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Get farmer's own products
@router.get("/my", response_model=List[FarmerProductResponse])
def get_my_products(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get all products listed by the current farmer"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    products = get_farmer_products(db, current_user.id)

    # Add category to each product for response
    for product in products:
        from models.product import get_item_category
        product.category = get_item_category(product.item)

    return products


# Get all products (browse/search)
@router.get("", response_model=List[ProductListItem])
def browse_products(
        category: Optional[CategoryEnum] = Query(None, description="Filter by category"),
        item: Optional[ItemEnum] = Query(None, description="Filter by specific item"),
        district: Optional[str] = Query(None, description="Filter by farmer's district"),
        db: Session = Depends(get_db)
):
    """Browse all available products with optional filtering"""
    products = get_all_products(db, category=category, item=item, district=district)

    result = []
    for product in products:
        from models.product import get_item_category

        # Get farmer name from profile
        farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
        farmer_district = product.farmer.farmer_profile.district

        result.append(ProductListItem(
            id=product.id,
            item=product.item,
            category=get_item_category(product.item),
            is_active=product.is_active,
            farmer_name=farmer_name,
            farmer_district=farmer_district,
            unit_prices=product.unit_prices,
            description=product.description
        ))

    return result


# Get specific product details
@router.get("/{product_id}", response_model=FarmerProductResponse)
def get_product(
        product_id: int,
        db: Session = Depends(get_db)
):
    """Get detailed information about a specific product"""
    from sqlalchemy.orm import joinedload

    product = (
        db.query(FarmerProduct)
        .options(joinedload(FarmerProduct.unit_prices))
        .filter(FarmerProduct.id == product_id, FarmerProduct.is_active == True)
        .first()
    )

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from models.product import get_item_category
    product.category = get_item_category(product.item)

    return product


# Update farmer product
@router.put("/{product_id}", response_model=FarmerProductResponse)
def update_product(
        product_id: int,
        update_data: FarmerProductUpdate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update a farmer's product (farmers only, own products only)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can update products")

    try:
        product = update_farmer_product(db, product_id, current_user.id, update_data)
        from models.product import get_item_category
        product.category = get_item_category(product.item)
        return product
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Delete farmer product
@router.delete("/{product_id}")
def delete_product(
        product_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Delete a farmer's product (farmers only, own products only)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can delete products")

    success = delete_farmer_product(db, product_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")

    return {"message": "Product deleted successfully"}


# Add unit price to existing product
@router.post("/{product_id}/unit-prices", response_model=ProductUnitPriceResponse)
def add_product_unit_price(
        product_id: int,
        unit_price_data: ProductUnitPriceCreate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Add a new unit price to an existing product"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can add unit prices")

    try:
        unit_price = add_unit_price(db, product_id, current_user.id, unit_price_data)
        return unit_price
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Update unit price
@router.put("/unit-prices/{unit_price_id}", response_model=ProductUnitPriceResponse)
def update_product_unit_price(
        unit_price_id: int,
        update_data: ProductUnitPriceUpdate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update an existing unit price"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can update unit prices")

    try:
        unit_price = update_unit_price(db, unit_price_id, current_user.id, update_data)
        return unit_price
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Delete unit price
@router.delete("/unit-prices/{unit_price_id}")
def delete_product_unit_price(
        unit_price_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Delete a unit price from a product"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can delete unit prices")

    from models.product import ProductUnitPrice, FarmerProduct

    unit_price = (
        db.query(ProductUnitPrice)
        .join(FarmerProduct)
        .filter(
            ProductUnitPrice.id == unit_price_id,
            FarmerProduct.farmer_id == current_user.id
        )
        .first()
    )

    if not unit_price:
        raise HTTPException(status_code=404, detail="Unit price not found")

    # Check if this is the last unit price for the product
    remaining_prices = (
        db.query(ProductUnitPrice)
        .filter(
            ProductUnitPrice.farmer_product_id == unit_price.farmer_product_id,
            ProductUnitPrice.id != unit_price_id
        )
        .count()
    )

    if remaining_prices == 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last unit price. A product must have at least one unit price."
        )

    db.delete(unit_price)
    db.commit()

    return {"message": "Unit price deleted successfully"}


# Get products by category (convenience endpoint)
@router.get("/category/{category}", response_model=List[ProductListItem])
def get_products_by_category(
        category: CategoryEnum,
        district: Optional[str] = Query(None, description="Filter by farmer's district"),
        db: Session = Depends(get_db)
):
    """Get all products in a specific category"""
    return browse_products(category=category, district=district, db=db)


###################################


# schemas/order.py - UNIFIED SYSTEM ONLY
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from models.order import OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum


# ==========================================
# CART SCHEMAS
# ==========================================

class CartItemBase(BaseModel):
    farmer_product_id: int
    unit_price_id: int
    quantity: float

    @validator('quantity')
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError('Quantity must be greater than 0')
        return v


class CartItemCreate(CartItemBase):
    pass


class CartItemUpdate(BaseModel):
    quantity: Optional[float] = None

    @validator('quantity')
    def validate_quantity(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Quantity must be greater than 0')
        return v


class CartItemResponse(CartItemBase):
    id: int
    unit_price_snapshot: Decimal
    total_price: Decimal
    created_at: datetime

    # Product information (added dynamically by OrderService)
    product_name: Optional[str] = None
    unit_name: Optional[str] = None
    farmer_name: Optional[str] = None

    class Config:
        from_attributes = True


class CartFarmerGroup(BaseModel):
    farmer_id: int
    farmer_name: str
    farmer_district: str
    items: List[CartItemResponse]
    subtotal: Decimal


class CartResponse(BaseModel):
    id: Optional[int]
    farmer_groups: List[CartFarmerGroup]
    total_amount: Decimal
    total_items: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================================
# UNIFIED ORDER SCHEMAS
# ==========================================

class UnifiedOrderItemResponse(BaseModel):
    id: int
    farmer_id: int
    item_name: str
    unit: str
    unit_price: Decimal
    quantity: float
    total_price: Decimal
    product_description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UnifiedOrderResponse(BaseModel):
    id: int
    order_number: str
    status: OrderStatusEnum
    total_amount: Decimal
    delivery_fee: Decimal
    final_amount: Decimal

    customer_name: str
    customer_phone: str
    customer_email: str

    delivery_address: str
    delivery_notes: Optional[str]

    items: List[UnifiedOrderItemResponse]

    created_at: datetime
    updated_at: datetime
    delivered_at: Optional[datetime]

    class Config:
        from_attributes = True


class UnifiedOrderListItem(BaseModel):
    id: int
    order_number: str
    status: OrderStatusEnum
    final_amount: Decimal
    farmer_count: Optional[int] = None  # For customer view
    item_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class UnifiedOrderUpdateRequest(BaseModel):
    status: OrderStatusEnum


# ==========================================
# PAYMENT SCHEMAS
# ==========================================

class UnifiedPaymentResponse(BaseModel):
    id: int
    payment_method: PaymentMethodEnum
    status: PaymentStatusEnum
    amount: Decimal
    currency: str
    stripe_payment_intent_id: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================================
# FARMER PAYMENT SCHEMAS
# ==========================================

class FarmerPaymentResponse(BaseModel):
    id: int
    farmer_id: int
    gross_amount: Decimal
    platform_fee: Decimal
    net_amount: Decimal
    platform_fee_percentage: float
    payment_status: str
    paid_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# FARMER DASHBOARD SCHEMAS
# ==========================================

class FarmerOrderSummary(BaseModel):
    total_orders: int
    confirmed_orders: int
    processing_orders: int
    out_for_delivery_orders: int
    delivered_orders: int
    total_gross_revenue: float
    total_net_revenue: float
    pending_revenue: float


# ==========================================
# LEGACY COMPATIBILITY (if needed for migration)
# ==========================================

# You can add these if you need backwards compatibility during migration
class OrderCreateRequest(BaseModel):
    """Legacy order create - now redirects to cart-based checkout"""
    farmer_id: int
    delivery_address: str
    delivery_notes: Optional[str] = None
    payment_method: PaymentMethodEnum

    @validator('delivery_address')
    def validate_delivery_address(cls, v):
        if not v or not v.strip():
            raise ValueError('Delivery address is required')
        return v.strip()


###################################


from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
from models.product import CategoryEnum, UnitEnum, ItemEnum, CustomerTypeEnum


class ProductUnitPriceBase(BaseModel):
    unit: UnitEnum
    customer_type: CustomerTypeEnum  # NEW: Required field
    price_per_unit: float
    quantity_available: float
    minimum_order: float = 1.0


class ProductUnitPriceCreate(ProductUnitPriceBase):
    pass


class ProductUnitPriceUpdate(BaseModel):
    price_per_unit: Optional[float] = None
    quantity_available: Optional[float] = None
    minimum_order: Optional[float] = None
    # Note: customer_type should not be updatable after creation


class ProductUnitPriceResponse(ProductUnitPriceBase):
    id: int

    class Config:
        from_attributes = True


class FarmerProductBase(BaseModel):
    item: ItemEnum
    description: Optional[str] = None
    harvest_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class FarmerProductCreate(FarmerProductBase):
    unit_prices: List[ProductUnitPriceCreate]  # At least one unit price required


class FarmerProductUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None
    harvest_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class FarmerProductResponse(FarmerProductBase):
    id: int
    farmer_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    unit_prices: List[ProductUnitPriceResponse]
    category: Optional[CategoryEnum] = None  # Make it optional

    class Config:
        from_attributes = True

    def __init__(self, **data):
        # Auto-compute category if not provided
        if 'category' not in data and 'item' in data:
            from models.product import get_item_category
            data['category'] = get_item_category(data['item'])
        super().__init__(**data)


class ItemsByCategory(BaseModel):
    category: CategoryEnum
    items: List[ItemEnum]


class AvailableItemsResponse(BaseModel):
    fruits: List[ItemEnum]
    vegetables: List[ItemEnum]


# For browsing/filtering
class ProductListItem(BaseModel):
    id: int
    item: ItemEnum
    category: CategoryEnum
    is_active: bool
    farmer_name: str
    farmer_district: str
    unit_prices: List[ProductUnitPriceResponse]
    description: Optional[str]

    class Config:
        from_attributes = True


###################################


from pydantic import BaseModel, EmailStr
from typing import Optional

# Base response schema for User
class UserResponseBase(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True

# Profile details for responses
class FarmerProfileResponse(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    district: str

    class Config:
        from_attributes = True

class IndividualProfileResponse(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    phone_number: str
    street: str
    city_town: str
    post_code: str

    class Config:
        from_attributes = True

class BusinessProfileResponse(BaseModel):
    business_name: str
    contact_name: str
    phone_number: str
    street: str
    city_town: str
    post_code: str

    class Config:
        from_attributes = True

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

class FarmerProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    district: Optional[str] = None

class IndividualProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone_number: Optional[str] = None
    street: Optional[str] = None
    city_town: Optional[str] = None
    post_code: Optional[str] = None

class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    contact_name: Optional[str] = None
    phone_number: Optional[str] = None
    street: Optional[str] = None
    city_town: Optional[str] = None
    post_code: Optional[str] = None


###################################


from sqlalchemy.orm import Session
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from core.security import get_password_hash
from schemas.user import FarmerCreate, IndividualCreate, BusinessCreate

def create_user_with_profile(db: Session, user_create):
    # Hash the password
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


###################################


# services/browse_service.py - Updated with ML Recommendations
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct, desc, and_
from models.user import User, FarmerProfile
from models.product import FarmerProduct, ProductUnitPrice, CategoryEnum, ItemEnum, get_item_category
from typing import List, Optional, Dict
from decimal import Decimal
from services.recommendation_service import MLRecommendationService


class BrowseService:
    def __init__(self, db: Session):
        self.db = db
        self.recommendation_service = MLRecommendationService(db)

    def get_featured_farmers(self, district: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Get featured farmers with most products for homepage"""
        query = (
            self.db.query(
                User.id,
                FarmerProfile.first_name,
                FarmerProfile.last_name,
                FarmerProfile.district,
                func.count(distinct(FarmerProduct.id)).label('product_count')
            )
            .join(FarmerProfile, User.id == FarmerProfile.user_id)
            .join(FarmerProduct, User.id == FarmerProduct.farmer_id)
            .filter(
                User.role == 'farmer',
                FarmerProduct.is_active == True
            )
            .group_by(User.id, FarmerProfile.first_name, FarmerProfile.last_name, FarmerProfile.district)
            .having(func.count(distinct(FarmerProduct.id)) > 0)
            .order_by(desc('product_count'))
        )

        if district:
            query = query.filter(FarmerProfile.district.ilike(f"%{district}%"))

        farmers = query.limit(limit).all()

        result = []
        for farmer in farmers:
            result.append({
                'id': farmer.id,
                'name': f"{farmer.first_name} {farmer.last_name}",
                'district': farmer.district,
                'product_count': farmer.product_count
            })

        return result

    def get_latest_products(self, limit: int = 20) -> List[Dict]:
        """Get latest products from all farmers"""
        products = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(FarmerProduct.is_active == True)
            .order_by(FarmerProduct.created_at.desc())
            .limit(limit)
            .all()
        )

        result = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            result.append({
                'id': product.id,
                'item': product.item.value,  # Convert enum to string
                'category': get_item_category(product.item).value,  # Convert enum to string
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,  # Convert enum to string
                        'customer_type': up.customer_type.value,  # ADDED: Include customer_type
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()  # Convert to string
            })

        return result

    def get_personalized_recommendations(self, user_id: int, customer_type: str) -> Dict:
        """
        Get personalized product recommendations using ML

        Args:
            user_id: The customer's user ID
            customer_type: 'individual' or 'business'

        Returns:
            Dict with recommendations and metadata
        """
        try:
            recommendations = self.recommendation_service.get_recommendations_for_user(user_id, customer_type)

            # Check if user has purchase history for messaging
            from models.order import UnifiedOrder
            user_orders = (
                self.db.query(UnifiedOrder)
                .filter(
                    UnifiedOrder.customer_id == user_id,
                    UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
                )
                .count()
            )

            has_purchase_history = user_orders > 1

            return {
                'recommendations': recommendations,
                'has_purchase_history': has_purchase_history,
                'total_recommendations': len(recommendations),
                'message': self._get_recommendation_message(has_purchase_history, customer_type)
            }

        except Exception as e:
            print(f"Error getting personalized recommendations: {e}")
            return {
                'recommendations': [],
                'has_purchase_history': False,
                'total_recommendations': 0,
                'message': self._get_recommendation_message(False, customer_type)
            }

    def _get_recommendation_message(self, has_purchase_history: bool, customer_type: str) -> str:
        """Get appropriate message for recommendation section"""
        if not has_purchase_history:
            if customer_type == 'business':
                return "Start ordering to see personalized business recommendations that match your purchasing patterns and help streamline your supply chain."
            else:
                return "Start exploring and ordering to see personalized recommendations that match your taste preferences and cooking habits."
        else:
            if customer_type == 'business':
                return "Based on your ordering history and similar businesses, here are products that might interest you."
            else:
                return "Based on your purchase history and taste preferences, here are fresh products you might enjoy."

    def search_products(
            self,
            search_term: Optional[str] = None,
            category: Optional[CategoryEnum] = None,
            district: Optional[str] = None,
            min_price: Optional[float] = None,
            max_price: Optional[float] = None,
            limit: int = 50,
            offset: int = 0
    ) -> Dict:
        """Search and filter products"""
        query = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(FarmerProduct.is_active == True)
        )

        # Apply filters
        if search_term:
            # Search in item name and description
            search_filter = f"%{search_term.lower()}%"
            query = query.filter(
                FarmerProduct.item.like(search_filter) |
                FarmerProduct.description.ilike(search_filter)
            )

        if category:
            category_items = [item for item in ItemEnum if get_item_category(item) == category]
            query = query.filter(FarmerProduct.item.in_(category_items))

        if district:
            query = query.join(User, FarmerProduct.farmer_id == User.id)
            query = query.join(FarmerProfile, User.id == FarmerProfile.user_id)
            query = query.filter(FarmerProfile.district.ilike(f"%{district}%"))

        # For price filtering, we need to join with unit prices
        if min_price is not None or max_price is not None:
            query = query.join(ProductUnitPrice)
            if min_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit >= min_price)
            if max_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit <= max_price)

        # Get total count for pagination
        total = query.count()

        # Apply pagination and ordering
        products = (
            query.distinct(FarmerProduct.id)
            .order_by(FarmerProduct.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        # Format results
        items = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            items.append({
                'id': product.id,
                'item': product.item.value,  # Convert enum to string
                'category': get_item_category(product.item).value,  # Convert enum to string
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,  # Convert enum to string
                        'customer_type': up.customer_type.value,  # ADDED: Include customer_type
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()  # Convert to string
            })

        return {
            'items': items,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_next': offset + limit < total,
            'has_prev': offset > 0
        }

    def get_farmer_details_with_products(self, farmer_id: int) -> Optional[Dict]:
        """Get farmer details with all their products"""
        farmer = (
            self.db.query(User)
            .options(joinedload(User.farmer_profile))
            .filter(User.id == farmer_id, User.role == 'farmer')
            .first()
        )

        if not farmer:
            return None

        # Get farmer's active products
        products = (
            self.db.query(FarmerProduct)
            .options(joinedload(FarmerProduct.unit_prices))
            .filter(
                FarmerProduct.farmer_id == farmer_id,
                FarmerProduct.is_active == True
            )
            .order_by(FarmerProduct.created_at.desc())
            .all()
        )

        product_list = []
        for product in products:
            product_list.append({
                'id': product.id,
                'item': product.item.value,  # Convert enum to string
                'category': get_item_category(product.item).value,  # Convert enum to string
                'description': product.description,
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,  # Convert enum to string
                        'customer_type': up.customer_type.value,  # ADDED: Include customer_type
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()  # Convert to string
            })

        return {
            'id': farmer.id,
            'name': f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}",
            'district': farmer.farmer_profile.district,
            'phone': farmer.farmer_profile.phone_number,
            'email': farmer.email,
            'products': product_list,
            'product_count': len(product_list)
        }

    def get_categories_with_counts(self) -> List[Dict]:
        """Get product categories with item counts"""
        # Get all active products grouped by category
        products = (
            self.db.query(FarmerProduct.item, func.count(FarmerProduct.id).label('count'))
            .filter(FarmerProduct.is_active == True)
            .group_by(FarmerProduct.item)
            .all()
        )

        # Group by category
        categories = {}
        for item, count in products:
            category = get_item_category(item)
            if category not in categories:
                categories[category] = {
                    'name': category.value,  # Convert enum to string
                    'total_products': 0,
                    'items': []
                }

            categories[category]['total_products'] += count
            categories[category]['items'].append({
                'item': item.value,  # Convert enum to string
                'count': count
            })

        return list(categories.values())

    def get_districts_with_counts(self) -> List[Dict]:
        """Get districts with farmer counts"""
        districts = (
            self.db.query(
                FarmerProfile.district,
                func.count(distinct(User.id)).label('farmer_count'),
                func.count(distinct(FarmerProduct.id)).label('product_count')
            )
            .join(User, FarmerProfile.user_id == User.id)
            .join(FarmerProduct, User.id == FarmerProduct.farmer_id)
            .filter(
                User.role == 'farmer',
                FarmerProduct.is_active == True
            )
            .group_by(FarmerProfile.district)
            .order_by(desc('farmer_count'))
            .all()
        )

        result = []
        for district in districts:
            result.append({
                'district': district.district,
                'farmer_count': district.farmer_count,
                'product_count': district.product_count
            })

        return result


###################################


# services/notification_service.py
import requests
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models.notification import DeviceToken, Notification, NotificationTypeEnum, UnifiedOrderFarmerStatus
from models.order import UnifiedOrder, UnifiedOrderItem
from models.user import User
from datetime import datetime
import os


class PushNotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.expo_push_url = "https://exp.host/--/api/v2/push/send"

    def register_device_token(self, user_id: int, expo_push_token: str, device_id: str, platform: str) -> DeviceToken:
        """Register or update device token for user"""

        # Check if token already exists for this device
        existing_token = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.device_id == device_id
            )
            .first()
        )

        if existing_token:
            # Update existing token
            existing_token.expo_push_token = expo_push_token
            existing_token.platform = platform
            existing_token.is_active = True
            existing_token.updated_at = datetime.utcnow()
            self.db.commit()
            return existing_token
        else:
            # Create new token
            device_token = DeviceToken(
                user_id=user_id,
                expo_push_token=expo_push_token,
                device_id=device_id,
                platform=platform
            )
            self.db.add(device_token)
            self.db.commit()
            return device_token

    def send_push_notification(self, expo_push_tokens: List[str], title: str, message: str, data: Dict = None) -> bool:
        """Send push notification via Expo Push API"""

        if not expo_push_tokens:
            return False

        messages = []
        for token in expo_push_tokens:
            message_data = {
                "to": token,
                "title": title,
                "body": message,
                "sound": "default",
                "data": data or {}
            }
            messages.append(message_data)

        try:
            response = requests.post(
                self.expo_push_url,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                data=json.dumps(messages)
            )

            if response.status_code == 200:
                response_data = response.json()
                # Check for any errors in the response
                for i, receipt in enumerate(response_data.get('data', [])):
                    if receipt.get('status') == 'error':
                        print(f"Push notification error for token {expo_push_tokens[i]}: {receipt.get('message')}")
                        # You might want to mark the token as invalid here

                return True
            else:
                print(f"Failed to send push notification: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Error sending push notification: {str(e)}")
            return False

    def create_and_send_notification(
            self,
            user_id: int,
            notification_type: NotificationTypeEnum,
            title: str,
            message: str,
            order_id: Optional[int] = None,
            farmer_id: Optional[int] = None,
            data: Optional[Dict] = None
    ) -> Notification:
        """Create notification record and send push notification - SQLite optimized"""

        # Create notification record
        notification = Notification(
            user_id=user_id,
            order_id=order_id,
            farmer_id=farmer_id,
            type=notification_type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None
        )
        self.db.add(notification)

        # Get user's device tokens separately (SQLite-friendly)
        device_tokens = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active == True
            )
            .all()
        )

        expo_tokens = [token.expo_push_token for token in device_tokens]
        print(f"Found {len(expo_tokens)} device tokens for user {user_id}")

        # Send push notification
        if expo_tokens:
            success = self.send_push_notification(
                expo_tokens,
                title,
                message,
                {
                    "order_id": order_id,
                    "farmer_id": farmer_id,
                    "type": notification_type.value,
                    **(data or {})
                }
            )

            if success:
                notification.is_sent = True
                notification.sent_at = datetime.utcnow()
                print(f"Push notification sent successfully to user {user_id}")
            else:
                print(f"Failed to send push notification to user {user_id}")
        else:
            print(f"No device tokens found for user {user_id}")

        # Commit this notification separately
        self.db.flush()  # Use flush instead of commit to keep transaction open
        return notification

    def notify_new_order_to_farmers(self, order: UnifiedOrder):
        """Send notifications to all farmers when a new order is created"""

        # Get unique farmer IDs from order items
        farmer_ids = set(item.farmer_id for item in order.items)
        print(f"Processing order {order.id}, farmer IDs: {farmer_ids}")

        for farmer_id in farmer_ids:
            # Get farmer's items for this order
            farmer_items = [item for item in order.items if item.farmer_id == farmer_id]
            item_count = len(farmer_items)
            total_amount = sum(item.total_price for item in farmer_items)

            print(f"Farmer {farmer_id}: {item_count} items, total: {total_amount}")

            # Create farmer status record - THIS IS IMPORTANT!
            existing_status = (
                self.db.query(UnifiedOrderFarmerStatus)
                .filter(
                    UnifiedOrderFarmerStatus.order_id == order.id,
                    UnifiedOrderFarmerStatus.farmer_id == farmer_id
                )
                .first()
            )

            if not existing_status:
                farmer_status = UnifiedOrderFarmerStatus(
                    order_id=order.id,
                    farmer_id=farmer_id,
                    status="confirmed"
                )
                self.db.add(farmer_status)
                print(f"Created farmer status record for farmer {farmer_id}")
            else:
                print(f"Farmer status record already exists for farmer {farmer_id}")

            # Send notification to farmer
            title = "New Order Received!"
            message = f"Order #{order.order_number} - {item_count} items, Rs {total_amount:.2f}"

            # Create notification record
            notification = Notification(
                user_id=farmer_id,
                order_id=order.id,
                farmer_id=None,  # This is sent TO the farmer, not FROM them
                type=NotificationTypeEnum.ORDER_CREATED,
                title=title,
                message=message,
                data=json.dumps({
                    "order_number": order.order_number,
                    "item_count": item_count,
                    "amount": float(total_amount)
                })
            )
            self.db.add(notification)
            print(f"Created notification for farmer {farmer_id}")

            # Get device tokens for push notification
            device_tokens = (
                self.db.query(DeviceToken)
                .filter(
                    DeviceToken.user_id == farmer_id,
                    DeviceToken.is_active == True
                )
                .all()
            )

            expo_tokens = [token.expo_push_token for token in device_tokens]
            print(f"Found {len(expo_tokens)} device tokens for farmer {farmer_id}")

            # Send push notification
            if expo_tokens:
                success = self.send_push_notification(
                    expo_tokens,
                    title,
                    message,
                    {
                        "order_id": order.id,
                        "farmer_id": farmer_id,
                        "type": NotificationTypeEnum.ORDER_CREATED.value,
                        "order_number": order.order_number,
                        "item_count": item_count,
                        "amount": float(total_amount)
                    }
                )

                if success:
                    notification.is_sent = True
                    notification.sent_at = datetime.utcnow()
                    print(f"Push notification sent successfully to farmer {farmer_id}")
                else:
                    print(f"Failed to send push notification to farmer {farmer_id}")
            else:
                print(f"No device tokens found for farmer {farmer_id}")

        # Commit everything at once
        try:
            self.db.commit()
            print(f"Successfully committed notifications for order {order.id}")
        except Exception as e:
            print(f"Error committing notifications: {e}")
            self.db.rollback()
            raise

        # Debug: Check what was actually created AFTER commit
        notifications = (
            self.db.query(Notification)
            .filter(Notification.order_id == order.id)
            .all()
        )
        print(f"Total notifications in DB for order {order.id}: {len(notifications)}")

        farmer_statuses = (
            self.db.query(UnifiedOrderFarmerStatus)
            .filter(UnifiedOrderFarmerStatus.order_id == order.id)
            .all()
        )
        print(f"Total farmer status records in DB for order {order.id}: {len(farmer_statuses)}")

        # If still zero, there's a transaction issue
        if len(notifications) == 0 and len(farmer_ids) > 0:
            print("WARNING: Notifications were not saved to database!")
        if len(farmer_statuses) == 0 and len(farmer_ids) > 0:
            print("WARNING: Farmer status records were not saved to database!")

    def notify_order_status_change(self, order: UnifiedOrder, farmer_id: int, new_status: str, old_status: str):
        """Send notification to customer when farmer changes order status"""

        # Get farmer info
        farmer = self.db.query(User).get(farmer_id)
        farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}" if farmer and farmer.farmer_profile else "Farmer"

        # Update farmer status record
        farmer_status = (
            self.db.query(UnifiedOrderFarmerStatus)
            .filter(
                UnifiedOrderFarmerStatus.order_id == order.id,
                UnifiedOrderFarmerStatus.farmer_id == farmer_id
            )
            .first()
        )

        if farmer_status:
            farmer_status.status = new_status
            farmer_status.status_changed_at = datetime.utcnow()

        # Create notification message based on status
        status_messages = {
            "processing": f"{farmer_name} is preparing your items",
            "out_for_delivery": f"{farmer_name}'s items are out for delivery",
            "delivered": f"{farmer_name}'s items have been delivered!",
            "cancelled": f"{farmer_name} has cancelled their items"
        }

        if new_status in status_messages:
            title = f"Order Update - #{order.order_number}"
            message = status_messages[new_status]

            self.create_and_send_notification(
                user_id=order.customer_id,
                notification_type=NotificationTypeEnum.ORDER_STATUS_CHANGED,
                title=title,
                message=message,
                order_id=order.id,
                farmer_id=farmer_id,
                data={
                    "order_number": order.order_number,
                    "farmer_name": farmer_name,
                    "new_status": new_status,
                    "old_status": old_status
                }
            )

        self.db.commit()

    def get_user_notifications(self, user_id: int, limit: int = 50, offset: int = 0) -> List[Notification]:
        """Get notifications for user"""
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def mark_notification_as_read(self, notification_id: int, user_id: int) -> bool:
        """Mark notification as read"""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
            .first()
        )

        if notification and not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            self.db.commit()
            return True

        return False

    def mark_all_notifications_as_read(self, user_id: int) -> int:
        """Mark all notifications as read for user"""
        updated_count = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .update({
                "is_read": True,
                "read_at": datetime.utcnow()
            })
        )
        self.db.commit()
        return updated_count

    def get_unread_count(self, user_id: int) -> int:
        """Get count of unread notifications for user"""
        return (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .count()
        )

    def get_order_farmer_statuses(self, order_id: int) -> Dict[int, str]:
        """Get farmer statuses for an order"""
        statuses = (
            self.db.query(UnifiedOrderFarmerStatus)
            .filter(UnifiedOrderFarmerStatus.order_id == order_id)
            .all()
        )

        return {status.farmer_id: status.status for status in statuses}


###################################


# services/order_service.py - UNIFIED SYSTEM ONLY
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, text
from models.order import Cart, CartItem, UnifiedOrder, UnifiedOrderItem, UnifiedPayment, OrderStatusEnum, FarmerPayment
from models.product import FarmerProduct, ProductUnitPrice
from models.user import User
from schemas.order import CartItemCreate, CartItemUpdate
from typing import List, Optional, Dict, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from services.notification_service import PushNotificationService


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.notification_service = PushNotificationService(db)

    # ==========================================
    # CART MANAGEMENT
    # ==========================================

    def get_or_create_cart(self, user_id: int) -> Cart:
        """Get existing cart or create new one for user"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            cart = Cart(user_id=user_id)
            self.db.add(cart)
            self.db.commit()
            self.db.refresh(cart)
        return cart

    def add_to_cart(self, user_id: int, item_data: CartItemCreate) -> CartItem:
        """Add item to cart or update quantity if already exists"""
        cart = self.get_or_create_cart(user_id)

        # Validate product and unit price
        unit_price = (
            self.db.query(ProductUnitPrice)
            .join(FarmerProduct)
            .filter(
                ProductUnitPrice.id == item_data.unit_price_id,
                FarmerProduct.id == item_data.farmer_product_id,
                FarmerProduct.is_active == True
            )
            .first()
        )

        if not unit_price:
            raise ValueError("Invalid product or unit price")

        # Check if item already in cart
        existing_item = (
            self.db.query(CartItem)
            .filter(
                CartItem.cart_id == cart.id,
                CartItem.farmer_product_id == item_data.farmer_product_id,
                CartItem.unit_price_id == item_data.unit_price_id
            )
            .first()
        )

        if existing_item:
            # Update quantity
            new_quantity = existing_item.quantity + item_data.quantity

            # Check availability
            if new_quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            existing_item.quantity = new_quantity
            existing_item.unit_price_snapshot = unit_price.price_per_unit
            self.db.commit()
            self.db.refresh(existing_item)
            return existing_item
        else:
            # Check availability
            if item_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            # Check minimum order
            if item_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            # Create new cart item
            cart_item = CartItem(
                cart_id=cart.id,
                farmer_product_id=item_data.farmer_product_id,
                unit_price_id=item_data.unit_price_id,
                quantity=item_data.quantity,
                unit_price_snapshot=unit_price.price_per_unit
            )
            self.db.add(cart_item)
            self.db.commit()
            self.db.refresh(cart_item)
            return cart_item

    def update_cart_item(self, user_id: int, cart_item_id: int, update_data: CartItemUpdate) -> CartItem:
        """Update cart item quantity"""
        cart_item = (
            self.db.query(CartItem)
            .join(Cart)
            .filter(
                CartItem.id == cart_item_id,
                Cart.user_id == user_id
            )
            .first()
        )

        if not cart_item:
            raise ValueError("Cart item not found")

        if update_data.quantity is not None:
            # Validate availability
            unit_price = self.db.query(ProductUnitPrice).get(cart_item.unit_price_id)
            if update_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            if update_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            cart_item.quantity = update_data.quantity
            cart_item.unit_price_snapshot = unit_price.price_per_unit  # Update price

        self.db.commit()
        self.db.refresh(cart_item)
        return cart_item

    def remove_from_cart(self, user_id: int, cart_item_id: int) -> bool:
        """Remove item from cart"""
        cart_item = (
            self.db.query(CartItem)
            .join(Cart)
            .filter(
                CartItem.id == cart_item_id,
                Cart.user_id == user_id
            )
            .first()
        )

        if not cart_item:
            return False

        self.db.delete(cart_item)
        self.db.commit()
        return True

    def get_cart(self, user_id: int) -> Dict:
        """Get user's cart with all items grouped by farmer"""
        cart = (
            self.db.query(Cart)
            .options(
                joinedload(Cart.items)
                .joinedload(CartItem.farmer_product)
                .joinedload(FarmerProduct.farmer)
                .joinedload(User.farmer_profile),
                joinedload(Cart.items)
                .joinedload(CartItem.unit_price)
            )
            .filter(Cart.user_id == user_id)
            .first()
        )

        if not cart or not cart.items:
            return {
                "id": cart.id if cart else None,
                "farmer_groups": [],
                "total_amount": Decimal('0'),
                "total_items": 0,
                "created_at": cart.created_at if cart else None,
                "updated_at": cart.updated_at if cart else None
            }

        # Group items by farmer
        farmer_groups = {}
        total_amount = Decimal('0')

        for item in cart.items:
            farmer_id = item.farmer_product.farmer_id
            farmer = item.farmer_product.farmer

            if farmer_id not in farmer_groups:
                farmer_groups[farmer_id] = {
                    "farmer_id": farmer_id,
                    "farmer_name": f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}",
                    "farmer_district": farmer.farmer_profile.district,
                    "items": [],
                    "subtotal": Decimal('0')
                }

            # Add product info to item
            item.product_name = item.farmer_product.item.value.replace('_', ' ').title()
            item.unit_name = item.unit_price.unit.value
            item.farmer_name = farmer_groups[farmer_id]["farmer_name"]

            farmer_groups[farmer_id]["items"].append(item)
            farmer_groups[farmer_id]["subtotal"] += item.total_price
            total_amount += item.total_price

        return {
            "id": cart.id,
            "farmer_groups": list(farmer_groups.values()),
            "total_amount": total_amount,
            "total_items": len(cart.items),
            "created_at": cart.created_at,
            "updated_at": cart.updated_at
        }

    def clear_cart(self, user_id: int) -> bool:
        """Clear all items from cart"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        self.db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        self.db.commit()
        return True

    def clear_farmer_items_from_cart(self, user_id: int, farmer_id: int) -> bool:
        """Clear items for specific farmer from cart"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        # Delete cart items for specific farmer
        self.db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.farmer_product.has(FarmerProduct.farmer_id == farmer_id)
        ).delete(synchronize_session='fetch')
        self.db.commit()
        return True

    # ==========================================
    # UNIFIED ORDER MANAGEMENT
    # ==========================================

    def get_customer_orders(self, user_id: int, status: Optional[str] = None) -> List[UnifiedOrder]:
        """Get unified orders for customer"""
        query = (
            self.db.query(UnifiedOrder)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment)
            )
            .filter(UnifiedOrder.customer_id == user_id)
        )

        if status:
            query = query.filter(UnifiedOrder.status == status)

        return query.order_by(desc(UnifiedOrder.created_at)).all()

    def get_farmer_orders(self, farmer_id: int, status: Optional[str] = None) -> List[UnifiedOrder]:
        """Get unified orders that contain items from this farmer"""
        query = (
            self.db.query(UnifiedOrder)
            .join(UnifiedOrderItem)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment)
            )
            .filter(UnifiedOrderItem.farmer_id == farmer_id)
        )

        if status:
            query = query.filter(UnifiedOrder.status == status)

        return query.order_by(desc(UnifiedOrder.created_at)).all()

    def get_order_by_id(self, order_id: int, user_id: int) -> Optional[UnifiedOrder]:
        """Get unified order by ID (customer or farmer can access)"""
        # Check if user is customer
        order = (
            self.db.query(UnifiedOrder)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment),
                joinedload(UnifiedOrder.farmer_payments)
            )
            .filter(
                UnifiedOrder.id == order_id,
                UnifiedOrder.customer_id == user_id
            )
            .first()
        )

        if order:
            return order

        # Check if user is farmer with items in this order
        order = (
            self.db.query(UnifiedOrder)
            .join(UnifiedOrderItem)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment),
                joinedload(UnifiedOrder.farmer_payments)
            )
            .filter(
                UnifiedOrder.id == order_id,
                UnifiedOrderItem.farmer_id == user_id
            )
            .first()
        )

        return order

    def update_order_status(self, order_id: int, user_id: int, new_status: str) -> UnifiedOrder:
        """Update unified order status with notifications"""
        order = (
            self.db.query(UnifiedOrder)
            .filter(UnifiedOrder.id == order_id)
            .first()
        )

        if not order:
            raise ValueError("Order not found")

        old_status = order.status

        # Update status and timestamps
        order.status = new_status

        if new_status == "delivered" and not order.delivered_at:
            order.delivered_at = datetime.utcnow()
            # Mark payment as successful when delivered
            if order.payment:
                order.payment.status = "successful"
                order.payment.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(order)

        # Send notification to customer about farmer's status change
        # Check if the user updating is a farmer
        user = self.db.query(User).get(user_id)
        if user and user.role == 'farmer':
            # Check if farmer has items in this order
            farmer_items = [item for item in order.items if item.farmer_id == user_id]
            if farmer_items:
                self.notification_service.notify_order_status_change(
                    order=order,
                    farmer_id=user_id,
                    new_status=new_status,
                    old_status=old_status
                )

        return order

    def get_farmer_order_summary(self, farmer_id: int) -> Dict:
        """Get order summary for farmer dashboard - SQLite optimized with zero handling"""

        # Initialize with zeros
        result = {
            'total_orders': 0,
            'confirmed_orders': 0,
            'processing_orders': 0,
            'out_for_delivery_orders': 0,
            'delivered_orders': 0,
            'cancelled_orders': 0,
            'total_gross_revenue': 0.0,
            'total_net_revenue': 0.0,
            'pending_revenue': 0.0
        }

        try:
            # Get farmer payment records with simple SQLite query
            farmer_payments = (
                self.db.query(FarmerPayment, UnifiedOrder.status)
                .join(UnifiedOrder, FarmerPayment.order_id == UnifiedOrder.id)
                .filter(FarmerPayment.farmer_id == farmer_id)
                .all()
            )

            # Process results in Python (SQLite-friendly)
            for payment, status in farmer_payments:
                result['total_orders'] += 1

                gross_amount = float(payment.gross_amount or 0)
                net_amount = float(payment.net_amount or 0)

                result['total_gross_revenue'] += gross_amount
                result['total_net_revenue'] += net_amount

                # Count by status
                if status == OrderStatusEnum.CONFIRMED:
                    result['confirmed_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.PROCESSING:
                    result['processing_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.OUT_FOR_DELIVERY:
                    result['out_for_delivery_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.DELIVERED:
                    result['delivered_orders'] += 1
                elif status == OrderStatusEnum.CANCELLED:
                    result['cancelled_orders'] += 1

        except Exception as e:
            print(f"Error in get_farmer_order_summary: {e}")
            # Return zeros on error

        return result

    def get_farmer_sales_for_period(self, farmer_id: int, period: str) -> Dict:
        """Get farmer sales count for specific time period - SQLite optimized"""

        try:
            # Get current date for filtering
            now = datetime.now()

            # SQLite-friendly date filtering using string comparison
            if period == 'this_week':
                start_date = (now - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'this_month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'this_year':
                start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).strftime(
                    '%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'all_time':
                date_filter = text('1=1')  # SQLite-friendly always true
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                # Specific month using SQLite strftime
                month_mapping = {
                    'january': '01', 'february': '02', 'march': '03', 'april': '04',
                    'may': '05', 'june': '06', 'july': '07', 'august': '08',
                    'september': '09', 'october': '10', 'november': '11', 'december': '12'
                }
                target_month = month_mapping[period]
                current_year = str(now.year)

                # Use SQLite strftime function
                date_filter = text(
                    f"strftime('%Y', unified_orders.created_at) = '{current_year}' AND strftime('%m', unified_orders.created_at) = '{target_month}'")
            else:
                # Default to this month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date

            # Simple SQLite-friendly query
            if period == 'all_time':
                sales_count = (
                    self.db.query(UnifiedOrder.id)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(FarmerPayment.farmer_id == farmer_id)
                    .count()
                )
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                # For month filtering, get all orders and filter in Python (SQLite-friendly)
                orders = (
                    self.db.query(UnifiedOrder.created_at)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(FarmerPayment.farmer_id == farmer_id)
                    .all()
                )

                month_mapping = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }
                target_month = month_mapping[period]
                current_year = now.year

                sales_count = 0
                for order in orders:
                    order_date = order.created_at
                    if order_date.year == current_year and order_date.month == target_month:
                        sales_count += 1
            else:
                # For other periods, use simple date comparison
                sales_count = (
                    self.db.query(UnifiedOrder.id)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(
                        FarmerPayment.farmer_id == farmer_id,
                        date_filter
                    )
                    .count()
                )

            return {'total_sales': sales_count or 0}

        except Exception as e:
            print(f"Error getting farmer sales for period {period}: {e}")
            return {'total_sales': 0}

    def get_farmer_revenue_for_period(self, farmer_id: int, period: str) -> Dict:
        """Get farmer revenue for specific time period - SQLite optimized"""

        try:
            # Get current date for filtering
            now = datetime.now()

            # Get all farmer payments first (SQLite-friendly approach)
            all_payments = (
                self.db.query(FarmerPayment, UnifiedOrder.created_at)
                .join(UnifiedOrder, FarmerPayment.order_id == UnifiedOrder.id)
                .filter(FarmerPayment.farmer_id == farmer_id)
                .all()
            )

            # Filter in Python (more reliable for SQLite)
            filtered_payments = []

            if period == 'this_week':
                start_date = now - timedelta(days=7)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]
            elif period == 'this_month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]
            elif period == 'this_year':
                current_year = now.year
                filtered_payments = [p for p, created_at in all_payments if created_at.year == current_year]
            elif period == 'all_time':
                filtered_payments = [p for p, created_at in all_payments]
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                month_mapping = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }
                target_month = month_mapping[period]
                current_year = now.year
                filtered_payments = [
                    p for p, created_at in all_payments
                    if created_at.year == current_year and created_at.month == target_month
                ]
            else:
                # Default to this month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]

            # Calculate totals in Python
            gross_revenue = sum(float(p.gross_amount or 0) for p in filtered_payments)
            net_revenue = sum(float(p.net_amount or 0) for p in filtered_payments)

            return {
                'grossRevenue': gross_revenue,
                'netRevenue': net_revenue
            }

        except Exception as e:
            print(f"Error getting farmer revenue for period {period}: {e}")
            return {
                'grossRevenue': 0.0,
                'netRevenue': 0.0
            }


###################################


from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, CategoryEnum, get_item_category
from models.user import User
from schemas.product import FarmerProductCreate, FarmerProductUpdate, ProductUnitPriceCreate, ProductUnitPriceUpdate
from typing import List, Optional, Dict


def get_available_items() -> Dict[str, List[ItemEnum]]:
    """Get all available items grouped by category"""
    fruits = [item for item in ItemEnum if get_item_category(item) == CategoryEnum.FRUITS]
    vegetables = [item for item in ItemEnum if get_item_category(item) == CategoryEnum.VEGETABLES]

    return {
        "fruits": fruits,
        "vegetables": vegetables
    }


def create_farmer_product(db: Session, farmer_id: int, product_data: FarmerProductCreate) -> FarmerProduct:
    # Check if farmer already has this item
    existing = db.query(FarmerProduct).filter(
        FarmerProduct.farmer_id == farmer_id,
        FarmerProduct.item == product_data.item
    ).first()

    if existing:
        raise Exception(f"You already have {product_data.item.value} listed. Please update the existing product.")

    # Create the main product
    db_product = FarmerProduct(
        farmer_id=farmer_id,
        item=product_data.item,
        description=product_data.description,
        harvest_date=product_data.harvest_date,
        expiry_date=product_data.expiry_date
    )
    db.add(db_product)
    db.flush()  # Get the ID without committing

    # Add unit prices - explicitly handle the new customer_type field
    for unit_price_data in product_data.unit_prices:
        db_unit_price = ProductUnitPrice(
            farmer_product_id=db_product.id,
            unit=unit_price_data.unit,
            customer_type=unit_price_data.customer_type,  # NEW: Explicitly include customer_type
            price_per_unit=unit_price_data.price_per_unit,
            quantity_available=unit_price_data.quantity_available,
            minimum_order=unit_price_data.minimum_order
        )
        db.add(db_unit_price)

    db.commit()
    db.refresh(db_product)
    return db_product


def get_farmer_products(db: Session, farmer_id: int) -> List[FarmerProduct]:
    return (
        db.query(FarmerProduct)
        .options(joinedload(FarmerProduct.unit_prices))
        .filter(FarmerProduct.farmer_id == farmer_id)
        .all()
    )


def update_farmer_product(db: Session, product_id: int, farmer_id: int,
                          update_data: FarmerProductUpdate) -> FarmerProduct:
    product = db.query(FarmerProduct).filter(
        FarmerProduct.id == product_id,
        FarmerProduct.farmer_id == farmer_id
    ).first()

    if not product:
        raise Exception("Product not found")

    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        if value is not None:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


def delete_farmer_product(db: Session, product_id: int, farmer_id: int) -> bool:
    """Delete a farmer's product and all associated unit prices"""
    product = db.query(FarmerProduct).filter(
        FarmerProduct.id == product_id,
        FarmerProduct.farmer_id == farmer_id
    ).first()

    if not product:
        return False

    # The unit prices will be automatically deleted due to cascade="all, delete-orphan"
    db.delete(product)
    db.commit()
    return True


def add_unit_price(db: Session, product_id: int, farmer_id: int,
                   unit_price_data: ProductUnitPriceCreate) -> ProductUnitPrice:
    # Verify product belongs to farmer
    product = db.query(FarmerProduct).filter(
        FarmerProduct.id == product_id,
        FarmerProduct.farmer_id == farmer_id
    ).first()

    if not product:
        raise Exception("Product not found")

    # Check if unit price already exists for this unit AND customer type
    existing = db.query(ProductUnitPrice).filter(
        ProductUnitPrice.farmer_product_id == product_id,
        ProductUnitPrice.unit == unit_price_data.unit,
        ProductUnitPrice.customer_type == unit_price_data.customer_type  # NEW: Include customer_type in check
    ).first()

    if existing:
        raise Exception(f"Price for {unit_price_data.unit.value} ({unit_price_data.customer_type.value}) already exists. Please update it instead.")

    db_unit_price = ProductUnitPrice(
        farmer_product_id=product_id,
        unit=unit_price_data.unit,
        customer_type=unit_price_data.customer_type,  # NEW: Explicitly include customer_type
        price_per_unit=unit_price_data.price_per_unit,
        quantity_available=unit_price_data.quantity_available,
        minimum_order=unit_price_data.minimum_order
    )
    db.add(db_unit_price)
    db.commit()
    db.refresh(db_unit_price)
    return db_unit_price


def update_unit_price(db: Session, unit_price_id: int, farmer_id: int,
                      update_data: ProductUnitPriceUpdate) -> ProductUnitPrice:
    unit_price = (
        db.query(ProductUnitPrice)
        .join(FarmerProduct)
        .filter(
            ProductUnitPrice.id == unit_price_id,
            FarmerProduct.farmer_id == farmer_id
        )
        .first()
    )

    if not unit_price:
        raise Exception("Unit price not found")

    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        if value is not None:
            setattr(unit_price, field, value)

    db.commit()
    db.refresh(unit_price)
    return unit_price


def get_all_products(
        db: Session,
        category: Optional[CategoryEnum] = None,
        item: Optional[ItemEnum] = None,
        district: Optional[str] = None
) -> List[FarmerProduct]:
    query = (
        db.query(FarmerProduct)
        .options(
            joinedload(FarmerProduct.unit_prices),
            joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
        )
        .filter(FarmerProduct.is_active == True)
    )

    if category:
        category_items = [item for item in ItemEnum if get_item_category(item) == category]
        query = query.filter(FarmerProduct.item.in_(category_items))

    if item:
        query = query.filter(FarmerProduct.item == item)

    if district:
        query = query.join(User).join(User.farmer_profile).filter(User.farmer_profile.has(district=district))

    return query.all()


###################################


# services/stripe_service.py
import stripe
from sqlalchemy.orm import Session
from models.order import UnifiedOrder, UnifiedOrderItem, UnifiedPayment, FarmerPayment, PaymentMethodEnum, \
    PaymentStatusEnum
from models.product import FarmerProduct, ProductUnitPrice
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.order import Cart, CartItem
from typing import Dict, List, Optional
from decimal import Decimal
import uuid
from datetime import datetime
import os
import json
from services.notification_service import PushNotificationService


# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_51RbVKCR2koWNU5mYSnmPAflOWt81mMJWmDDZyh7u6OE6ene713vJjY1nEoaSGaQgcqfgUmaTqwraPYHnSXXlvAvA00nUOCyvoS")


class StripePaymentService:
    def __init__(self, db: Session):
        self.db = db
        self.platform_fee_percentage = 10.0  # 10% commission for FarmLink
        self.notification_service = PushNotificationService(db)

    def create_payment_intent(
            self,
            user_id: int,
            cart_id: int,
            delivery_info: Dict,
            amount_cents: int
    ) -> Dict:
        """Create a Stripe payment intent for the cart"""
        try:
            # Get cart and validate
            cart = self.get_cart_with_items(user_id, cart_id)
            if not cart or not cart.get('farmer_groups'):  # Fixed: Use dict access instead of attribute
                raise ValueError("Cart is empty or not found")

            # Create payment intent with Stripe
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='mur',  # Sri Lankan Rupees
                automatic_payment_methods={
                    'enabled': True,
                },
                metadata={
                    'user_id': str(user_id),
                    'cart_id': str(cart_id),
                    'platform': 'farmlink_mobile'
                },
                description=f"FarmLink Order - {len(cart.get('farmer_groups', []))} farmers, {cart.get('total_items', 0)} items"
            )

            # Store payment intent info temporarily (you might want to use Redis for this)
            # For now, we'll store it in the database
            temp_payment = UnifiedPayment(
                order_id=0,  # Will be updated when order is created
                payment_method=PaymentMethodEnum.STRIPE_CARD,  # Default, will be updated
                amount=Decimal(str(amount_cents / 100)),
                stripe_payment_intent_id=payment_intent.id,
                gateway_response=json.dumps({
                    'payment_intent_id': payment_intent.id,
                    'client_secret': payment_intent.client_secret,
                    'status': payment_intent.status
                })
            )

            return {
                'client_secret': payment_intent.client_secret,
                'payment_intent_id': payment_intent.id
            }

        except Exception as e:
            raise Exception(f"Failed to create payment intent: {str(e)}")

    def confirm_payment_and_create_order(
            self,
            user_id: int,
            payment_intent_id: str,
            delivery_info: Dict,
            payment_method_type: str = "stripe_card"
    ) -> Dict:
        """Confirm payment and create unified order with notifications"""
        try:
            # Retrieve payment intent from Stripe with expanded charges
            payment_intent = stripe.PaymentIntent.retrieve(
                payment_intent_id,
                expand=['charges']  # Expand charges to access charge data
            )

            if payment_intent.status != 'succeeded':
                raise Exception(f"Payment not successful. Status: {payment_intent.status}")

            # Get cart from metadata
            cart_id = int(payment_intent.metadata.get('cart_id'))
            cart = self.get_cart_with_items(user_id, cart_id)

            if not cart or not cart.get('farmer_groups'):  # Fixed: Use dict access
                raise ValueError("Cart is empty or not found")

            # Get user profile
            user = self.db.query(User).get(user_id)
            customer_name, customer_phone = self.get_customer_info(user)

            # Generate order number
            order_number = f"FL-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

            # Calculate totals - Fixed: Use dict access
            total_amount = sum(Decimal(str(group['subtotal'])) for group in cart.get('farmer_groups', []))
            delivery_fee = Decimal('50.00')  # Fixed delivery fee
            final_amount = total_amount + delivery_fee

            # Create unified order
            order = UnifiedOrder(
                order_number=order_number,
                customer_id=user_id,
                total_amount=total_amount,
                delivery_fee=delivery_fee,
                final_amount=final_amount,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=user.email,
                delivery_address=delivery_info['address'],
                delivery_notes=delivery_info.get('notes', '')
            )

            self.db.add(order)
            self.db.flush()  # Get order ID

            # Create order items and farmer payments
            farmer_totals = {}

            for group in cart.get('farmer_groups', []):
                farmer_id = group['farmer_id']
                farmer_total = Decimal('0')

                for item in group.get('items', []):
                    # Handle SQLAlchemy objects - use attribute access
                    # Items from OrderService.get_cart() are SQLAlchemy CartItem objects
                    order_item = UnifiedOrderItem(
                        order_id=order.id,
                        farmer_id=farmer_id,
                        farmer_product_id=item.farmer_product_id,
                        item_name=item.product_name,  # This is added by OrderService
                        unit=item.unit_name,  # This is added by OrderService
                        unit_price=Decimal(str(item.unit_price_snapshot)),
                        quantity=item.quantity,
                        total_price=Decimal(str(item.total_price)),
                        product_description=getattr(item.farmer_product, 'description', '') or ''
                    )
                    self.db.add(order_item)

                    farmer_total += item.total_price

                    # Update product stock
                    unit_price = self.db.query(ProductUnitPrice).get(item.unit_price_id)
                    if unit_price:
                        unit_price.quantity_available -= item.quantity

                farmer_totals[farmer_id] = farmer_total

            # Create farmer payment records
            for farmer_id, gross_amount in farmer_totals.items():
                platform_fee = gross_amount * (Decimal(str(self.platform_fee_percentage)) / 100)
                net_amount = gross_amount - platform_fee

                farmer_payment = FarmerPayment(
                    order_id=order.id,
                    farmer_id=farmer_id,
                    gross_amount=gross_amount,
                    platform_fee=platform_fee,
                    net_amount=net_amount,
                    platform_fee_percentage=self.platform_fee_percentage
                )
                self.db.add(farmer_payment)

            # Create payment record
            payment_method_map = {
                'stripe_card': PaymentMethodEnum.STRIPE_CARD,
                'stripe_apple_pay': PaymentMethodEnum.STRIPE_APPLE_PAY,
                'stripe_google_pay': PaymentMethodEnum.STRIPE_GOOGLE_PAY
            }

            # Get charge ID safely
            stripe_charge_id = None
            try:
                if hasattr(payment_intent, 'charges') and payment_intent.charges and payment_intent.charges.data:
                    stripe_charge_id = payment_intent.charges.data[0].id
                elif hasattr(payment_intent, 'latest_charge') and payment_intent.latest_charge:
                    stripe_charge_id = payment_intent.latest_charge
            except (AttributeError, IndexError, KeyError):
                # If we can't get the charge ID, that's okay - we'll leave it as None
                pass

            payment = UnifiedPayment(
                order_id=order.id,
                payment_method=payment_method_map.get(payment_method_type, PaymentMethodEnum.STRIPE_CARD),
                status=PaymentStatusEnum.SUCCESSFUL,
                amount=final_amount,
                stripe_payment_intent_id=payment_intent_id,
                stripe_payment_method_id=getattr(payment_intent, 'payment_method', None),
                stripe_charge_id=stripe_charge_id,
                completed_at=datetime.utcnow(),
                gateway_response=json.dumps({
                    'payment_intent': payment_intent_id,
                    'amount_received': getattr(payment_intent, 'amount_received', payment_intent.amount),
                    'status': payment_intent.status
                })
            )
            self.db.add(payment)

            # Clear cart items
            self.clear_cart_items(cart_id)

            self.db.commit()

            # Now send notifications (this will handle its own commit)
            self.notification_service.notify_new_order_to_farmers(order)

            return {
                'order_id': order.id,
                'order_number': order_number,
                'status': 'success',
                'amount': float(final_amount)
            }

        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to create order: {str(e)}")

    def get_cart_with_items(self, user_id: int, cart_id: int) -> Optional[Dict]:
        """Get cart with items grouped by farmer"""
        from services.order_service import OrderService
        order_service = OrderService(self.db)
        return order_service.get_cart(user_id)

    def get_customer_info(self, user: User) -> tuple:
        """Get customer name and phone from user profile"""
        if user.role == "individual" and user.individual_profile:
            name = f"{user.individual_profile.first_name} {user.individual_profile.last_name}"
            phone = user.individual_profile.phone_number
        elif user.role == "business" and user.business_profile:
            name = user.business_profile.contact_name
            phone = user.business_profile.phone_number
        else:
            name = user.email
            phone = ""

        return name, phone

    def clear_cart_items(self, cart_id: int):
        """Clear all items from cart after successful order"""
        self.db.query(CartItem).filter(CartItem.cart_id == cart_id).delete()

    def get_farmer_earnings_summary(self, farmer_id: int) -> Dict:
        """Get earnings summary for farmer dashboard"""
        from sqlalchemy import func, desc

        # Get farmer payments
        payments = (
            self.db.query(FarmerPayment)
            .filter(FarmerPayment.farmer_id == farmer_id)
            .all()
        )

        total_gross = sum(p.gross_amount for p in payments)
        total_fees = sum(p.platform_fee for p in payments)
        total_net = sum(p.net_amount for p in payments)

        pending_payments = [p for p in payments if p.payment_status == "pending"]
        paid_payments = [p for p in payments if p.payment_status == "paid"]

        return {
            'total_gross_earnings': float(total_gross),
            'total_platform_fees': float(total_fees),
            'total_net_earnings': float(total_net),
            'pending_amount': float(sum(p.net_amount for p in pending_payments)),
            'paid_amount': float(sum(p.net_amount for p in paid_payments)),
            'total_orders': len(payments),
            'recent_payments': [
                {
                    'order_number': p.order.order_number,
                    'gross_amount': float(p.gross_amount),
                    'platform_fee': float(p.platform_fee),
                    'net_amount': float(p.net_amount),
                    'status': p.payment_status,
                    'created_at': p.created_at.isoformat()
                }
                for p in sorted(payments, key=lambda x: x.created_at, reverse=True)[:10]
            ]
        }

    def process_refund(self, order_id: int, amount_cents: Optional[int] = None) -> Dict:
        """Process refund for an order"""
        try:
            order = self.db.query(UnifiedOrder).get(order_id)
            if not order or not order.payment:
                raise ValueError("Order or payment not found")

            if not order.payment.stripe_payment_intent_id:
                raise ValueError("No Stripe payment found for this order")

            # Create refund with Stripe
            refund_amount = amount_cents or int(order.final_amount * 100)

            refund = stripe.Refund.create(
                payment_intent=order.payment.stripe_payment_intent_id,
                amount=refund_amount,
                metadata={
                    'order_id': str(order_id),
                    'order_number': order.order_number
                }
            )

            # Update payment status
            order.payment.status = PaymentStatusEnum.REFUNDED
            order.payment.gateway_response = json.dumps({
                'refund_id': refund.id,
                'refund_status': refund.status,
                'amount_refunded': refund.amount
            })

            # Update order status
            order.status = "cancelled"

            self.db.commit()

            return {
                'refund_id': refund.id,
                'amount_refunded': refund.amount / 100,
                'status': refund.status
            }

        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to process refund: {str(e)}")


# Webhook handler for Stripe events
def handle_stripe_webhook(event_data: Dict, signature: str) -> Dict:
    """Handle Stripe webhook events"""
    try:
        # Verify webhook signature
        endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        if endpoint_secret:
            stripe.Webhook.construct_event(
                event_data, signature, endpoint_secret
            )

        event_type = event_data['type']

        if event_type == 'payment_intent.succeeded':
            # Payment successful - could trigger notifications
            payment_intent = event_data['data']['object']
            print(f"Payment succeeded: {payment_intent['id']}")

        elif event_type == 'payment_intent.payment_failed':
            # Payment failed - could update order status
            payment_intent = event_data['data']['object']
            print(f"Payment failed: {payment_intent['id']}")

        return {'status': 'success'}

    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {'status': 'error', 'message': str(e)}


###################################


from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from core.database import Base, engine
from routes import auth, product, order, browse, payment, notification
from seed_data import seed_database
from dotenv import load_dotenv


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)

    # Check if we need to seed the database
    # This checks if the database file is very small (just created) or doesn't exist
    db_file = "./farmlink.db"
    if not os.path.exists(db_file) or os.path.getsize(db_file) < 1024:  # less than 1KB
        print("🌱 Seeding database...")
        seed_database()
        print("✅ Database seeded successfully!")
    else:
        print("📊 Database already exists, skipping seeding")

    yield
    # Shutdown (add cleanup code here if needed)

load_dotenv()

app = FastAPI(lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(order.router, prefix="/orders", tags=["Orders"])
app.include_router(browse.router, prefix="/browse", tags=["Browse"])
app.include_router(payment.router, prefix="/payment", tags=["Payment"])
app.include_router(notification.router, prefix="/notification", tags=["Notification"])


###################################


# services/recommendation_service.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, distinct
from models.user import User, FarmerProfile
from models.product import FarmerProduct, ProductUnitPrice, CategoryEnum, ItemEnum, get_item_category
from models.order import UnifiedOrder, UnifiedOrderItem
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from collections import defaultdict, Counter
import pandas as pd


class MLRecommendationService:
    def __init__(self, db: Session):
        self.db = db
        self.n_recommendations = 6  # Number of products to recommend

    def get_recommendations_for_user(self, user_id: int, customer_type: str) -> List[Dict]:
        """
        Get personalized recommendations using hybrid approach
        """
        try:
            # Get user's purchase history
            user_purchases = self._get_user_purchase_history(user_id)

            if len(user_purchases) < 2:  # New user with minimal history
                return self._get_new_user_recommendations(customer_type)

            # Get recommendations using hybrid approach
            collaborative_recs = self._collaborative_filtering(user_id, customer_type)
            content_recs = self._content_based_filtering(user_id, customer_type)

            # Combine recommendations (60% collaborative, 40% content-based)
            hybrid_recs = self._combine_recommendations(
                collaborative_recs, content_recs,
                collaborative_weight=0.6, content_weight=0.4
            )

            # Convert to product details and return
            return self._get_product_details(hybrid_recs, customer_type)

        except Exception as e:
            print(f"Error in recommendations: {e}")
            # Fallback to popular products
            return self._get_popular_products(customer_type)

    def _get_user_purchase_history(self, user_id: int) -> List[Dict]:
        """Get user's purchase history with product details"""
        orders = (
            self.db.query(UnifiedOrderItem)
            .join(UnifiedOrder)
            .filter(
                UnifiedOrder.customer_id == user_id,
                UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
            )
            .all()
        )

        purchases = []
        for item in orders:
            purchases.append({
                'product_id': item.farmer_product_id,
                'farmer_id': item.farmer_id,
                'item_name': item.item_name.lower(),
                'quantity': item.quantity,
                'total_price': float(item.total_price)
            })

        return purchases

    def _collaborative_filtering(self, user_id: int, customer_type: str) -> List[Tuple[int, float]]:
        """
        Collaborative filtering: Find similar users and recommend their purchases
        """
        try:
            # Get all users of the same type with their purchases
            user_item_matrix = self._create_user_item_matrix(customer_type)

            if user_id not in user_item_matrix.index:
                return []

            # Create user-item matrix for similarity calculation
            matrix = user_item_matrix.fillna(0)

            if len(matrix) < 2:  # Need at least 2 users for collaborative filtering
                return []

            # Calculate user similarity using cosine similarity
            user_similarity = cosine_similarity(matrix)
            user_idx = list(matrix.index).index(user_id)

            # Find most similar users (excluding self)
            similar_users_scores = list(enumerate(user_similarity[user_idx]))
            similar_users_scores = [(i, score) for i, score in similar_users_scores if i != user_idx and score > 0.1]
            similar_users_scores.sort(key=lambda x: x[1], reverse=True)

            # Get recommendations from top 5 similar users
            recommendations = defaultdict(float)
            user_purchased_items = set(matrix.columns[matrix.iloc[user_idx] > 0])

            for similar_user_idx, similarity_score in similar_users_scores[:5]:
                similar_user_items = matrix.columns[matrix.iloc[similar_user_idx] > 0]

                for item in similar_user_items:
                    if item not in user_purchased_items:  # Don't recommend already purchased items
                        recommendations[item] += similarity_score * matrix.iloc[
                            similar_user_idx, matrix.columns.get_loc(item)]

            # Sort by score and return top recommendations
            sorted_recs = sorted(recommendations.items(), key=lambda x: x[1], reverse=True)
            return [(int(product_id), score) for product_id, score in sorted_recs[:self.n_recommendations]]

        except Exception as e:
            print(f"Collaborative filtering error: {e}")
            return []

    def _content_based_filtering(self, user_id: int, customer_type: str) -> List[Tuple[int, float]]:
        """
        Content-based filtering: Recommend products similar to user's purchase patterns
        """
        try:
            # Get user's purchase patterns
            user_purchases = self._get_user_purchase_history(user_id)
            if not user_purchases:
                return []

            # Analyze user's preferences
            purchased_categories = []
            purchased_farmers = []

            for purchase in user_purchases:
                # Get product details
                product = self.db.query(FarmerProduct).get(purchase['product_id'])
                if product:
                    purchased_categories.append(get_item_category(product.item).value)
                    purchased_farmers.append(purchase['farmer_id'])

            # Count preferences
            category_preferences = Counter(purchased_categories)
            farmer_preferences = Counter(purchased_farmers)

            # Get products from preferred categories and farmers
            recommended_products = []

            # Get products from top categories
            for category, count in category_preferences.most_common(2):
                category_enum = CategoryEnum(category)
                category_items = [item for item in ItemEnum if get_item_category(item) == category_enum]

                products = (
                    self.db.query(FarmerProduct)
                    .filter(
                        FarmerProduct.item.in_(category_items),
                        FarmerProduct.is_active == True,
                        ~FarmerProduct.id.in_([p['product_id'] for p in user_purchases])
                    )
                    .limit(3)
                    .all()
                )

                for product in products:
                    score = count / len(user_purchases)  # Normalize by total purchases
                    recommended_products.append((product.id, score))

            # Get products from preferred farmers
            for farmer_id, count in farmer_preferences.most_common(3):
                products = (
                    self.db.query(FarmerProduct)
                    .filter(
                        FarmerProduct.farmer_id == farmer_id,
                        FarmerProduct.is_active == True,
                        ~FarmerProduct.id.in_([p['product_id'] for p in user_purchases])
                    )
                    .limit(2)
                    .all()
                )

                for product in products:
                    score = count / len(user_purchases)
                    recommended_products.append((product.id, score))

            # Remove duplicates and sort by score
            unique_recs = {}
            for product_id, score in recommended_products:
                if product_id not in unique_recs:
                    unique_recs[product_id] = score
                else:
                    unique_recs[product_id] = max(unique_recs[product_id], score)

            sorted_recs = sorted(unique_recs.items(), key=lambda x: x[1], reverse=True)
            return sorted_recs[:self.n_recommendations]

        except Exception as e:
            print(f"Content-based filtering error: {e}")
            return []

    def _create_user_item_matrix(self, customer_type: str) -> pd.DataFrame:
        """Create user-item interaction matrix for collaborative filtering"""
        # Get all users of the same type
        role_filter = ['individual'] if customer_type == 'individual' else ['business']

        # Get purchase data for users of the same type
        purchases = (
            self.db.query(
                UnifiedOrder.customer_id,
                UnifiedOrderItem.farmer_product_id,
                func.sum(UnifiedOrderItem.quantity).label('total_quantity')
            )
            .join(UnifiedOrderItem, UnifiedOrder.id == UnifiedOrderItem.order_id)
            .join(User, UnifiedOrder.customer_id == User.id)
            .filter(
                User.role.in_(role_filter),
                UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
            )
            .group_by(UnifiedOrder.customer_id, UnifiedOrderItem.farmer_product_id)
            .all()
        )

        # Convert to pandas DataFrame
        data = []
        for purchase in purchases:
            data.append({
                'user_id': purchase.customer_id,
                'product_id': purchase.farmer_product_id,
                'quantity': float(purchase.total_quantity)
            })

        if not data:
            return pd.DataFrame()

        df = pd.DataFrame(data)
        user_item_matrix = df.pivot(index='user_id', columns='product_id', values='quantity')

        return user_item_matrix

    def _combine_recommendations(
            self,
            collaborative: List[Tuple[int, float]],
            content: List[Tuple[int, float]],
            collaborative_weight: float = 0.6,
            content_weight: float = 0.4
    ) -> List[Tuple[int, float]]:
        """Combine collaborative and content-based recommendations"""

        combined_scores = defaultdict(float)

        # Add collaborative filtering scores
        for product_id, score in collaborative:
            combined_scores[product_id] += score * collaborative_weight

        # Add content-based scores
        for product_id, score in content:
            combined_scores[product_id] += score * content_weight

        # Sort by combined score
        sorted_combined = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_combined[:self.n_recommendations]

    def _get_product_details(self, recommended_products: List[Tuple[int, float]], customer_type: str) -> List[Dict]:
        """Convert product IDs to detailed product information"""
        if not recommended_products:
            return []

        product_ids = [product_id for product_id, _ in recommended_products]

        products = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(
                FarmerProduct.id.in_(product_ids),
                FarmerProduct.is_active == True
            )
            .all()
        )

        result = []
        for product in products:
            # Filter unit prices by customer type
            suitable_prices = [
                up for up in product.unit_prices
                if up.customer_type.value == customer_type and up.quantity_available > 0
            ]

            if not suitable_prices:  # Skip if no suitable prices
                continue

            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in suitable_prices)

            result.append({
                'id': product.id,
                'item': product.item.value,
                'category': get_item_category(product.item).value,
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,
                        'customer_type': up.customer_type.value,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in suitable_prices
                ],
                'created_at': product.created_at.isoformat()
            })

        return result

    def _get_new_user_recommendations(self, customer_type: str) -> List[Dict]:
        """Get recommendations for users with no purchase history"""
        # Return empty list - the frontend will show the instructional message
        return []

    def _get_popular_products(self, customer_type: str) -> List[Dict]:
        """Fallback: Get popular products based on sales volume"""
        try:
            # Get products ordered most frequently by users of the same type
            role_filter = ['individual'] if customer_type == 'individual' else ['business']

            popular_products = (
                self.db.query(
                    UnifiedOrderItem.farmer_product_id,
                    func.count(distinct(UnifiedOrder.customer_id)).label('unique_customers'),
                    func.sum(UnifiedOrderItem.quantity).label('total_quantity')
                )
                .join(UnifiedOrder, UnifiedOrderItem.order_id == UnifiedOrder.id)
                .join(User, UnifiedOrder.customer_id == User.id)
                .filter(
                    User.role.in_(role_filter),
                    UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
                )
                .group_by(UnifiedOrderItem.farmer_product_id)
                .having(func.count(distinct(UnifiedOrder.customer_id)) >= 2)  # At least 2 different customers
                .order_by(desc('unique_customers'), desc('total_quantity'))
                .limit(self.n_recommendations)
                .all()
            )

            if not popular_products:
                return []

            product_ids = [p.farmer_product_id for p in popular_products]
            return self._get_product_details([(pid, 1.0) for pid in product_ids], customer_type)

        except Exception as e:
            print(f"Error getting popular products: {e}")
            return []


###################################


# seed_data.py - UPDATED FOR ML TESTING
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from core.security import get_password_hash
from datetime import datetime, timedelta
from decimal import Decimal

# Password: test (for all test users)
DEFAULT_PASSWORD = "test"


def reset_database(db: Session):
    """Reset database and create all tables with updated schema"""
    print("🗑️  Resetting database...")

    try:
        # Import Base to access metadata
        from core.database import Base

        # STEP 1: Get all existing tables from database
        print("  - Scanning existing tables...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))
        existing_tables = [row[0] for row in result]
        print(f"    Found {len(existing_tables)} existing tables")

        # STEP 2: Get all model tables from current models
        model_tables = set(Base.metadata.tables.keys())
        print(f"    Current models define {len(model_tables)} tables")

        # STEP 3: Find orphaned tables (exist in DB but not in models)
        orphaned_tables = set(existing_tables) - model_tables
        if orphaned_tables:
            print(f"  - Removing {len(orphaned_tables)} orphaned tables...")
            for table in orphaned_tables:
                try:
                    db.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    print(f"    ✅ Removed orphaned table: {table}")
                except Exception as e:
                    print(f"    ⚠️  Could not remove {table}: {e}")

        # STEP 4: Drop all remaining tables to ensure clean slate
        print("  - Dropping all remaining tables...")
        Base.metadata.drop_all(bind=engine)

        # STEP 5: Create all tables from current models
        print("  - Creating tables from current models...")
        Base.metadata.create_all(bind=engine)

        # STEP 6: Verify final table structure
        print("  - Verifying final table structure...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))

        final_tables = [row[0] for row in result]
        print(f"    📋 Final database has {len(final_tables)} tables")

        db.commit()
        print("✅ Database cleanup and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


def create_test_users(db: Session):
    """Create simple test users for ML testing"""

    # Test Individual User
    individual_user = User(
        email="user@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="individual"
    )
    db.add(individual_user)
    db.flush()

    individual_profile = IndividualProfile(
        user_id=individual_user.id,
        first_name="Test",
        last_name="User",
        date_of_birth="1990-01-01",
        phone_number="+94701234567",
        street="123 Test Street",
        city_town="Colombo",
        post_code="00100"
    )
    db.add(individual_profile)
    print("Created individual user: user@test.com")

    # Test Business User
    business_user = User(
        email="biz@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="business"
    )
    db.add(business_user)
    db.flush()

    business_profile = BusinessProfile(
        user_id=business_user.id,
        business_name="Test Business",
        contact_name="Biz User",
        phone_number="+94702345678",
        street="456 Business Road",
        city_town="Kandy",
        post_code="20000"
    )
    db.add(business_profile)
    print("Created business user: biz@test.com")

    # Test Farmer User (with ALL products)
    farmer_user = User(
        email="farm@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="farmer"
    )
    db.add(farmer_user)
    db.flush()

    farmer_profile = FarmerProfile(
        user_id=farmer_user.id,
        first_name="Farm",
        last_name="User",
        phone_number="+94703456789",
        district="Galle"
    )
    db.add(farmer_profile)
    print("Created farmer user: farm@test.com")

    return farmer_user.id


def create_all_products(db: Session, farmer_id: int):
    """Create ALL fruits and vegetables for the test farmer"""

    # Define realistic pricing for all items
    product_pricing = {
        # FRUITS
        ItemEnum.APPLE: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.BANANA: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.DOZEN, "stock": 80},
        ItemEnum.ORANGE: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.MANGO: {"individual": 500.0, "business": 450.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.PINEAPPLE: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.PIECE, "stock": 40},
        ItemEnum.PAPAYA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GUAVA: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.LYCHEE: {"individual": 600.0, "business": 550.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.COCONUT: {"individual": 80.0, "business": 70.0, "unit": UnitEnum.PIECE, "stock": 100},
        ItemEnum.LEMON: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.LIME: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.WATERMELON: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.MELON: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GRAPES: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 25},
        ItemEnum.STRAWBERRY: {"individual": 1200.0, "business": 1000.0, "unit": UnitEnum.KG, "stock": 15},

        # VEGETABLES
        ItemEnum.TOMATO: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 120},
        ItemEnum.POTATO: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 200},
        ItemEnum.ONION: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 150},
        ItemEnum.CARROT: {"individual": 280.0, "business": 250.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.CABBAGE: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.PIECE, "stock": 80},
        ItemEnum.LETTUCE: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.PIECE, "stock": 60},
        ItemEnum.SPINACH: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.BUNCH, "stock": 70},
        ItemEnum.BROCCOLI: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.CAULIFLOWER: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.PIECE, "stock": 50},
        ItemEnum.BELL_PEPPER: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.CHILI: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.CUCUMBER: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.EGGPLANT: {"individual": 220.0, "business": 200.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.OKRA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GREEN_BEANS: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.PUMPKIN: {"individual": 120.0, "business": 100.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.BEETROOT: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.RADISH: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.GINGER: {"individual": 600.0, "business": 540.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.GARLIC: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
    }

    print(f"Creating ALL {len(product_pricing)} products for test farmer...")

    for item_enum, pricing in product_pricing.items():
        # Create product
        product = FarmerProduct(
            farmer_id=farmer_id,
            item=item_enum,
            description=f"Fresh organic {item_enum.value.replace('_', ' ')}, pesticide-free",
            is_active=True,
            harvest_date=datetime.now() - timedelta(days=1),
            expiry_date=datetime.now() + timedelta(days=10)
        )
        db.add(product)
        db.flush()

        # Individual pricing
        individual_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.INDIVIDUAL,
            price_per_unit=pricing["individual"],
            quantity_available=pricing["stock"],
            minimum_order=1
        )
        db.add(individual_unit_price)

        # Business pricing (bulk orders)
        business_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.BUSINESS,
            price_per_unit=pricing["business"],
            quantity_available=pricing["stock"] * 2,  # More stock for business
            minimum_order=25 if pricing["unit"] != UnitEnum.PIECE else 10  # Bulk minimum
        )
        db.add(business_unit_price)

        print(
            f"  ✅ Created {item_enum.value} (Individual: Rs {pricing['individual']}, Business: Rs {pricing['business']})")


def seed_database():
    """Main seeding function for ML testing"""
    print("=" * 60)
    print("🧪 Starting FarmLink ML Testing Database Setup...")
    print("=" * 60)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database
        reset_database(db)

        print("\n👥 Creating test users...")
        farmer_id = create_test_users(db)

        print(f"\n🥕 Creating ALL products for test farmer (ID: {farmer_id})...")
        create_all_products(db, farmer_id)

        # NO carts, NO orders - clean slate for ML testing

        db.commit()
        print("\n" + "=" * 60)
        print("✅ ML Testing Database Setup Completed!")
        print("=" * 60)
        print(f"🔑 Password for all users: {DEFAULT_PASSWORD}")
        print("=" * 60)
        print("🧪 Test accounts for ML:")
        print("  👤 Individual: user@test.com")
        print("  🏢 Business: biz@test.com")
        print("  🚜 Farmer: farm@test.com")
        print("=" * 60)
        print("📋 Products available:")
        print("  🍎 15 Fruits (apple, banana, orange, mango, etc.)")
        print("  🥕 20 Vegetables (tomato, potato, onion, carrot, etc.)")
        print("  💰 Individual & Business pricing for all items")
        print("=" * 60)
        print("🎯 Ready for ML Testing:")
        print("  1. Login as user@test.com or biz@test.com")
        print("  2. Order diverse products from farm@test.com")
        print("  3. Test ML recommendations on homepage")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()