from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct, desc, and_
from models.user import User, FarmerProfile
from models.product import FarmerProduct, ProductUnitPrice, CategoryEnum, ItemEnum, get_item_category
from typing import List, Optional, Dict
from decimal import Decimal


class BrowseService:
    def __init__(self, db: Session):
        self.db = db

    def get_featured_farmers(self, district: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Get featured farmers with most products for homepage"""
        query = (
            self.db.query(
                User.id,
                FarmerProfile.first_name,
                FarmerProfile.last_name,
                FarmerProfile.district,
                func.count(distinct(FarmerProduct.id)).label('product_count')
            )
            .join(FarmerProfile, User.id == FarmerProfile.user_id)
            .join(FarmerProduct, User.id == FarmerProduct.farmer_id)
            .filter(
                User.role == 'farmer',
                FarmerProduct.is_active == True
            )
            .group_by(User.id, FarmerProfile.first_name, FarmerProfile.last_name, FarmerProfile.district)
            .having(func.count(distinct(FarmerProduct.id)) > 0)
            .order_by(desc('product_count'))
        )

        if district:
            query = query.filter(FarmerProfile.district.ilike(f"%{district}%"))

        farmers = query.limit(limit).all()

        result = []
        for farmer in farmers:
            result.append({
                'id': farmer.id,
                'name': f"{farmer.first_name} {farmer.last_name}",
                'district': farmer.district,
                'product_count': farmer.product_count
            })

        return result

    def get_latest_products(self, limit: int = 20) -> List[Dict]:
        """Get latest products from all farmers"""
        products = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(FarmerProduct.is_active == True)
            .order_by(FarmerProduct.created_at.desc())
            .limit(limit)
            .all()
        )

        result = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            result.append({
                'id': product.id,
                'item': product.item,
                'category': get_item_category(product.item),
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at
            })

        return result

    def search_products(
            self,
            search_term: Optional[str] = None,
            category: Optional[CategoryEnum] = None,
            district: Optional[str] = None,
            min_price: Optional[float] = None,
            max_price: Optional[float] = None,
            limit: int = 50,
            offset: int = 0
    ) -> Dict:
        """Search and filter products"""
        query = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(FarmerProduct.is_active == True)
        )

        # Apply filters
        if search_term:
            # Search in item name and description
            search_filter = f"%{search_term.lower()}%"
            query = query.filter(
                FarmerProduct.item.like(search_filter) |
                FarmerProduct.description.ilike(search_filter)
            )

        if category:
            category_items = [item for item in ItemEnum if get_item_category(item) == category]
            query = query.filter(FarmerProduct.item.in_(category_items))

        if district:
            query = query.join(User, FarmerProduct.farmer_id == User.id)
            query = query.join(FarmerProfile, User.id == FarmerProfile.user_id)
            query = query.filter(FarmerProfile.district.ilike(f"%{district}%"))

        # For price filtering, we need to join with unit prices
        if min_price is not None or max_price is not None:
            query = query.join(ProductUnitPrice)
            if min_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit >= min_price)
            if max_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit <= max_price)

        # Get total count for pagination
        total = query.count()

        # Apply pagination and ordering
        products = (
            query.distinct(FarmerProduct.id)
            .order_by(FarmerProduct.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        # Format results
        items = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            items.append({
                'id': product.id,
                'item': product.item,
                'category': get_item_category(product.item),
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at
            })

        return {
            'items': items,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_next': offset + limit < total,
            'has_prev': offset > 0
        }

    def get_farmer_details_with_products(self, farmer_id: int) -> Optional[Dict]:
        """Get farmer details with all their products"""
        farmer = (
            self.db.query(User)
            .options(joinedload(User.farmer_profile))
            .filter(User.id == farmer_id, User.role == 'farmer')
            .first()
        )

        if not farmer:
            return None

        # Get farmer's active products
        products = (
            self.db.query(FarmerProduct)
            .options(joinedload(FarmerProduct.unit_prices))
            .filter(
                FarmerProduct.farmer_id == farmer_id,
                FarmerProduct.is_active == True
            )
            .order_by(FarmerProduct.created_at.desc())
            .all()
        )

        product_list = []
        for product in products:
            product_list.append({
                'id': product.id,
                'item': product.item,
                'category': get_item_category(product.item),
                'description': product.description,
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at
            })

        return {
            'id': farmer.id,
            'name': f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}",
            'district': farmer.farmer_profile.district,
            'phone': farmer.farmer_profile.phone_number,
            'email': farmer.email,
            'products': product_list,
            'product_count': len(product_list)
        }

    def get_categories_with_counts(self) -> List[Dict]:
        """Get product categories with item counts"""
        # Get all active products grouped by category
        products = (
            self.db.query(FarmerProduct.item, func.count(FarmerProduct.id).label('count'))
            .filter(FarmerProduct.is_active == True)
            .group_by(FarmerProduct.item)
            .all()
        )

        # Group by category
        categories = {}
        for item, count in products:
            category = get_item_category(item)
            if category not in categories:
                categories[category] = {
                    'name': category,
                    'total_products': 0,
                    'items': []
                }

            categories[category]['total_products'] += count
            categories[category]['items'].append({
                'item': item,
                'count': count
            })

        return list(categories.values())

    def get_districts_with_counts(self) -> List[Dict]:
        """Get districts with farmer counts"""
        districts = (
            self.db.query(
                FarmerProfile.district,
                func.count(distinct(User.id)).label('farmer_count'),
                func.count(distinct(FarmerProduct.id)).label('product_count')
            )
            .join(User, FarmerProfile.user_id == User.id)
            .join(FarmerProduct, User.id == FarmerProduct.farmer_id)
            .filter(
                User.role == 'farmer',
                FarmerProduct.is_active == True
            )
            .group_by(FarmerProfile.district)
            .order_by(desc('farmer_count'))
            .all()
        )

        result = []
        for district in districts:
            result.append({
                'district': district.district,
                'farmer_count': district.farmer_count,
                'product_count': district.product_count
            })

        return result