from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from services.stripe_service import StripePaymentService, handle_stripe_webhook
from core.security import get_current_user, get_db
from models.order import UnifiedOrder
import json


router = APIRouter()


class PaymentIntentRequest(BaseModel):
    amount: int
    currency: str = "mur"
    cart_id: int
    delivery_info: dict


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str


class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str
    delivery_info: dict
    payment_method_type: str = "stripe_card"


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
def create_payment_intent(
        request: PaymentIntentRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can create payments")

    try:
        service = StripePaymentService(db)
        result = service.create_payment_intent(
            user_id=current_user.id,
            cart_id=request.cart_id,
            delivery_info=request.delivery_info,
            amount_cents=request.amount
        )

        return PaymentIntentResponse(
            client_secret=result['client_secret'],
            payment_intent_id=result['payment_intent_id']
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm-payment")
def confirm_payment(
        request: ConfirmPaymentRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can confirm payments")

    try:
        service = StripePaymentService(db)
        result = service.confirm_payment_and_create_order(
            user_id=current_user.id,
            payment_intent_id=request.payment_intent_id,
            delivery_info=request.delivery_info,
            payment_method_type=request.payment_method_type
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders/{order_id}")
def get_unified_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    order = (
        db.query(UnifiedOrder)
        .filter(
            UnifiedOrder.id == order_id,
            UnifiedOrder.customer_id == current_user.id
        )
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Group items by farmer for display
    farmer_groups = {}
    for item in order.items:
        farmer_id = item.farmer_id
        if farmer_id not in farmer_groups:
            farmer = item.farmer
            farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}"
            farmer_groups[farmer_id] = {
                'farmer_id': farmer_id,
                'farmer_name': farmer_name,
                'farmer_district': farmer.farmer_profile.district,
                'items': [],
                'subtotal': 0
            }

        farmer_groups[farmer_id]['items'].append({
            'item_name': item.item_name,
            'unit': item.unit,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price),
            'total_price': float(item.total_price),
            'description': item.product_description
        })
        farmer_groups[farmer_id]['subtotal'] += float(item.total_price)

    return {
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'total_amount': float(order.total_amount),
        'delivery_fee': float(order.delivery_fee),
        'final_amount': float(order.final_amount),
        'customer_name': order.customer_name,
        'customer_phone': order.customer_phone,
        'delivery_address': order.delivery_address,
        'delivery_notes': order.delivery_notes,
        'farmer_groups': list(farmer_groups.values()),
        'payment': {
            'method': order.payment.payment_method if order.payment else None,
            'status': order.payment.status if order.payment else None,
            'completed_at': order.payment.completed_at.isoformat() if order.payment and order.payment.completed_at else None
        },
        'created_at': order.created_at.isoformat(),
        'updated_at': order.updated_at.isoformat()
    }


@router.get("/orders")
def get_customer_orders(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can view orders")

    orders = (
        db.query(UnifiedOrder)
        .filter(UnifiedOrder.customer_id == current_user.id)
        .order_by(UnifiedOrder.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        # Count farmers and items
        farmer_ids = set(item.farmer_id for item in order.items)

        result.append({
            'id': order.id,
            'order_number': order.order_number,
            'status': order.status,
            'final_amount': float(order.final_amount),
            'farmer_count': len(farmer_ids),
            'item_count': len(order.items),
            'created_at': order.created_at.isoformat()
        })

    return result


@router.get("/farmer/earnings")
def get_farmer_earnings(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can view earnings")

    service = StripePaymentService(db)
    return service.get_farmer_earnings_summary(current_user.id)


# To set up when this app goes to production
@router.post("/refund/{order_id}")
def process_refund(
        order_id: int,
        amount_cents: Optional[int] = None,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        service = StripePaymentService(db)
        result = service.process_refund(order_id, amount_cents)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# To set up for Stripe testing
@router.post("/webhook")
async def stripe_webhook(
        request: Request,
        stripe_signature: str = Header(None, alias="stripe-signature")
):
    try:
        payload = await request.body()
        event_data = json.loads(payload)

        result = handle_stripe_webhook(event_data, stripe_signature)
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")