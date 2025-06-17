from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from services.browse_service import BrowseService
from core.security import get_current_user, get_db
from models.product import CategoryEnum

router = APIRouter()


@router.get("/farmers")
def browse_farmers(
        district: Optional[str] = Query(None, description="Filter by district"),
        limit: int = Query(10, le=50, description="Number of farmers to return"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Browse farmers with active products (for homepage)"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse farmers")

    service = BrowseService(db)
    return service.get_featured_farmers(district=district, limit=limit)


@router.get("/products/latest")
def browse_latest_products(
        limit: int = Query(20, le=50, description="Number of products to return"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Browse latest products from all farmers (for homepage)"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse products")

    service = BrowseService(db)
    return service.get_latest_products(limit=limit)


@router.get("/products/search")
def search_products(
        search: Optional[str] = Query(None, description="Search term"),
        category: Optional[CategoryEnum] = Query(None, description="Filter by category"),
        district: Optional[str] = Query(None, description="Filter by farmer's district"),
        min_price: Optional[float] = Query(None, description="Minimum price filter"),
        max_price: Optional[float] = Query(None, description="Maximum price filter"),
        limit: int = Query(20, le=50, description="Number of products per page"),
        offset: int = Query(0, description="Number of products to skip"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Search and filter products"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can search products")

    service = BrowseService(db)
    return service.search_products(
        search_term=search,
        category=category,
        district=district,
        min_price=min_price,
        max_price=max_price,
        limit=limit,
        offset=offset
    )


@router.get("/farmer/{farmer_id}")
def get_farmer_details(
        farmer_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer details with all their products"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can view farmer details")

    service = BrowseService(db)
    farmer = service.get_farmer_details_with_products(farmer_id)

    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    return farmer


@router.get("/categories")
def get_categories(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get product categories with counts"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse categories")

    service = BrowseService(db)
    return service.get_categories_with_counts()


@router.get("/districts")
def get_districts(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get districts with farmer and product counts"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can browse districts")

    service = BrowseService(db)
    return service.get_districts_with_counts()