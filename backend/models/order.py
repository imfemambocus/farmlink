from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Numeric, JSON
from sqlalchemy.dialects.postgresql import JSON as PostgreJSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum
from decimal import Decimal


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
    STRIPE_CARD = "stripe_card"
    STRIPE_APPLE_PAY = "stripe_apple_pay"
    STRIPE_GOOGLE_PAY = "stripe_google_pay"


class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

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

    cart = relationship("Cart", back_populates="items")
    farmer_product = relationship("FarmerProduct")
    unit_price = relationship("ProductUnitPrice")

    @property
    def total_price(self) -> Decimal:
        return Decimal(str(self.unit_price_snapshot)) * Decimal(str(self.quantity))


class UnifiedOrder(Base):
    __tablename__ = "unified_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Overall order status (computed from farmer statuses - "worst" status)
    status = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.CONFIRMED)

    # Individual farmer statuses - JSON field storing {farmer_id: {status: str, delivered_at: datetime}}
    farmer_statuses = Column(PostgreJSON, nullable=False, default=dict)

    total_amount = Column(Numeric(10, 2), nullable=False)
    delivery_fee = Column(Numeric(10, 2), default=0)
    final_amount = Column(Numeric(10, 2), nullable=False)

    # Customer information (snapshot at time of order)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_notes = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    delivered_at = Column(DateTime)  # Set when ALL farmers have delivered

    customer = relationship("User", foreign_keys=[customer_id])
    items = relationship("UnifiedOrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("UnifiedPayment", back_populates="order", uselist=False)
    farmer_payments = relationship("FarmerPayment", back_populates="order", cascade="all, delete-orphan")

    def get_farmer_status(self, farmer_id: int) -> str:
        return self.farmer_statuses.get(str(farmer_id), {}).get("status", "confirmed")

    def get_farmer_delivered_at(self, farmer_id: int) -> str:
        return self.farmer_statuses.get(str(farmer_id), {}).get("delivered_at")

    def update_farmer_status(self, farmer_id: int, status: str, delivered_at: str = None):
        if not self.farmer_statuses:
            self.farmer_statuses = {}

        farmer_key = str(farmer_id)
        if farmer_key not in self.farmer_statuses:
            self.farmer_statuses[farmer_key] = {}

        self.farmer_statuses[farmer_key]["status"] = status
        if status == "delivered" and delivered_at:
            self.farmer_statuses[farmer_key]["delivered_at"] = delivered_at

        # IMPORTANT: Mark the JSON field as changed for SQLAlchemy
        from sqlalchemy.orm import attributes
        attributes.flag_modified(self, "farmer_statuses")

        # Recalculate overall status (worst status)
        self._update_overall_status()

    def _update_overall_status(self):
        if not self.farmer_statuses:
            self.status = OrderStatusEnum.CONFIRMED
            return

        # Status priority (worst to best)
        status_priority = {
            "cancelled": 0,
            "confirmed": 1,
            "processing": 2,
            "out_for_delivery": 3,
            "delivered": 4
        }

        # Get all farmer statuses
        farmer_status_list = [
            data.get("status", "confirmed")
            for data in self.farmer_statuses.values()
        ]

        # Find the worst status
        worst_status = min(farmer_status_list, key=lambda x: status_priority.get(x, 1))
        self.status = OrderStatusEnum(worst_status)

        # Set overall delivered_at only when ALL farmers have delivered
        all_delivered = all(
            data.get("status") == "delivered"
            for data in self.farmer_statuses.values()
        )

        if all_delivered and not self.delivered_at:
            from datetime import datetime
            self.delivered_at = datetime.utcnow()
        elif not all_delivered:
            self.delivered_at = None


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
    product_description = Column(Text)

    created_at = Column(DateTime, server_default=func.now())

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
    gateway_response = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime)

    order = relationship("UnifiedOrder", back_populates="payment")


class FarmerPayment(Base):
    __tablename__ = "farmer_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Amount calculations
    gross_amount = Column(Numeric(10, 2), nullable=False)  # Total sales for this farmer
    platform_fee = Column(Numeric(10, 2), nullable=False)  # Farmlink's commission
    net_amount = Column(Numeric(10, 2), nullable=False)  # Amount due to farmer

    # Platform fee percentage at time of order
    platform_fee_percentage = Column(Float, default=10.0)

    # Payment status to farmer
    payment_status = Column(String, default="pending")  # pending, paid, failed
    paid_at = Column(DateTime)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    order = relationship("UnifiedOrder", back_populates="farmer_payments")
    farmer = relationship("User", foreign_keys=[farmer_id])