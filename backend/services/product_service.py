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

    # Add unit prices
    for unit_price_data in product_data.unit_prices:
        db_unit_price = ProductUnitPrice(
            farmer_product_id=db_product.id,
            **unit_price_data.dict()
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

    # Check if unit price already exists
    existing = db.query(ProductUnitPrice).filter(
        ProductUnitPrice.farmer_product_id == product_id,
        ProductUnitPrice.unit == unit_price_data.unit
    ).first()

    if existing:
        raise Exception(f"Price for {unit_price_data.unit.value} already exists. Please update it instead.")

    db_unit_price = ProductUnitPrice(
        farmer_product_id=product_id,
        **unit_price_data.dict()
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