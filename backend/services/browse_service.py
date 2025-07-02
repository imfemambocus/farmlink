from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct, desc
from models.user import User, FarmerProfile
from models.product import FarmerProduct, ProductUnitPrice, CategoryEnum, ItemEnum, get_item_category
from typing import List, Optional, Dict
from services.recommendation_service import MLRecommendationService


class BrowseService:
    def __init__(self, db: Session):
        self.db = db
        self.recommendation_service = MLRecommendationService(db)


    def get_featured_farmers(self, district: Optional[str] = None, limit: int = 10) -> List[Dict]:
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
        # Get fruit items and vegetable items
        fruit_items = [item for item in ItemEnum if get_item_category(item) == CategoryEnum.FRUITS]
        vegetable_items = [item for item in ItemEnum if get_item_category(item) == CategoryEnum.VEGETABLES]

        # Calculate limits for each category (try to get roughly equal amounts)
        fruits_limit = limit // 2
        vegetables_limit = limit - fruits_limit

        # Get latest fruits
        fruits = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(
                FarmerProduct.is_active == True,
                FarmerProduct.item.in_(fruit_items)
            )
            .order_by(FarmerProduct.created_at.desc())
            .limit(fruits_limit)
            .all()
        )

        # Get latest vegetables
        vegetables = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(
                FarmerProduct.is_active == True,
                FarmerProduct.item.in_(vegetable_items)
            )
            .order_by(FarmerProduct.created_at.desc())
            .limit(vegetables_limit)
            .all()
        )

        # Combine results
        all_products = fruits + vegetables

        # If one category doesn't have enough products, fill with the other category
        if len(all_products) < limit:
            remaining_slots = limit - len(all_products)
            existing_ids = [p.id for p in all_products]

            additional_products = (
                self.db.query(FarmerProduct)
                .options(
                    joinedload(FarmerProduct.unit_prices),
                    joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
                )
                .filter(
                    FarmerProduct.is_active == True,
                    ~FarmerProduct.id.in_(existing_ids)
                )
                .order_by(FarmerProduct.created_at.desc())
                .limit(remaining_slots)
                .all()
            )

            all_products.extend(additional_products)

        # Sort by creation date to maintain chronological order
        all_products.sort(key=lambda x: x.created_at, reverse=True)

        # Take only the requested limit
        products = all_products[:limit]

        result = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            result.append({
                'id': product.id,
                'item': product.item.value,
                'category': get_item_category(product.item).value,
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,
                        'customer_type': up.customer_type.value,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()
            })

        return result


    def get_personalized_recommendations(self, user_id: int, customer_type: str) -> Dict:
        try:
            recommendations = self.recommendation_service.get_recommendations_for_user(user_id, customer_type)

            from models.order import UnifiedOrder
            user_orders = (
                self.db.query(UnifiedOrder)
                .filter(
                    UnifiedOrder.customer_id == user_id,
                    UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
                )
                .count()
            )

            has_purchase_history = user_orders > 1

            return {
                'recommendations': recommendations,
                'has_purchase_history': has_purchase_history,
                'total_recommendations': len(recommendations),
                'message': self._get_recommendation_message(has_purchase_history, customer_type)
            }

        except Exception as e:
            print(f"Error getting personalized recommendations: {e}")
            return {
                'recommendations': [],
                'has_purchase_history': False,
                'total_recommendations': 0,
                'message': self._get_recommendation_message(False, customer_type)
            }


    def _get_recommendation_message(self, has_purchase_history: bool, customer_type: str) -> str:
        if not has_purchase_history:
            if customer_type == 'business':
                return "Start ordering to see personalized business recommendations that match your purchasing patterns and help streamline your supply chain."
            else:
                return "Start exploring and ordering to see personalized recommendations that match your taste preferences and cooking habits."
        else:
            if customer_type == 'business':
                return "Based on your ordering history and similar businesses, here are products that might interest you."
            else:
                return "Based on your purchase history and taste preferences, here are fresh products you might enjoy."


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
        query = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(FarmerProduct.is_active == True)
        )

        if search_term:
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

        if min_price is not None or max_price is not None:
            query = query.join(ProductUnitPrice)
            if min_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit >= min_price)
            if max_price is not None:
                query = query.filter(ProductUnitPrice.price_per_unit <= max_price)

        total = query.count()

        products = (
            query.distinct(FarmerProduct.id)
            .order_by(FarmerProduct.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = []
        for product in products:
            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            lowest_price = min(up.price_per_unit for up in product.unit_prices) if product.unit_prices else 0

            items.append({
                'id': product.id,
                'item': product.item.value,
                'category': get_item_category(product.item).value,
                'description': product.description,
                'farmer_id': product.farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer_district,
                'lowest_price': float(lowest_price),
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,
                        'customer_type': up.customer_type.value,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()
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
        farmer = (
            self.db.query(User)
            .options(joinedload(User.farmer_profile))
            .filter(User.id == farmer_id, User.role == 'farmer')
            .first()
        )

        if not farmer:
            return None

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
                'item': product.item.value,
                'category': get_item_category(product.item).value,
                'description': product.description,
                'unit_prices': [
                    {
                        'id': up.id,
                        'unit': up.unit.value,
                        'customer_type': up.customer_type.value,
                        'price_per_unit': float(up.price_per_unit),
                        'quantity_available': up.quantity_available,
                        'minimum_order': up.minimum_order
                    }
                    for up in product.unit_prices
                ],
                'created_at': product.created_at.isoformat()
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
        products = (
            self.db.query(FarmerProduct.item, func.count(FarmerProduct.id).label('count'))
            .filter(FarmerProduct.is_active == True)
            .group_by(FarmerProduct.item)
            .all()
        )

        categories = {}
        for item, count in products:
            category = get_item_category(item)
            if category not in categories:
                categories[category] = {
                    'name': category.value,
                    'total_products': 0,
                    'items': []
                }

            categories[category]['total_products'] += count
            categories[category]['items'].append({
                'item': item.value,
                'count': count
            })

        return list(categories.values())


    def get_districts_with_counts(self) -> List[Dict]:
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