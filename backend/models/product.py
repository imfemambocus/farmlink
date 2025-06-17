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