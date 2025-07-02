from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, distinct
from models.user import User
from models.product import FarmerProduct, CategoryEnum, ItemEnum, get_item_category
from models.order import UnifiedOrder, UnifiedOrderItem
from typing import List, Dict, Tuple
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict, Counter
import pandas as pd


class MLRecommendationService:
    def __init__(self, db: Session):
        self.db = db
        self.n_recommendations = 6  # Number of products to recommend

    def get_recommendations_for_user(self, user_id: int, customer_type: str) -> List[Dict]:
        # Get personalized recommendations using hybrid approach
        try:
            # Get user's purchase history
            user_purchases = self._get_user_purchase_history(user_id)

            if len(user_purchases) < 2:  # New user with minimal history
                return self._get_new_user_recommendations(customer_type)

            collaborative_recs = self._collaborative_filtering(user_id, customer_type)
            content_recs = self._content_based_filtering(user_id, customer_type)

            # Combine recommendations (60% collaborative, 40% content-based)
            hybrid_recs = self._combine_recommendations(
                collaborative_recs, content_recs,
                collaborative_weight=0.6, content_weight=0.4
            )

            return self._get_product_details(hybrid_recs, customer_type)

        except Exception as e:
            print(f"Error in recommendations: {e}")
            # Fallback to popular products
            return self._get_popular_products(customer_type)


    def _get_user_purchase_history(self, user_id: int) -> List[Dict]:
        orders = (
            self.db.query(UnifiedOrderItem)
            .join(UnifiedOrder)
            .filter(
                UnifiedOrder.customer_id == user_id,
                UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
            )
            .all()
        )

        purchases = []
        for item in orders:
            purchases.append({
                'product_id': item.farmer_product_id,
                'farmer_id': item.farmer_id,
                'item_name': item.item_name.lower(),
                'quantity': item.quantity,
                'total_price': float(item.total_price)
            })

        return purchases


    def _collaborative_filtering(self, user_id: int, customer_type: str) -> List[Tuple[int, float]]:
        # Collaborative filtering: Find similar users and recommend their purchases
        try:
            # Get all users of the same type with their purchases
            user_item_matrix = self._create_user_item_matrix(customer_type)

            if user_id not in user_item_matrix.index:
                return []

            # Create user-item matrix for similarity calculation
            matrix = user_item_matrix.fillna(0)

            if len(matrix) < 2:  # Need at least 2 users for collaborative filtering
                return []

            # Calculate user similarity using cosine similarity
            user_similarity = cosine_similarity(matrix)
            user_idx = list(matrix.index).index(user_id)

            # Find most similar users (excluding self)
            similar_users_scores = list(enumerate(user_similarity[user_idx]))
            similar_users_scores = [(i, score) for i, score in similar_users_scores if i != user_idx and score > 0.1]
            similar_users_scores.sort(key=lambda x: x[1], reverse=True)

            # Get recommendations from top 5 similar users
            recommendations = defaultdict(float)
            user_purchased_items = set(matrix.columns[matrix.iloc[user_idx] > 0])

            for similar_user_idx, similarity_score in similar_users_scores[:5]:
                similar_user_items = matrix.columns[matrix.iloc[similar_user_idx] > 0]

                for item in similar_user_items:
                    if item not in user_purchased_items:  # Don't recommend already purchased items
                        recommendations[item] += similarity_score * matrix.iloc[
                            similar_user_idx, matrix.columns.get_loc(item)]

            # Sort by score and return top recommendations
            sorted_recs = sorted(recommendations.items(), key=lambda x: x[1], reverse=True)
            return [(int(product_id), score) for product_id, score in sorted_recs[:self.n_recommendations]]

        except Exception as e:
            print(f"Collaborative filtering error: {e}")
            return []


    def _content_based_filtering(self, user_id: int, customer_type: str) -> List[Tuple[int, float]]:
        # Recommend products similar to user's purchase patterns
        try:
            # Get user's purchase patterns
            user_purchases = self._get_user_purchase_history(user_id)
            if not user_purchases:
                return []

            # Analyze user's preferences
            purchased_categories = []
            purchased_farmers = []

            for purchase in user_purchases:
                # Get product details
                product = self.db.query(FarmerProduct).get(purchase['product_id'])
                if product:
                    purchased_categories.append(get_item_category(product.item).value)
                    purchased_farmers.append(purchase['farmer_id'])

            # Count preferences
            category_preferences = Counter(purchased_categories)
            farmer_preferences = Counter(purchased_farmers)

            # Get products from preferred categories and farmers
            recommended_products = []

            # Get products from top categories
            for category, count in category_preferences.most_common(2):
                category_enum = CategoryEnum(category)
                category_items = [item for item in ItemEnum if get_item_category(item) == category_enum]

                products = (
                    self.db.query(FarmerProduct)
                    .filter(
                        FarmerProduct.item.in_(category_items),
                        FarmerProduct.is_active == True,
                        ~FarmerProduct.id.in_([p['product_id'] for p in user_purchases])
                    )
                    .limit(3)
                    .all()
                )

                for product in products:
                    score = count / len(user_purchases)  # Normalize by total purchases
                    recommended_products.append((product.id, score))

            # Get products from preferred farmers
            for farmer_id, count in farmer_preferences.most_common(3):
                products = (
                    self.db.query(FarmerProduct)
                    .filter(
                        FarmerProduct.farmer_id == farmer_id,
                        FarmerProduct.is_active == True,
                        ~FarmerProduct.id.in_([p['product_id'] for p in user_purchases])
                    )
                    .limit(2)
                    .all()
                )

                for product in products:
                    score = count / len(user_purchases)
                    recommended_products.append((product.id, score))

            # Remove duplicates and sort by score
            unique_recs = {}
            for product_id, score in recommended_products:
                if product_id not in unique_recs:
                    unique_recs[product_id] = score
                else:
                    unique_recs[product_id] = max(unique_recs[product_id], score)

            sorted_recs = sorted(unique_recs.items(), key=lambda x: x[1], reverse=True)
            return sorted_recs[:self.n_recommendations]

        except Exception as e:
            print(f"Content-based filtering error: {e}")
            return []


    def _create_user_item_matrix(self, customer_type: str) -> pd.DataFrame:
        # Create user-item interaction matrix for collaborative filtering
        # Get all users of the same type
        role_filter = ['individual'] if customer_type == 'individual' else ['business']

        # Get purchase data for users of the same type
        purchases = (
            self.db.query(
                UnifiedOrder.customer_id,
                UnifiedOrderItem.farmer_product_id,
                func.sum(UnifiedOrderItem.quantity).label('total_quantity')
            )
            .select_from(UnifiedOrder)
            .join(UnifiedOrderItem, UnifiedOrder.id == UnifiedOrderItem.order_id)
            .join(User, UnifiedOrder.customer_id == User.id)
            .filter(
                User.role.in_(role_filter),
                UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
            )
            .group_by(UnifiedOrder.customer_id, UnifiedOrderItem.farmer_product_id)
            .all()
        )

        # Convert to pandas DataFrame
        data = []
        for purchase in purchases:
            data.append({
                'user_id': purchase.customer_id,
                'product_id': purchase.farmer_product_id,
                'quantity': float(purchase.total_quantity)
            })

        if not data:
            return pd.DataFrame()

        df = pd.DataFrame(data)
        user_item_matrix = df.pivot(index='user_id', columns='product_id', values='quantity')

        return user_item_matrix


    def _combine_recommendations(
            self,
            collaborative: List[Tuple[int, float]],
            content: List[Tuple[int, float]],
            collaborative_weight: float = 0.6,
            content_weight: float = 0.4
    ) -> List[Tuple[int, float]]:
        # Combine collaborative and content-based recommendations

        combined_scores = defaultdict(float)

        # Add collaborative filtering scores
        for product_id, score in collaborative:
            combined_scores[product_id] += score * collaborative_weight

        # Add content-based scores
        for product_id, score in content:
            combined_scores[product_id] += score * content_weight

        # Sort by combined score
        sorted_combined = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_combined[:self.n_recommendations]


    def _get_product_details(self, recommended_products: List[Tuple[int, float]], customer_type: str) -> List[Dict]:
        if not recommended_products:
            return []

        product_ids = [product_id for product_id, _ in recommended_products]

        products = (
            self.db.query(FarmerProduct)
            .options(
                joinedload(FarmerProduct.unit_prices),
                joinedload(FarmerProduct.farmer).joinedload(User.farmer_profile)
            )
            .filter(
                FarmerProduct.id.in_(product_ids),
                FarmerProduct.is_active == True
            )
            .all()
        )

        result = []
        for product in products:
            # Filter unit prices by customer type
            suitable_prices = [
                up for up in product.unit_prices
                if up.customer_type.value == customer_type and up.quantity_available > 0
            ]

            if not suitable_prices:  # Skip if no suitable prices
                continue

            farmer_name = f"{product.farmer.farmer_profile.first_name} {product.farmer.farmer_profile.last_name}"
            farmer_district = product.farmer.farmer_profile.district

            # Get lowest price
            lowest_price = min(up.price_per_unit for up in suitable_prices)

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
                    for up in suitable_prices
                ],
                'created_at': product.created_at.isoformat()
            })

        return result


    def _get_new_user_recommendations(self, customer_type: str) -> List[Dict]:
        # Get recommendations for users with no purchase history
        # Return empty list - the frontend shows the instructional message
        return []


    def _get_popular_products(self, customer_type: str) -> List[Dict]:
        try:
            role_filter = ['individual'] if customer_type == 'individual' else ['business']

            popular_products = (
                self.db.query(
                    UnifiedOrderItem.farmer_product_id,
                    func.count(distinct(UnifiedOrder.customer_id)).label('unique_customers'),
                    func.sum(UnifiedOrderItem.quantity).label('total_quantity')
                )
                .join(UnifiedOrder, UnifiedOrderItem.order_id == UnifiedOrder.id)
                .join(User, UnifiedOrder.customer_id == User.id)
                .filter(
                    User.role.in_(role_filter),
                    UnifiedOrder.status.in_(['delivered', 'out_for_delivery', 'processing'])
                )
                .group_by(UnifiedOrderItem.farmer_product_id)
                .having(func.count(distinct(UnifiedOrder.customer_id)) >= 2)  # At least 2 different customers
                .order_by(desc('unique_customers'), desc('total_quantity'))
                .limit(self.n_recommendations)
                .all()
            )

            if not popular_products:
                return []

            product_ids = [p.farmer_product_id for p in popular_products]
            return self._get_product_details([(pid, 1.0) for pid in product_ids], customer_type)

        except Exception as e:
            print(f"Error getting popular products: {e}")
            return []