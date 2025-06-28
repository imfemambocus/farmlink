from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models.order import UnifiedOrder, UnifiedOrderItem
from models.user import FarmerProfile
from schemas.notification import DeviceTokenRegister, NotificationListResponse, NotificationResponse
from services.notification_service import PushNotificationService
from core.security import get_current_user, get_db
import json


router = APIRouter()


@router.post("/device-token")
def register_device_token(
        token_data: DeviceTokenRegister,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
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


@router.get("", response_model=NotificationListResponse)
def get_notifications(
        limit: int = Query(20, le=50, description="Number of notifications to return"),
        offset: int = Query(0, description="Number of notifications to skip"),
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = PushNotificationService(db)

    notifications = service.get_user_notifications(current_user.id, limit, offset)
    total = len(notifications)
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
        has_next=len(notifications) == limit
    )


@router.put("/{notification_id}/read")
def mark_notification_read(
        notification_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = PushNotificationService(db)

    success = service.mark_notification_as_read(notification_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_notifications_read(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = PushNotificationService(db)

    updated_count = service.mark_all_notifications_as_read(current_user.id)

    return {
        "message": f"Marked {updated_count} notifications as read",
        "updated_count": updated_count
    }


@router.get("/unread-count")
def get_unread_count(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):
    service = PushNotificationService(db)

    unread_count = service.get_unread_count(current_user.id)

    return {"unread_count": unread_count}


@router.get("/order/{order_id}/farmer-statuses")
def get_order_farmer_statuses(
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

    result = {}
    for farmer_id in farmer_ids_in_order:
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

        # Get farmer status from the JSON field
        farmer_status = order.get_farmer_status(farmer_id)
        farmer_delivered_at = order.get_farmer_delivered_at(farmer_id)

        result[farmer_id] = {
            "farmer_name": farmer_name,
            "status": farmer_status,
            "farmer_district": farmer_district,
            "delivered_at": farmer_delivered_at
        }

    return {"farmer_statuses": result}