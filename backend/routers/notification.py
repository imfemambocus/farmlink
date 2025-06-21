# routes/notifications.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from services.notification_service import PushNotificationService
from core.security import get_current_user, get_db
from models.notification import NotificationTypeEnum
import json

router = APIRouter()


# Schemas
class DeviceTokenRegister(BaseModel):
    expo_push_token: str
    device_id: str
    platform: str  # 'ios' or 'android'


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    order_id: Optional[int]
    farmer_id: Optional[int]
    farmer_name: Optional[str]
    data: Optional[dict]
    is_read: bool
    created_at: str
    read_at: Optional[str]

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    has_next: bool


# Register device token
@router.post("/device-token")
def register_device_token(
        token_data: DeviceTokenRegister,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Register device token for push notifications"""
    service = PushNotificationService(db)

    device_token = service.register_device_token(
        user_id=current_user.id,
        expo_push_token=token_data.expo_push_token,
        device_id=token_data.device_id,
        platform=token_data.platform
    )

    return {
        "message": "Device token registered successfully",
        "token_id": device_token.id
    }


# Get user notifications
@router.get("", response_model=NotificationListResponse)
def get_notifications(
        limit: int = Query(20, le=50, description="Number of notifications to return"),
        offset: int = Query(0, description="Number of notifications to skip"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get user notifications"""
    service = PushNotificationService(db)

    notifications = service.get_user_notifications(current_user.id, limit, offset)
    total = len(notifications)  # You might want to implement a proper count query
    unread_count = service.get_unread_count(current_user.id)

    # Format notifications
    formatted_notifications = []
    for notification in notifications:
        farmer_name = None
        if notification.farmer_id and notification.farmer:
            if notification.farmer.farmer_profile:
                farmer_name = f"{notification.farmer.farmer_profile.first_name} {notification.farmer.farmer_profile.last_name}"

        formatted_notifications.append(NotificationResponse(
            id=notification.id,
            type=notification.type.value,
            title=notification.title,
            message=notification.message,
            order_id=notification.order_id,
            farmer_id=notification.farmer_id,
            farmer_name=farmer_name,
            data=json.loads(notification.data) if notification.data else None,
            is_read=notification.is_read,
            created_at=notification.created_at.isoformat(),
            read_at=notification.read_at.isoformat() if notification.read_at else None
        ))

    return NotificationListResponse(
        notifications=formatted_notifications,
        total=total,
        unread_count=unread_count,
        has_next=len(notifications) == limit  # Simple check for pagination
    )


# Mark notification as read
@router.put("/{notification_id}/read")
def mark_notification_read(
        notification_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Mark notification as read"""
    service = PushNotificationService(db)

    success = service.mark_notification_as_read(notification_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}


# Mark all notifications as read
@router.put("/read-all")
def mark_all_notifications_read(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    service = PushNotificationService(db)

    updated_count = service.mark_all_notifications_as_read(current_user.id)

    return {
        "message": f"Marked {updated_count} notifications as read",
        "updated_count": updated_count
    }


# Get unread count
@router.get("/unread-count")
def get_unread_count(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get count of unread notifications"""
    service = PushNotificationService(db)

    unread_count = service.get_unread_count(current_user.id)

    return {"unread_count": unread_count}


# Get order farmer statuses (for customers to see per-farmer status)
@router.get("/order/{order_id}/farmer-statuses")
def get_order_farmer_statuses(
        order_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get farmer statuses for a unified order"""
    service = PushNotificationService(db)

    # Verify user has access to this order
    from models.order import UnifiedOrder
    order = (
        db.query(UnifiedOrder)
        .filter(UnifiedOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if user is customer or farmer involved in order
    farmer_ids_in_order = set(item.farmer_id for item in order.items)

    if current_user.id != order.customer_id and current_user.id not in farmer_ids_in_order:
        raise HTTPException(status_code=403, detail="Access denied")

    farmer_statuses = service.get_order_farmer_statuses(order_id)

    # Get farmer names
    from models.user import User
    farmers = db.query(User).filter(User.id.in_(farmer_statuses.keys())).all()

    result = {}
    for farmer in farmers:
        farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}" if farmer.farmer_profile else "Unknown"
        result[farmer.id] = {
            "farmer_name": farmer_name,
            "status": farmer_statuses.get(farmer.id, "confirmed"),
            "farmer_district": farmer.farmer_profile.district if farmer.farmer_profile else None
        }

    return {"farmer_statuses": result}