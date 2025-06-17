from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum
from decimal import Decimal


class OrderStatusEnum(str, enum.Enum):
    CONFIRMED = "confirmed"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"


class PaymentMethodEnum(str, enum.Enum):
    CASH_ON_DELIVERY = "cash_on_delivery"
    MOBILE_PAYMENT = "mobile_payment"  # For mobile banking
    BANK_TRANSFER = "bank_transfer"
    DIGITAL_WALLET = "digital_wallet"


# Shopping Cart Models
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


# Order Models
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

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
    out_for_delivery_at = Column(DateTime)
    delivered_at = Column(DateTime)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    farmer = relationship("User", foreign_keys=[farmer_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    farmer_product_id = Column(Integer, ForeignKey("farmer_products.id"), nullable=False)

    # Product snapshot at time of order
    item_name = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Float, nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    # Product details for reference
    product_description = Column(Text)

    # Relationships
    order = relationship("Order", back_populates="items")
    farmer_product = relationship("FarmerProduct")


# Payment Models
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)

    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="LKR")  # Sri Lankan Rupees

    # Payment gateway information
    transaction_id = Column(String, unique=True)  # External payment gateway transaction ID
    gateway_response = Column(Text)  # Store gateway response JSON

    # Customer payment details (for cash on delivery)
    customer_notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime)

    # Relationships
    order = relationship("Order", back_populates="payment")