from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
from models.product import CategoryEnum, UnitEnum, ItemEnum


class ProductUnitPriceBase(BaseModel):
    unit: UnitEnum
    price_per_unit: float
    quantity_available: float
    minimum_order: float = 1.0


class ProductUnitPriceCreate(ProductUnitPriceBase):
    pass


class ProductUnitPriceUpdate(BaseModel):
    price_per_unit: Optional[float] = None
    quantity_available: Optional[float] = None
    minimum_order: Optional[float] = None


class ProductUnitPriceResponse(ProductUnitPriceBase):
    id: int

    class Config:
        orm_mode = True


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
        orm_mode = True

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
        orm_mode = True