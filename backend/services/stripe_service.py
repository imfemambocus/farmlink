import shortuuid
import stripe
from sqlalchemy.orm import Session
from models.order import UnifiedOrder, UnifiedOrderItem, UnifiedPayment, FarmerPayment, PaymentMethodEnum, PaymentStatusEnum
from models.product import ProductUnitPrice
from models.user import User
from models.order import CartItem
from typing import Dict, Optional
from decimal import Decimal
from datetime import datetime
import os
import json
from services.notification_service import PushNotificationService


stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_51RbVKCR2koWNU5mYSnmPAflOWt81mMJWmDDZyh7u6OE6ene713vJjY1nEoaSGaQgcqfgUmaTqwraPYHnSXXlvAvA00nUOCyvoS")


class StripePaymentService:
    def __init__(self, db: Session):
        self.db = db
        self.platform_fee_percentage = float(os.getenv("PLATFORM_FEE_PERCENTAGE", "2.5"))
        self.delivery_fee = Decimal(os.getenv("DELIVERY_FEE", "75.0"))
        self.notification_service = PushNotificationService(db)


    def create_payment_intent(
            self,
            user_id: int,
            cart_id: int,
            delivery_info: Dict,
            amount_cents: int
    ) -> Dict:
        # Create Stripe payment intent for the cart
        try:
            # Get cart and validate
            cart = self.get_cart_with_items(user_id, cart_id)
            if not cart or not cart.get('farmer_groups'):
                raise ValueError("Cart is empty or not found")

            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='mur',  # Mauritian Rupees
                automatic_payment_methods={
                    'enabled': True,
                },
                metadata={
                    'user_id': str(user_id),
                    'cart_id': str(cart_id),
                    'platform': 'farmlink_mobile'
                },
                description=f"Farmlink Order - {len(cart.get('farmer_groups', []))} farmers, {cart.get('total_items', 0)} items"
            )

            return {
                'client_secret': payment_intent.client_secret,
                'payment_intent_id': payment_intent.id
            }

        except Exception as e:
            raise Exception(f"Failed to create payment intent: {str(e)}")


    def confirm_payment_and_create_order(
            self,
            user_id: int,
            payment_intent_id: str,
            delivery_info: Dict,
            payment_method_type: str = "stripe_card"
    ) -> Dict:
        try:
            payment_intent = stripe.PaymentIntent.retrieve(
                payment_intent_id,
                expand=['charges']
            )

            if payment_intent.status != 'succeeded':
                raise Exception(f"Payment not successful. Status: {payment_intent.status}")

            cart_id = int(payment_intent.metadata.get('cart_id'))
            cart = self.get_cart_with_items(user_id, cart_id)

            if not cart or not cart.get('farmer_groups'):
                raise ValueError("Cart is empty or not found")

            # Get user profile
            user = self.db.query(User).get(user_id)
            customer_name, customer_phone = self.get_customer_info(user)

            # Generate order number
            shortuuid.set_alphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ")
            order_number = f"FL-{shortuuid.random(length=6)}"

            # Calculate totals
            total_amount = sum(Decimal(str(group['subtotal'])) for group in cart.get('farmer_groups', []))
            delivery_fee = self.delivery_fee
            final_amount = total_amount + delivery_fee

            # Create unified order
            order = UnifiedOrder(
                order_number=order_number,
                customer_id=user_id,
                total_amount=total_amount,
                delivery_fee=delivery_fee,
                final_amount=final_amount,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=user.email,
                delivery_address=delivery_info['address'],
                delivery_notes=delivery_info.get('notes', '')
            )

            self.db.add(order)
            self.db.flush()

            # Create order items and farmer payments
            farmer_totals = {}

            for group in cart.get('farmer_groups', []):
                farmer_id = group['farmer_id']
                farmer_total = Decimal('0')

                for item in group.get('items', []):
                    order_item = UnifiedOrderItem(
                        order_id=order.id,
                        farmer_id=farmer_id,
                        farmer_product_id=item.farmer_product_id,
                        item_name=item.product_name,
                        unit=item.unit_name,
                        unit_price=Decimal(str(item.unit_price_snapshot)),
                        quantity=item.quantity,
                        total_price=Decimal(str(item.total_price)),
                        product_description=getattr(item.farmer_product, 'description', '') or ''
                    )
                    self.db.add(order_item)

                    farmer_total += item.total_price

                    # Update product stock
                    unit_price = self.db.query(ProductUnitPrice).get(item.unit_price_id)
                    if unit_price:
                        unit_price.quantity_available -= item.quantity

                farmer_totals[farmer_id] = farmer_total

            # Create farmer payment records
            for farmer_id, gross_amount in farmer_totals.items():
                platform_fee = gross_amount * (Decimal(str(self.platform_fee_percentage)) / 100)
                net_amount = gross_amount - platform_fee

                farmer_payment = FarmerPayment(
                    order_id=order.id,
                    farmer_id=farmer_id,
                    gross_amount=gross_amount,
                    platform_fee=platform_fee,
                    net_amount=net_amount,
                    platform_fee_percentage=self.platform_fee_percentage
                )
                self.db.add(farmer_payment)

            payment_method_map = {
                'stripe_card': PaymentMethodEnum.STRIPE_CARD,
                'stripe_apple_pay': PaymentMethodEnum.STRIPE_APPLE_PAY,
                'stripe_google_pay': PaymentMethodEnum.STRIPE_GOOGLE_PAY
            }

            # Get charge ID safely
            stripe_charge_id = None
            try:
                if hasattr(payment_intent, 'charges') and payment_intent.charges and payment_intent.charges.data:
                    stripe_charge_id = payment_intent.charges.data[0].id
                elif hasattr(payment_intent, 'latest_charge') and payment_intent.latest_charge:
                    stripe_charge_id = payment_intent.latest_charge
            except (AttributeError, IndexError, KeyError):
                pass

            payment = UnifiedPayment(
                order_id=order.id,
                payment_method=payment_method_map.get(payment_method_type, PaymentMethodEnum.STRIPE_CARD),
                status=PaymentStatusEnum.SUCCESSFUL,
                amount=final_amount,
                stripe_payment_intent_id=payment_intent_id,
                stripe_payment_method_id=getattr(payment_intent, 'payment_method', None),
                stripe_charge_id=stripe_charge_id,
                completed_at=datetime.utcnow(),
                gateway_response=json.dumps({
                    'payment_intent': payment_intent_id,
                    'amount_received': getattr(payment_intent, 'amount_received', payment_intent.amount),
                    'status': payment_intent.status
                })
            )
            self.db.add(payment)

            # Clear cart items
            self.clear_cart_items(cart_id)

            self.db.commit()

            # Send notifications
            self.notification_service.notify_new_order_to_farmers(order)

            return {
                'order_id': order.id,
                'order_number': order_number,
                'status': 'success',
                'amount': float(final_amount)
            }

        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to create order: {str(e)}")


    def get_cart_with_items(self, user_id: int, cart_id: int) -> Optional[Dict]:
        from services.order_service import OrderService
        order_service = OrderService(self.db)
        return order_service.get_cart(user_id)


    def get_customer_info(self, user: User) -> tuple:
        if user.role == "individual" and user.individual_profile:
            name = f"{user.individual_profile.first_name} {user.individual_profile.last_name}"
            phone = user.individual_profile.phone_number
        elif user.role == "business" and user.business_profile:
            name = user.business_profile.contact_name
            phone = user.business_profile.phone_number
        else:
            name = user.email
            phone = ""

        return name, phone


    def clear_cart_items(self, cart_id: int):
        self.db.query(CartItem).filter(CartItem.cart_id == cart_id).delete()


    def get_farmer_earnings_summary(self, farmer_id: int) -> Dict:
        payments = (
            self.db.query(FarmerPayment)
            .filter(FarmerPayment.farmer_id == farmer_id)
            .all()
        )

        total_gross = sum(p.gross_amount for p in payments)
        total_fees = sum(p.platform_fee for p in payments)
        total_net = sum(p.net_amount for p in payments)

        pending_payments = [p for p in payments if p.payment_status == "pending"]
        paid_payments = [p for p in payments if p.payment_status == "paid"]

        return {
            'total_gross_earnings': float(total_gross),
            'total_platform_fees': float(total_fees),
            'total_net_earnings': float(total_net),
            'pending_amount': float(sum(p.net_amount for p in pending_payments)),
            'paid_amount': float(sum(p.net_amount for p in paid_payments)),
            'total_orders': len(payments),
            'recent_payments': [
                {
                    'order_number': p.order.order_number,
                    'gross_amount': float(p.gross_amount),
                    'platform_fee': float(p.platform_fee),
                    'net_amount': float(p.net_amount),
                    'status': p.payment_status,
                    'created_at': p.created_at.isoformat()
                }
                for p in sorted(payments, key=lambda x: x.created_at, reverse=True)[:10]
            ]
        }


    # To be used for production ready app
    def process_refund(self, order_id: int, amount_cents: Optional[int] = None) -> Dict:
        try:
            order = self.db.query(UnifiedOrder).get(order_id)
            if not order or not order.payment:
                raise ValueError("Order or payment not found")

            if not order.payment.stripe_payment_intent_id:
                raise ValueError("No Stripe payment found for this order")

            # Create refund with Stripe
            refund_amount = amount_cents or int(order.final_amount * 100)

            refund = stripe.Refund.create(
                payment_intent=order.payment.stripe_payment_intent_id,
                amount=refund_amount,
                metadata={
                    'order_id': str(order_id),
                    'order_number': order.order_number
                }
            )

            # Update payment status
            order.payment.status = PaymentStatusEnum.REFUNDED
            order.payment.gateway_response = json.dumps({
                'refund_id': refund.id,
                'refund_status': refund.status,
                'amount_refunded': refund.amount
            })

            # Update order status
            order.status = "cancelled"

            self.db.commit()

            return {
                'refund_id': refund.id,
                'amount_refunded': refund.amount / 100,
                'status': refund.status
            }

        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to process refund: {str(e)}")