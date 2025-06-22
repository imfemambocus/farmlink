# services/order_service.py - UNIFIED SYSTEM ONLY
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, text
from models.order import Cart, CartItem, UnifiedOrder, UnifiedOrderItem, UnifiedPayment, OrderStatusEnum, FarmerPayment
from models.product import FarmerProduct, ProductUnitPrice
from models.user import User
from schemas.order import CartItemCreate, CartItemUpdate
from typing import List, Optional, Dict, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from services.notification_service import PushNotificationService


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.notification_service = PushNotificationService(db)

    # ==========================================
    # CART MANAGEMENT
    # ==========================================

    def get_or_create_cart(self, user_id: int) -> Cart:
        """Get existing cart or create new one for user"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            cart = Cart(user_id=user_id)
            self.db.add(cart)
            self.db.commit()
            self.db.refresh(cart)
        return cart

    def add_to_cart(self, user_id: int, item_data: CartItemCreate) -> CartItem:
        """Add item to cart or update quantity if already exists"""
        cart = self.get_or_create_cart(user_id)

        # Validate product and unit price
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
            # Update quantity
            new_quantity = existing_item.quantity + item_data.quantity

            # Check availability
            if new_quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            existing_item.quantity = new_quantity
            existing_item.unit_price_snapshot = unit_price.price_per_unit
            self.db.commit()
            self.db.refresh(existing_item)
            return existing_item
        else:
            # Check availability
            if item_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            # Check minimum order
            if item_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            # Create new cart item
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
        """Update cart item quantity"""
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
            # Validate availability
            unit_price = self.db.query(ProductUnitPrice).get(cart_item.unit_price_id)
            if update_data.quantity > unit_price.quantity_available:
                raise ValueError(f"Not enough stock. Available: {unit_price.quantity_available}")

            if update_data.quantity < unit_price.minimum_order:
                raise ValueError(f"Minimum order quantity is {unit_price.minimum_order}")

            cart_item.quantity = update_data.quantity
            cart_item.unit_price_snapshot = unit_price.price_per_unit  # Update price

        self.db.commit()
        self.db.refresh(cart_item)
        return cart_item

    def remove_from_cart(self, user_id: int, cart_item_id: int) -> bool:
        """Remove item from cart"""
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
        """Get user's cart with all items grouped by farmer"""
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

            # Add product info to item
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
        """Clear all items from cart"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        self.db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        self.db.commit()
        return True

    def clear_farmer_items_from_cart(self, user_id: int, farmer_id: int) -> bool:
        """Clear items for specific farmer from cart"""
        cart = self.db.query(Cart).filter(Cart.user_id == user_id).first()
        if not cart:
            return False

        # Delete cart items for specific farmer
        self.db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.farmer_product.has(FarmerProduct.farmer_id == farmer_id)
        ).delete(synchronize_session='fetch')
        self.db.commit()
        return True

    # ==========================================
    # UNIFIED ORDER MANAGEMENT
    # ==========================================

    def get_customer_orders(self, user_id: int, status: Optional[str] = None) -> List[UnifiedOrder]:
        """Get unified orders for customer"""
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
        """Get unified orders that contain items from this farmer"""
        query = (
            self.db.query(UnifiedOrder)
            .join(UnifiedOrderItem)
            .options(
                joinedload(UnifiedOrder.items),
                joinedload(UnifiedOrder.payment)
            )
            .filter(UnifiedOrderItem.farmer_id == farmer_id)
        )

        if status:
            query = query.filter(UnifiedOrder.status == status)

        return query.order_by(desc(UnifiedOrder.created_at)).all()

    def get_order_by_id(self, order_id: int, user_id: int) -> Optional[UnifiedOrder]:
        """Get unified order by ID (customer or farmer can access)"""
        # Check if user is customer
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

        # Check if user is farmer with items in this order
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

    def update_order_status(self, order_id: int, user_id: int, new_status: str) -> UnifiedOrder:
        """Update unified order status with notifications"""
        order = (
            self.db.query(UnifiedOrder)
            .filter(UnifiedOrder.id == order_id)
            .first()
        )

        if not order:
            raise ValueError("Order not found")

        old_status = order.status

        # Update status and timestamps
        order.status = new_status

        if new_status == "delivered" and not order.delivered_at:
            order.delivered_at = datetime.utcnow()
            # Mark payment as successful when delivered
            if order.payment:
                order.payment.status = "successful"
                order.payment.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(order)

        # Send notification to customer about farmer's status change
        # Check if the user updating is a farmer
        user = self.db.query(User).get(user_id)
        if user and user.role == 'farmer':
            # Check if farmer has items in this order
            farmer_items = [item for item in order.items if item.farmer_id == user_id]
            if farmer_items:
                self.notification_service.notify_order_status_change(
                    order=order,
                    farmer_id=user_id,
                    new_status=new_status,
                    old_status=old_status
                )

        return order

    def get_farmer_order_summary(self, farmer_id: int) -> Dict:
        """Get order summary for farmer dashboard - SQLite optimized with zero handling"""

        # Initialize with zeros
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
            # Get farmer payment records with simple SQLite query
            farmer_payments = (
                self.db.query(FarmerPayment, UnifiedOrder.status)
                .join(UnifiedOrder, FarmerPayment.order_id == UnifiedOrder.id)
                .filter(FarmerPayment.farmer_id == farmer_id)
                .all()
            )

            # Process results in Python (SQLite-friendly)
            for payment, status in farmer_payments:
                result['total_orders'] += 1

                gross_amount = float(payment.gross_amount or 0)
                net_amount = float(payment.net_amount or 0)

                result['total_gross_revenue'] += gross_amount
                result['total_net_revenue'] += net_amount

                # Count by status
                if status == OrderStatusEnum.CONFIRMED:
                    result['confirmed_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.PROCESSING:
                    result['processing_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.OUT_FOR_DELIVERY:
                    result['out_for_delivery_orders'] += 1
                    result['pending_revenue'] += net_amount
                elif status == OrderStatusEnum.DELIVERED:
                    result['delivered_orders'] += 1
                elif status == OrderStatusEnum.CANCELLED:
                    result['cancelled_orders'] += 1

        except Exception as e:
            print(f"Error in get_farmer_order_summary: {e}")
            # Return zeros on error

        return result

    def get_farmer_sales_for_period(self, farmer_id: int, period: str) -> Dict:
        """Get farmer sales count for specific time period - SQLite optimized"""

        try:
            # Get current date for filtering
            now = datetime.now()

            # SQLite-friendly date filtering using string comparison
            if period == 'this_week':
                start_date = (now - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'this_month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'this_year':
                start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).strftime(
                    '%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date
            elif period == 'all_time':
                date_filter = text('1=1')  # SQLite-friendly always true
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                # Specific month using SQLite strftime
                month_mapping = {
                    'january': '01', 'february': '02', 'march': '03', 'april': '04',
                    'may': '05', 'june': '06', 'july': '07', 'august': '08',
                    'september': '09', 'october': '10', 'november': '11', 'december': '12'
                }
                target_month = month_mapping[period]
                current_year = str(now.year)

                # Use SQLite strftime function
                date_filter = text(
                    f"strftime('%Y', unified_orders.created_at) = '{current_year}' AND strftime('%m', unified_orders.created_at) = '{target_month}'")
            else:
                # Default to this month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%d %H:%M:%S')
                date_filter = UnifiedOrder.created_at >= start_date

            # Simple SQLite-friendly query
            if period == 'all_time':
                sales_count = (
                    self.db.query(UnifiedOrder.id)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(FarmerPayment.farmer_id == farmer_id)
                    .count()
                )
            elif period in ['january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december']:
                # For month filtering, get all orders and filter in Python (SQLite-friendly)
                orders = (
                    self.db.query(UnifiedOrder.created_at)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(FarmerPayment.farmer_id == farmer_id)
                    .all()
                )

                month_mapping = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4,
                    'may': 5, 'june': 6, 'july': 7, 'august': 8,
                    'september': 9, 'october': 10, 'november': 11, 'december': 12
                }
                target_month = month_mapping[period]
                current_year = now.year

                sales_count = 0
                for order in orders:
                    order_date = order.created_at
                    if order_date.year == current_year and order_date.month == target_month:
                        sales_count += 1
            else:
                # For other periods, use simple date comparison
                sales_count = (
                    self.db.query(UnifiedOrder.id)
                    .join(FarmerPayment, UnifiedOrder.id == FarmerPayment.order_id)
                    .filter(
                        FarmerPayment.farmer_id == farmer_id,
                        date_filter
                    )
                    .count()
                )

            return {'total_sales': sales_count or 0}

        except Exception as e:
            print(f"Error getting farmer sales for period {period}: {e}")
            return {'total_sales': 0}

    def get_farmer_revenue_for_period(self, farmer_id: int, period: str) -> Dict:
        """Get farmer revenue for specific time period - SQLite optimized"""

        try:
            # Get current date for filtering
            now = datetime.now()

            # Get all farmer payments first (SQLite-friendly approach)
            all_payments = (
                self.db.query(FarmerPayment, UnifiedOrder.created_at)
                .join(UnifiedOrder, FarmerPayment.order_id == UnifiedOrder.id)
                .filter(FarmerPayment.farmer_id == farmer_id)
                .all()
            )

            # Filter in Python (more reliable for SQLite)
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
                # Default to this month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_payments = [p for p, created_at in all_payments if created_at >= start_date]

            # Calculate totals in Python
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