# routes/orders.py - UNIFIED SYSTEM ONLY
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from schemas.order import (
    CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse,
    UnifiedOrderResponse, UnifiedOrderListItem, UnifiedOrderUpdateRequest,
    UnifiedPaymentResponse, FarmerOrderSummary
)
from services.order_service import OrderService
from core.security import get_current_user, get_db
from models.order import OrderStatusEnum

router = APIRouter()


# ==========================================
# CART ENDPOINTS
# ==========================================

@router.post("/cart/items", response_model=CartItemResponse)
def add_to_cart(
        item_data: CartItemCreate,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Add item to cart"""
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
    """Get user's cart"""
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
    """Update cart item quantity"""
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
    """Remove item from cart"""
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
    """Clear all items from cart"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can clear cart")

    service = OrderService(db)
    service.clear_cart(current_user.id)
    return {"message": "Cart cleared successfully"}


# ==========================================
# UNIFIED ORDER ENDPOINTS
# ==========================================

@router.get("/orders", response_model=List[UnifiedOrderListItem])
def get_my_orders(
        status: Optional[OrderStatusEnum] = Query(None, description="Filter by order status"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user's unified orders (customers see their orders, farmers see orders containing their items)"""
    service = OrderService(db)

    if current_user.role == 'farmer':
        orders = service.get_farmer_orders(current_user.id, status)
    elif current_user.role in ['individual', 'business']:
        orders = service.get_customer_orders(current_user.id, status)
    else:
        raise HTTPException(status_code=403, detail="Invalid user role")

    # Convert to list items format
    result = []
    for order in orders:
        if current_user.role == 'farmer':
            # For farmer view - count only their items
            farmer_items = [item for item in order.items if item.farmer_id == current_user.id]
            result.append(UnifiedOrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=sum(item.total_price for item in farmer_items),  # Only farmer's portion
                item_count=len(farmer_items),
                created_at=order.created_at
            ))
        else:
            # For customer view
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


@router.get("/orders/{order_id}", response_model=UnifiedOrderResponse)
def get_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get unified order details"""
    service = OrderService(db)
    order = service.get_order_by_id(order_id, current_user.id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # For farmers, filter items to show only their products
    items = order.items
    if current_user.role == 'farmer':
        items = [item for item in order.items if item.farmer_id == current_user.id]

    return UnifiedOrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        total_amount=order.total_amount,
        delivery_fee=order.delivery_fee,
        final_amount=order.final_amount,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_email=order.customer_email,
        delivery_address=order.delivery_address,
        delivery_notes=order.delivery_notes,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
        delivered_at=order.delivered_at
    )


@router.put("/orders/{order_id}/status", response_model=UnifiedOrderResponse)
def update_order_status(
        order_id: int,
        update_data: UnifiedOrderUpdateRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update unified order status (admin only - farmers can't change order status in unified system)"""
    # In unified system, individual farmers don't control order status
    # This is typically handled by admin/system or delivery service
    if current_user.role not in ['admin', 'system']:  # Add admin role check
        raise HTTPException(status_code=403, detail="Only admin can update order status")

    try:
        service = OrderService(db)
        order = service.update_order_status(order_id, current_user.id, update_data.status)

        return UnifiedOrderResponse(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            total_amount=order.total_amount,
            delivery_fee=order.delivery_fee,
            final_amount=order.final_amount,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            customer_email=order.customer_email,
            delivery_address=order.delivery_address,
            delivery_notes=order.delivery_notes,
            items=order.items,
            created_at=order.created_at,
            updated_at=order.updated_at,
            delivered_at=order.delivered_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# FARMER-SPECIFIC ENDPOINTS
# ==========================================

@router.get("/farmer/orders/summary", response_model=FarmerOrderSummary)
def get_farmer_order_summary(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get order summary for farmer dashboard"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_order_summary(current_user.id)


@router.get("/farmer/earnings")
def get_farmer_earnings(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get detailed farmer earnings (uses Stripe service for detailed breakdown)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can view earnings")

    # Import here to avoid circular imports
    from services.stripe_service import StripePaymentService

    service = StripePaymentService(db)
    return service.get_farmer_earnings_summary(current_user.id)
