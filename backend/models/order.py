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