from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, text
from models.order import Cart, CartItem, UnifiedOrder, UnifiedOrderItem, OrderStatusEnum, FarmerPayment
from models.product import FarmerProduct, ProductUnitPrice
from models.user import User
from schemas.order import CartItemCreate, CartItemUpdate
from typing import List, Optional, Dict
from decimal import Decimal
from datetime import datetime, timedelta
from services.notification_service import PushNotificationService


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.notification_service = PushNotificationService(db)

    def get_or_create_cart(self, user_id: int) -> Cart:
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            cart = Cart(user_id=user_id)
            self.db.add(cart)
            self.db.commit()
            self.db.refresh(cart)
        return cart

    def add_to_cart(self, user_id: int, item_data: CartItemCreate) -> CartItem:
        cart = self.get_or_create_cart(user_id)

        unit_price = (
            self.db.query(ProductUnitPrice)
            .join(FarmerProduct)
            .filter(
                ProductUnitPrice.id == item_data.unit_price_id,
                FarmerProduct.id == item_data.farmer_product_id,
                FarmerProduct.is_active == True
            )
            .first()
        )

        if not unit_price:
            raise ValueError("Invalid product or unit price")

        # Check if item already in cart
        existing_item = (
            self.db.query(CartItem)
            .filter(
                CartItem.cart_id == cart.id,
                CartItem.farmer_product_id == item_data.farmer_product_id,
                CartItem.unit_price_id == item_data.unit_price_id
            )
            .first()
        )

        if existing_item:
            new_quantity = existing_item.quantity + item_data.quantity

            if new_quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            existing_item.quantity = new_quantity
            existing_item.unit_price_snapshot = unit_price.price_per_unit
            self.db.commit()
            self.db.refresh(existing_item)
            return existing_item
        else:
            if item_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            if item_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            cart_item = CartItem(
                cart_id=cart.id,
                farmer_product_id=item_data.farmer_product_id,
                unit_price_id=item_data.unit_price_id,
                quantity=item_data.quantity,
                unit_price_snapshot=unit_price.price_per_unit
            )
            self.db.add(cart_item)
            self.db.commit()
            self.db.refresh(cart_item)
            return cart_item

    def update_cart_item(self, user_id: int, cart_item_id: int, update_data: CartItemUpdate) -> CartItem:
        cart_item = (
            self.db.query(CartItem)
            .join(Cart)
            .filter(
                CartItem.id == cart_item_id,
                Cart.user_id == user_id
            )
            .first()
        )

        if not cart_item:
            raise ValueError("Cart item not found")

        if update_data.quantity is not None:
            unit_price = self.db.query(ProductUnitPrice).get(cart_item.unit_price_id)
            if update_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            if update_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            cart_item.quantity = update_data.quantity
            cart_item.unit_price_snapshot = unit_price.price_per_unit

        self.db.commit()
        self.db.refresh(cart_item)
        return cart_item

    def remove_from_cart(self, user_id: int, cart_item_id: int) -> bool:
        cart_item = (
            self.db.query(CartItem)
            .join(Cart)
            .filter(
                CartItem.id == cart_item_id,
                Cart.user_id == user_id
            )
            .first()
        )

        if not cart_item:
            return False

        self.db.delete(cart_item)
        self.db.commit()
        return True

    def get_cart(self, user_id: int) -> Dict:
        cart = (
            self.db.query(Cart)
            .options(
                joinedload(Cart.items)
                .joinedload(CartItem.farmer_product)
                .joinedload(FarmerProduct.farmer)
                .joinedload(User.farmer_profile),
                joinedload(Cart.items)
                .joinedload(CartItem.unit_price)
            )
            .filter(Cart.user_id == user_id)
            .first()
        )

        if not cart or not cart.items:
            return {
                "id": cart.id if cart else None,
                "farmer_groups": [],
                "total_amount": Decimal('0'),
                "total_items": 0,
                "created_at": cart.created_at if cart else None,
                "updated_at": cart.updated_at if cart else None
            }

        # Group items by farmer
        farmer_groups = {}
        total_amount = Decimal('0')

        for item in cart.items:
            farmer_id = item.farmer_product.farmer_id
            farmer = item.farmer_product.farmer

            if farmer_id not in farmer_groups:
                farmer_groups[farmer_id] = {
                    "farmer_id": farmer_id,
                    "farmer_name": f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}",
                    "farmer_district": farmer.farmer_profile.district,
                    "items": [],
                    "subtotal": Decimal('0')
                }

            item.product_name = item.farmer_product.item.value.replace('_', ' ').title()
            item.unit_name = item.unit_price.unit.value
            item.farmer_name = farmer_groups[farmer_id]["farmer_name"]

            farmer_groups[farmer_id]["items"].append(item)
            farmer_groups[farmer_id]["subtotal"] += item.total_price
            total_amount += item.total_price

        return {
            "id": cart.id,
            "farmer_groups": list(farmer_groups.values()),
            "total_amount": total_amount,
            "total_items": len(cart.items),
            "created_at": cart.created_at,
            "updated_at": cart.updated_at
        }

    def clear_cart(self, user_id: int) -> bool:
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        self.db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        self.db.commit()
        return True

    def clear_farmer_items_from_cart(self, user_id: int, farmer_id: int) -> bool:
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        self.db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.farmer_product.has(FarmerProduct.farmer_id == farmer_id)
        ).delete(synchronize_session='fetch')
        self.db.commit()
        return True

    def get_customer_orders(self, user_id: int, status: Optional[str] = None) -> List[UnifiedOrder]:
        query = (
            self.db.query(UnifiedOrder)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment)
            )
            .filter(UnifiedOrder.customer_id == user_id)
        )

        if status:
            query = query.filter(UnifiedOrder.status == status)

        return query.order_by(desc(UnifiedOrder.created_at)).all()

    def get_farmer_orders(self, farmer_id: int, status: Optional[str] = None) -> List[UnifiedOrder]:
        query = (
            self.db.query(UnifiedOrder)
            .join(UnifiedOrderItem)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment)
            )
            .filter(UnifiedOrderItem.farmer_id == farmer_id)
        )

        # Filter by farmer's individual status if specified
        if status:
            # We need to filter orders where this farmer has the specified status
            orders = query.order_by(desc(UnifiedOrder.created_at)).all()
            filtered_orders = []
            for order in orders:
                farmer_status = order.get_farmer_status(farmer_id)
                if farmer_status == status:
                    filtered_orders.append(order)
            return filtered_orders

        return query.order_by(desc(UnifiedOrder.created_at)).all()

    def get_order_by_id(self, order_id: int, user_id: int) -> Optional[UnifiedOrder]:
        # Try customer first
        order = (
            self.db.query(UnifiedOrder)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment),
                joinedload(UnifiedOrder.farmer_payments)
            )
            .filter(
                UnifiedOrder.id == order_id,
                UnifiedOrder.customer_id == user_id
            )
            .first()
        )

        if order:
            return order

        # Try farmer
        order = (
            self.db.query(UnifiedOrder)
            .join(UnifiedOrderItem)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment),
                joinedload(UnifiedOrder.farmer_payments)
            )
            .filter(
                UnifiedOrder.id == order_id,
                UnifiedOrderItem.farmer_id == user_id
            )
            .first()
        )

        return order

    def update_farmer_status(self, order_id: int, farmer_id: int, new_status: str) -> UnifiedOrder:
        order = (
            self.db.query(UnifiedOrder)
            .filter(UnifiedOrder.id == order_id)
            .first()
        )

        if not order:
            raise ValueError("Order not found")

        # Get current farmer status for notification
        old_status = order.get_farmer_status(farmer_id)

        # Update farmer status and recalculate overall status
        delivered_at = None
        if new_status == "delivered":
            delivered_at = datetime.utcnow().isoformat()

        order.update_farmer_status(farmer_id, new_status, delivered_at)

        self.db.commit()
        self.db.refresh(order)

        # Send notification to customer about farmer's status change
        self.notification_service.notify_order_status_change(
            order=order,
            farmer_id=farmer_id,
            new_status=new_status,
            old_status=old_status
        )

        return order

    def get_farmer_order_summary(self, farmer_id: int) -> Dict:
        result = {
            'total_orders': 0,
            'confirmed_orders': 0,
            'processing_orders': 0,
            'out_for_delivery_orders': 0,
            'delivered_orders': 0,
            'cancelled_orders': 0,
            'total_gross_revenue': 0.0,
            'total_net_revenue': 0.0,
            'pending_revenue': 0.0
        }

        try:
            # Get all orders containing farmer's items
            orders = self.get_farmer_orders(farmer_id)

            for order in orders:
                # Check if farmer has items in this order
                farmer_items = [item for item in order.items if item.farmer_id == farmer_id]
                if not farmer_items:
                    continue

                result['total_orders'] += 1

                # Get farmer's individual status
                farmer_status = order.get_farmer_status(farmer_id)

                # Calculate farmer's portion of the order
                farmer_payment = next(
                    (fp for fp in order.farmer_payments if fp.farmer_id == farmer_id),
                    None
                )

                if farmer_payment:
                    gross_amount = float(farmer_payment.gross_amount or 0)
                    net_amount = float(farmer_payment.net_amount or 0)

                    result['total_gross_revenue'] += gross_amount
                    result['total_net_revenue'] += net_amount

                    # Count by farmer's individual status
                    if farmer_status == "confirmed":
                        result['confirmed_orders'] += 1
                        result['pending_revenue'] += net_amount
                    elif farmer_status == "processing":
                        result['processing_orders'] += 1
                        result['pending_revenue'] += net_amount
                    elif farmer_status == "out_for_delivery":
                        result['out_for_delivery_orders'] += 1
                        result['pending_revenue'] += net_amount
                    elif farmer_status == "delivered":
                        result['delivered_orders'] += 1
                    elif farmer_status == "cancelled":
                        result['cancelled_orders'] += 1

        except Exception as e:
            print(f"Error in get_farmer_order_summary: {e}")

        return result

    def get_farmer_sales_for_period(self, farmer_id: int, period: str) -> Dict:
        try:
            now = datetime.now()

            # Get all farmer orders first
            all_orders = self.get_farmer_orders(farmer_id)

            # Filter by period
            filtered_orders = []

            if period == 'this_week':
                start_date = now - timedelta(days=7)
                filtered_orders = [o for o in all_orders if o.created_at >= start_date]
            elif period == 'this_month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_orders = [o for o in all_orders if o.created_at >= start_date]
            elif period == 'this_year':
                current_year = now.year
                filtered_orders = [o for o in all_orders if o.created_at.year == current_year]
            elif period == 'all_time':
                filtered_orders = all_orders
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                month_mapping = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }
                target_month = month_mapping[period]
                current_year = now.year
                filtered_orders = [
                    o for o in all_orders
                    if o.created_at.year == current_year and o.created_at.month == target_month
                ]
            else:
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_orders = [o for o in all_orders if o.created_at >= start_date]

            sales_count = len(filtered_orders)
            return {'total_sales': sales_count}

        except Exception as e:
            print(f"Error getting farmer sales for period {period}: {e}")
            return {'total_sales': 0}

    def get_farmer_revenue_for_period(self, farmer_id: int, period: str) -> Dict:
        try:
            now = datetime.now()

            # Get all farmer payments
            all_payments = (
                self.db.query(FarmerPayment, UnifiedOrder.created_at)
                .join(UnifiedOrder, FarmerPayment.order_id == UnifiedOrder.id)
                .filter(FarmerPayment.farmer_id == farmer_id)
                .all()
            )

            filtered_payments = []

            if period == 'this_week':
                start_date = now - timedelta(days=7)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]
            elif period == 'this_month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]
            elif period == 'this_year':
                current_year = now.year
                filtered_payments = [p for p, created_at in all_payments if created_at.year == current_year]
            elif period == 'all_time':
                filtered_payments = [p for p, created_at in all_payments]
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                month_mapping = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }
                target_month = month_mapping[period]
                current_year = now.year
                filtered_payments = [
                    p for p, created_at in all_payments
                    if created_at.year == current_year and created_at.month == target_month
                ]
            else:
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]

            gross_revenue = sum(float(p.gross_amount or 0) for p in filtered_payments)
            net_revenue = sum(float(p.net_amount or 0) for p in filtered_payments)

            return {
                'grossRevenue': gross_revenue,
                'netRevenue': net_revenue
            }

        except Exception as e:
            print(f"Error getting farmer revenue for period {period}: {e}")
            return {
                'grossRevenue': 0.0,
                'netRevenue': 0.0
            }