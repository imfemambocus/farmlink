from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from models.order import OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum


# Cart Schemas
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

    # Product information
    product_name: Optional[str] = None
    unit_name: Optional[str] = None
    farmer_name: Optional[str] = None

    class Config:
        orm_mode = True


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
        orm_mode = True


# Order Schemas
class OrderItemResponse(BaseModel):
    id: int
    item_name: str
    unit: str
    unit_price: Decimal
    quantity: float
    total_price: Decimal
    product_description: Optional[str]

    class Config:
        orm_mode = True


class OrderCreateRequest(BaseModel):
    farmer_id: int
    delivery_address: str
    delivery_notes: Optional[str] = None
    payment_method: PaymentMethodEnum

    @validator('delivery_address')
    def validate_delivery_address(cls, v):
        if not v or not v.strip():
            raise ValueError('Delivery address is required')
        return v.strip()


class OrderResponse(BaseModel):
    id: int
    order_number: str
    status: OrderStatusEnum
    total_amount: Decimal
    delivery_fee: Decimal
    final_amount: Decimal

    customer_name: str
    customer_phone: str
    farmer_name: Optional[str] = None
    farmer_district: Optional[str] = None

    delivery_address: str
    delivery_notes: Optional[str]

    items: List[OrderItemResponse]

    created_at: datetime
    updated_at: datetime
    out_for_delivery_at: Optional[datetime]
    delivered_at: Optional[datetime]

    class Config:
        orm_mode = True


class OrderListItem(BaseModel):
    id: int
    order_number: str
    status: OrderStatusEnum
    final_amount: Decimal
    customer_name: Optional[str] = None  # For farmer view
    farmer_name: Optional[str] = None  # For customer view
    items_count: int
    created_at: datetime

    class Config:
        orm_mode = True


class OrderUpdateRequest(BaseModel):
    status: OrderStatusEnum


# Payment Schemas
class PaymentResponse(BaseModel):
    id: int
    payment_method: PaymentMethodEnum
    status: PaymentStatusEnum
    amount: Decimal
    currency: str
    transaction_id: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        orm_mode = True


class PaymentProcessRequest(BaseModel):
    payment_method: PaymentMethodEnum
    customer_notes: Optional[str] = None
    # Add other payment gateway specific fields as needed


# Browse/Homepage Schemas
class FarmerBrowseItem(BaseModel):
    id: int
    name: str
    district: str
    product_count: int


class ProductBrowseItem(BaseModel):
    id: int
    item: str
    category: str
    description: Optional[str]
    farmer_id: int
    farmer_name: str
    farmer_district: str
    lowest_price: float
    unit_prices: List[dict]
    created_at: datetime


class FarmerProductsResponse(BaseModel):
    id: int
    name: str
    district: str
    products: List[dict]