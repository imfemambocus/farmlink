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