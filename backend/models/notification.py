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


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expo_push_token = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    platform = Column(String, nullable=False)  # iOS or Android
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])

    # Ensure one token per device per user
    __table_args__ = (
        {'extend_existing': True}
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # For farmer-specific status

    type = Column(Enum(NotificationTypeEnum), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(Text)

    is_read = Column(Boolean, default=False)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    read_at = Column(DateTime)

    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    order = relationship("UnifiedOrder", foreign_keys=[order_id])
    farmer = relationship("User", foreign_keys=[farmer_id])


class UnifiedOrderFarmerStatus(Base):
    __tablename__ = "unified_order_farmer_status"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("unified_orders.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Farmer-specific status (can be different from main order status)
    status = Column(String, default="confirmed")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    status_changed_at = Column(DateTime, server_default=func.now())

    order = relationship("UnifiedOrder")
    farmer = relationship("User", foreign_keys=[farmer_id])

    # Ensure one status record per farmer per order
    __table_args__ = (
        {'extend_existing': True}
    )