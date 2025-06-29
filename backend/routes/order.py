from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from models.user import FarmerProfile, User
from schemas.order import (
    CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse,
    UnifiedOrderResponse, UnifiedOrderListItem,
    FarmerOrderSummary, FarmerStatusUpdateRequest
)
from services.order_service import OrderService
from core.security import get_current_user, get_db
from models.order import OrderStatusEnum, UnifiedOrder, UnifiedOrderItem

router = APIRouter()


@router.post("/cart/items", response_model=CartItemResponse)
def add_to_cart(
        item_data: CartItemCreate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can add items to cart")

    try:
        service = OrderService(db)
        cart_item = service.add_to_cart(current_user.id, item_data)
        return cart_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to add item to cart")


@router.get("/cart", response_model=CartResponse)
def get_cart(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can access cart")

    service = OrderService(db)
    return service.get_cart(current_user.id)


@router.put("/cart/items/{item_id}", response_model=CartItemResponse)
def update_cart_item(
        item_id: int,
        update_data: CartItemUpdate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can update cart")

    try:
        service = OrderService(db)
        cart_item = service.update_cart_item(current_user.id, item_id, update_data)
        return cart_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/cart/items/{item_id}")
def remove_from_cart(
        item_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can modify cart")

    service = OrderService(db)
    success = service.remove_from_cart(current_user.id, item_id)

    if not success:
        raise HTTPException(status_code=404, detail="Cart item not found")

    return {"message": "Item removed from cart"}


@router.delete("/cart")
def clear_cart(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can clear cart")

    service = OrderService(db)
    service.clear_cart(current_user.id)
    return {"message": "Cart cleared successfully"}


@router.get("", response_model=List[UnifiedOrderListItem])
def get_my_orders(
        status: Optional[OrderStatusEnum] = Query(None, description="Filter by order status"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = OrderService(db)

    if current_user.role == 'farmer':
        orders = service.get_farmer_orders(current_user.id, status)
    elif current_user.role in ['individual', 'business']:
        orders = service.get_customer_orders(current_user.id, status)
    else:
        raise HTTPException(status_code=403, detail="Invalid user role")

    result = []
    for order in orders:
        if current_user.role == 'farmer':
            # Get farmer payment data
            farmer_payment = next(
                (fp for fp in order.farmer_payments if fp.farmer_id == current_user.id),
                None
            )

            farmer_items = [item for item in order.items if item.farmer_id == current_user.id]
            farmer_status = order.get_farmer_status(current_user.id)

            order_data = UnifiedOrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=OrderStatusEnum(farmer_status),
                final_amount=sum(item.total_price for item in farmer_items),
                item_count=len(farmer_items),
                created_at=order.created_at
            )

            if farmer_payment:
                order_data.farmer_payment = {
                    "gross_amount": float(farmer_payment.gross_amount),
                    "platform_fee": float(farmer_payment.platform_fee),
                    "net_amount": float(farmer_payment.net_amount),
                    "platform_fee_percentage": farmer_payment.platform_fee_percentage
                }

            result.append(order_data)
        else:
            farmer_ids = set(item.farmer_id for item in order.items)
            result.append(UnifiedOrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=order.final_amount,
                farmer_count=len(farmer_ids),
                item_count=len(order.items),
                created_at=order.created_at
            ))

    return result


@router.get("/{order_id}", response_model=UnifiedOrderResponse)
def get_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = OrderService(db)
    order = service.get_order_by_id(order_id, current_user.id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # For farmers, filter items to show only their products and use their individual status
    items = order.items
    total_amount = order.total_amount
    final_amount = order.final_amount
    status = order.status
    delivered_at = order.delivered_at

    if current_user.role == 'farmer':
        items = [item for item in order.items if item.farmer_id == current_user.id]

        # Check if farmer has items in this order
        if not items:
            raise HTTPException(status_code=403, detail="You don't have items in this order")

        # Calculate farmer-specific totals
        total_amount = sum(item.total_price for item in items)
        final_amount = total_amount

        # Use farmer's individual status
        status = OrderStatusEnum(order.get_farmer_status(current_user.id))

        # Use farmer's individual delivery time
        farmer_delivered_at = order.get_farmer_delivered_at(current_user.id)
        delivered_at = farmer_delivered_at if farmer_delivered_at else None

    return UnifiedOrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=status,
        total_amount=total_amount,
        delivery_fee=0 if current_user.role == 'farmer' else order.delivery_fee,
        final_amount=final_amount,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_email=order.customer_email,
        delivery_address=order.delivery_address,
        delivery_notes=order.delivery_notes,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
        delivered_at=delivered_at
    )


@router.get("/{order_id}/farmers")
def get_order_farmers(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    order = db.query(UnifiedOrder).filter(UnifiedOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_items = (
        db.query(UnifiedOrderItem)
        .filter(UnifiedOrderItem.order_id == order_id)
        .all()
    )

    farmer_ids_in_order = set(item.farmer_id for item in order_items)

    if current_user.id != order.customer_id and current_user.id not in farmer_ids_in_order:
        raise HTTPException(status_code=403, detail="Access denied")

    farmers_info = {}
    for farmer_id in farmer_ids_in_order:
        farmer = db.query(User).filter(User.id == farmer_id).first()

        if farmer:
            farmer_profile = (
                db.query(FarmerProfile)
                .filter(FarmerProfile.user_id == farmer_id)
                .first()
            )

            if farmer_profile:
                farmer_name = f"{farmer_profile.first_name} {farmer_profile.last_name}"
                farmer_district = farmer_profile.district
            else:
                farmer_name = f"Farmer {farmer_id}"
                farmer_district = "Unknown District"
        else:
            farmer_name = f"Farmer {farmer_id}"
            farmer_district = "Unknown District"

        # Get individual farmer status from the JSON field
        farmer_status = order.get_farmer_status(farmer_id)
        farmer_delivered_at = order.get_farmer_delivered_at(farmer_id)

        farmers_info[farmer_id] = {
            "farmer_name": farmer_name,
            "farmer_district": farmer_district,
            "status": farmer_status,
            "delivered_at": farmer_delivered_at
        }

    return {"farmers": farmers_info}


@router.put("/{order_id}/farmer-status")
def update_farmer_status(
        order_id: int,
        update_data: FarmerStatusUpdateRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can use this endpoint")

    service = OrderService(db)
    order = service.get_order_by_id(order_id, current_user.id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if farmer has items in this order
    farmer_items = [item for item in order.items if item.farmer_id == current_user.id]
    if not farmer_items:
        raise HTTPException(status_code=403, detail="You can only update orders containing your products")

    # Validate status transition
    current_farmer_status = order.get_farmer_status(current_user.id)
    allowed_statuses = ['processing', 'out_for_delivery', 'delivered', 'cancelled']

    if update_data.status not in allowed_statuses:
        raise HTTPException(status_code=403, detail=f"Farmers cannot set status to {update_data.status}")

    if current_farmer_status in ['delivered', 'cancelled']:
        raise HTTPException(status_code=403, detail="Cannot modify delivered or cancelled orders")

    try:
        updated_order = service.update_farmer_status(order_id, current_user.id, update_data.status)

        # Return farmer's view of the order
        farmer_status = updated_order.get_farmer_status(current_user.id)
        farmer_delivered_at = updated_order.get_farmer_delivered_at(current_user.id)

        return UnifiedOrderResponse(
            id=updated_order.id,
            order_number=updated_order.order_number,
            status=OrderStatusEnum(farmer_status),
            total_amount=sum(item.total_price for item in farmer_items),
            delivery_fee=0,
            final_amount=sum(item.total_price for item in farmer_items),
            customer_name=updated_order.customer_name,
            customer_phone=updated_order.customer_phone,
            customer_email=updated_order.customer_email,
            delivery_address=updated_order.delivery_address,
            delivery_notes=updated_order.delivery_notes,
            items=farmer_items,
            created_at=updated_order.created_at,
            updated_at=updated_order.updated_at,
            delivered_at=farmer_delivered_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/farmer/orders/summary", response_model=FarmerOrderSummary)
def get_farmer_order_summary(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_order_summary(current_user.id)


@router.get("/farmer/earnings")
def get_farmer_earnings(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can view earnings")

    from services.stripe_service import StripePaymentService

    service = StripePaymentService(db)
    return service.get_farmer_earnings_summary(current_user.id)


@router.get("/farmer/sales/{period}")
def get_farmer_sales_for_period(
        period: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_sales_for_period(current_user.id, period)


@router.get("/farmer/revenue/{period}")
def get_farmer_revenue_for_period(
        period: str,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_revenue_for_period(current_user.id, period)