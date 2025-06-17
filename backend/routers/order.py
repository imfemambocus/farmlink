from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from schemas.order import (
    CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse,
    OrderCreateRequest, OrderResponse, OrderListItem, OrderUpdateRequest,
    PaymentResponse, FarmerBrowseItem, ProductBrowseItem, FarmerProductsResponse
)
from services.order_service import OrderService
from core.security import get_current_user, get_db
from models.order import OrderStatusEnum

router = APIRouter()


# Cart endpoints
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


# Order endpoints
@router.post("/orders", response_model=OrderResponse)
def create_order(
        order_data: OrderCreateRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Create order from cart items for specific farmer"""
    if current_user.role not in ['individual', 'business']:
        raise HTTPException(status_code=403, detail="Only customers can create orders")

    try:
        service = OrderService(db)
        order = service.create_order_from_cart(current_user.id, order_data)

        # Build response
        farmer_name = None
        farmer_district = None
        if order.farmer and order.farmer.farmer_profile:
            farmer_name = f"{order.farmer.farmer_profile.first_name} {order.farmer.farmer_profile.last_name}"
            farmer_district = order.farmer.farmer_profile.district

        return OrderResponse(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            total_amount=order.total_amount,
            delivery_fee=order.delivery_fee,
            final_amount=order.final_amount,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            farmer_name=farmer_name,
            farmer_district=farmer_district,
            delivery_address=order.delivery_address,
            delivery_notes=order.delivery_notes,
            items=order.items,
            created_at=order.created_at,
            updated_at=order.updated_at,
            out_for_delivery_at=order.out_for_delivery_at,
            delivered_at=order.delivered_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create order")


@router.get("/orders", response_model=List[OrderListItem])
def get_my_orders(
        status: Optional[OrderStatusEnum] = Query(None, description="Filter by order status"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user's orders (customers see their orders, farmers see orders for their products)"""
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
            # For farmer view
            result.append(OrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=order.final_amount,
                customer_name=order.customer_name,
                items_count=len(order.items),
                created_at=order.created_at
            ))
        else:
            # For customer view
            farmer_name = None
            if order.farmer and order.farmer.farmer_profile:
                farmer_name = f"{order.farmer.farmer_profile.first_name} {order.farmer.farmer_profile.last_name}"

            result.append(OrderListItem(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                final_amount=order.final_amount,
                farmer_name=farmer_name,
                items_count=len(order.items),
                created_at=order.created_at
            ))

    return result


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get order details"""
    service = OrderService(db)
    order = service.get_order_by_id(order_id, current_user.id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Build response
    farmer_name = None
    farmer_district = None
    if order.farmer and order.farmer.farmer_profile:
        farmer_name = f"{order.farmer.farmer_profile.first_name} {order.farmer.farmer_profile.last_name}"
        farmer_district = order.farmer.farmer_profile.district

    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        total_amount=order.total_amount,
        delivery_fee=order.delivery_fee,
        final_amount=order.final_amount,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        farmer_name=farmer_name,
        farmer_district=farmer_district,
        delivery_address=order.delivery_address,
        delivery_notes=order.delivery_notes,
        items=order.items,
        created_at=order.created_at,
        updated_at=order.updated_at,
        out_for_delivery_at=order.out_for_delivery_at,
        delivered_at=order.delivered_at
    )


@router.put("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
        order_id: int,
        update_data: OrderUpdateRequest,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update order status (farmers only)"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can update order status")

    try:
        service = OrderService(db)
        order = service.update_order_status(order_id, current_user.id, update_data)

        # Build response
        farmer_name = None
        farmer_district = None
        if order.farmer and order.farmer.farmer_profile:
            farmer_name = f"{order.farmer.farmer_profile.first_name} {order.farmer.farmer_profile.last_name}"
            farmer_district = order.farmer.farmer_profile.district

        return OrderResponse(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            total_amount=order.total_amount,
            delivery_fee=order.delivery_fee,
            final_amount=order.final_amount,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            farmer_name=farmer_name,
            farmer_district=farmer_district,
            delivery_address=order.delivery_address,
            delivery_notes=order.delivery_notes,
            items=order.items,
            created_at=order.created_at,
            updated_at=order.updated_at,
            out_for_delivery_at=order.out_for_delivery_at,
            delivered_at=order.delivered_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Farmer-specific endpoints
@router.get("/farmer/orders/summary")
def get_farmer_order_summary(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get order summary for farmer dashboard"""
    if current_user.role != 'farmer':
        raise HTTPException(status_code=403, detail="Only farmers can access this endpoint")

    service = OrderService(db)
    return service.get_farmer_order_summary(current_user.id)