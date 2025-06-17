from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc
from models.order import Cart, CartItem, Order, OrderItem, Payment, OrderStatusEnum, PaymentStatusEnum
from models.product import FarmerProduct, ProductUnitPrice
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from schemas.order import CartItemCreate, CartItemUpdate, OrderCreateRequest, OrderUpdateRequest, CartFarmerGroup
from typing import List, Optional, Dict, Tuple
from decimal import Decimal
from datetime import datetime
import uuid


class OrderService:
    def __init__(self, db: Session):
        self.db = db

    # Cart Management
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

    # Order Management
    def create_order_from_cart(self, user_id: int, order_data: OrderCreateRequest) -> Order:
        """Create order from cart items for specific farmer"""
        try:
            cart = self.get_or_create_cart(user_id)

            # Get cart items for specific farmer
            cart_items = (
                self.db.query(CartItem)
                .join(FarmerProduct)
                .filter(
                    CartItem.cart_id == cart.id,
                    FarmerProduct.farmer_id == order_data.farmer_id
                )
                .all()
            )

            if not cart_items:
                raise ValueError("No items found for this farmer in your cart")

            # Get user profile for order snapshot
            user = self.db.query(User).get(user_id)
            customer_name = ""
            customer_phone = ""

            if user.role == "individual" and user.individual_profile:
                customer_name = f"{user.individual_profile.first_name} {user.individual_profile.last_name}"
                customer_phone = user.individual_profile.phone_number
            elif user.role == "business" and user.business_profile:
                customer_name = user.business_profile.business_name
                customer_phone = user.business_profile.phone_number

            # Calculate totals
            total_amount = sum(item.total_price for item in cart_items)
            delivery_fee = Decimal('50.00')  # Fixed delivery fee for now
            final_amount = total_amount + delivery_fee

            # Generate order number
            order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

            # Create order
            order = Order(
                order_number=order_number,
                customer_id=user_id,
                farmer_id=order_data.farmer_id,
                total_amount=total_amount,
                delivery_fee=delivery_fee,
                final_amount=final_amount,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=user.email,
                delivery_address=order_data.delivery_address,
                delivery_notes=order_data.delivery_notes,
                status=OrderStatusEnum.CONFIRMED
            )

            self.db.add(order)
            self.db.flush()

            # Create order items and reduce stock
            for cart_item in cart_items:
                product = cart_item.farmer_product
                unit_price_obj = cart_item.unit_price

                # Double-check stock availability
                if cart_item.quantity > unit_price_obj.quantity_available:
                    raise ValueError(f"Not enough stock for {product.item.value}")

                order_item = OrderItem(
                    order_id=order.id,
                    farmer_product_id=cart_item.farmer_product_id,
                    item_name=product.item.value.replace('_', ' ').title(),
                    unit=unit_price_obj.unit.value,
                    unit_price=cart_item.unit_price_snapshot,
                    quantity=cart_item.quantity,
                    total_price=cart_item.total_price,
                    product_description=product.description
                )
                self.db.add(order_item)

                # Reduce stock quantity
                unit_price_obj.quantity_available -= cart_item.quantity

            # Create payment record
            payment = Payment(
                order_id=order.id,
                payment_method=order_data.payment_method,
                amount=final_amount,
                currency="LKR",
                status=PaymentStatusEnum.PENDING
            )
            self.db.add(payment)

            # Remove items from cart
            for cart_item in cart_items:
                self.db.delete(cart_item)

            self.db.commit()
            self.db.refresh(order)
            return order

        except Exception as e:
            self.db.rollback()
            raise e

    def get_customer_orders(self, user_id: int, status: Optional[str] = None) -> List[Order]:
        """Get orders for customer"""
        query = (
            self.db.query(Order)
            .options(
                joinedload(Order.items),
                joinedload(Order.farmer).joinedload(User.farmer_profile)
            )
            .filter(Order.customer_id == user_id)
        )

        if status:
            query = query.filter(Order.status == status)

        return query.order_by(desc(Order.created_at)).all()

    def get_farmer_orders(self, farmer_id: int, status: Optional[str] = None) -> List[Order]:
        """Get orders for farmer"""
        query = (
            self.db.query(Order)
            .options(joinedload(Order.items))
            .filter(Order.farmer_id == farmer_id)
        )

        if status:
            query = query.filter(Order.status == status)

        return query.order_by(desc(Order.created_at)).all()

    def update_order_status(self, order_id: int, user_id: int, update_data: OrderUpdateRequest) -> Order:
        """Update order status (farmers only)"""
        order = (
            self.db.query(Order)
            .filter(
                Order.id == order_id,
                Order.farmer_id == user_id
            )
            .first()
        )

        if not order:
            raise ValueError("Order not found")

        # Update status and timestamps
        old_status = order.status
        order.status = update_data.status

        if update_data.status == OrderStatusEnum.OUT_FOR_DELIVERY and not order.out_for_delivery_at:
            order.out_for_delivery_at = datetime.utcnow()
        elif update_data.status == OrderStatusEnum.DELIVERED and not order.delivered_at:
            order.delivered_at = datetime.utcnow()
            # Mark payment as successful when delivered
            if order.payment:
                order.payment.status = PaymentStatusEnum.SUCCESSFUL
                order.payment.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(order)
        return order

    def get_order_by_id(self, order_id: int, user_id: int) -> Optional[Order]:
        """Get order by ID (customer or farmer can access)"""
        return (
            self.db.query(Order)
            .options(
                joinedload(Order.items),
                joinedload(Order.farmer).joinedload(User.farmer_profile),
                joinedload(Order.customer),
                joinedload(Order.payment)
            )
            .filter(
                Order.id == order_id,
                (Order.customer_id == user_id) | (Order.farmer_id == user_id)
            )
            .first()
        )

    def get_farmer_order_summary(self, farmer_id: int) -> Dict:
        """Get order summary for farmer dashboard"""
        from sqlalchemy import func

        # Get order counts by status
        summary = (
            self.db.query(
                Order.status,
                func.count(Order.id).label('count'),
                func.sum(Order.final_amount).label('total_amount')
            )
            .filter(Order.farmer_id == farmer_id)
            .group_by(Order.status)
            .all()
        )

        result = {
            'total_orders': 0,
            'confirmed_orders': 0,
            'out_for_delivery_orders': 0,
            'delivered_orders': 0,
            'total_revenue': 0,
            'pending_revenue': 0
        }

        for status, count, amount in summary:
            result['total_orders'] += count
            amount_float = float(amount or 0)
            result['total_revenue'] += amount_float

            if status == OrderStatusEnum.CONFIRMED:
                result['confirmed_orders'] = count
                result['pending_revenue'] += amount_float
            elif status == OrderStatusEnum.OUT_FOR_DELIVERY:
                result['out_for_delivery_orders'] = count
                result['pending_revenue'] += amount_float
            elif status == OrderStatusEnum.DELIVERED:
                result['delivered_orders'] = count

        return result