from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from models.order import OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum


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
    farmer_count: Optional[int] = None
    item_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class UnifiedOrderUpdateRequest(BaseModel):
    status: OrderStatusEnum


class FarmerStatusUpdateRequest(BaseModel):
    """Schema specifically for farmer status updates"""
    status: OrderStatusEnum

    @validator('status')
    def validate_farmer_status(cls, v):
        allowed_statuses = ['processing', 'out_for_delivery', 'delivered', 'cancelled']
        if v not in allowed_statuses:
            raise ValueError(f'Farmers can only set status to: {", ".join(allowed_statuses)}')
        return v


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


class FarmerOrderSummary(BaseModel):
    total_orders: int
    confirmed_orders: int
    processing_orders: int
    out_for_delivery_orders: int
    delivered_orders: int
    cancelled_orders: int
    total_gross_revenue: float
    total_net_revenue: float
    pending_revenue: float