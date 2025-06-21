# services/notification_service.py
import requests
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models.notification import DeviceToken, Notification, NotificationTypeEnum, UnifiedOrderFarmerStatus
from models.order import UnifiedOrder, UnifiedOrderItem
from models.user import User
from datetime import datetime
import os


class PushNotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.expo_push_url = "https://exp.host/--/api/v2/push/send"

    def register_device_token(self, user_id: int, expo_push_token: str, device_id: str, platform: str) -> DeviceToken:
        """Register or update device token for user"""

        # Check if token already exists for this device
        existing_token = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.device_id == device_id
            )
            .first()
        )

        if existing_token:
            # Update existing token
            existing_token.expo_push_token = expo_push_token
            existing_token.platform = platform
            existing_token.is_active = True
            existing_token.updated_at = datetime.utcnow()
            self.db.commit()
            return existing_token
        else:
            # Create new token
            device_token = DeviceToken(
                user_id=user_id,
                expo_push_token=expo_push_token,
                device_id=device_id,
                platform=platform
            )
            self.db.add(device_token)
            self.db.commit()
            return device_token

    def send_push_notification(self, expo_push_tokens: List[str], title: str, message: str, data: Dict = None) -> bool:
        """Send push notification via Expo Push API"""

        if not expo_push_tokens:
            return False

        messages = []
        for token in expo_push_tokens:
            message_data = {
                "to": token,
                "title": title,
                "body": message,
                "sound": "default",
                "data": data or {}
            }
            messages.append(message_data)

        try:
            response = requests.post(
                self.expo_push_url,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                data=json.dumps(messages)
            )

            if response.status_code == 200:
                response_data = response.json()
                # Check for any errors in the response
                for i, receipt in enumerate(response_data.get('data', [])):
                    if receipt.get('status') == 'error':
                        print(f"Push notification error for token {expo_push_tokens[i]}: {receipt.get('message')}")
                        # You might want to mark the token as invalid here

                return True
            else:
                print(f"Failed to send push notification: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Error sending push notification: {str(e)}")
            return False

    def create_and_send_notification(
            self,
            user_id: int,
            notification_type: NotificationTypeEnum,
            title: str,
            message: str,
            order_id: Optional[int] = None,
            farmer_id: Optional[int] = None,
            data: Optional[Dict] = None
    ) -> Notification:
        """Create notification record and send push notification"""

        # Create notification record
        notification = Notification(
            user_id=user_id,
            order_id=order_id,
            farmer_id=farmer_id,
            type=notification_type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None
        )
        self.db.add(notification)

        # Get user's device tokens
        device_tokens = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active == True
            )
            .all()
        )

        expo_tokens = [token.expo_push_token for token in device_tokens]

        # Send push notification
        if expo_tokens:
            success = self.send_push_notification(
                expo_tokens,
                title,
                message,
                {
                    "order_id": order_id,
                    "farmer_id": farmer_id,
                    "type": notification_type.value,
                    **(data or {})
                }
            )

            if success:
                notification.is_sent = True
                notification.sent_at = datetime.utcnow()

        self.db.commit()
        return notification

    def notify_new_order_to_farmers(self, order: UnifiedOrder):
        """Send notifications to all farmers when a new order is created"""

        # Get unique farmer IDs from order items
        farmer_ids = set(item.farmer_id for item in order.items)

        for farmer_id in farmer_ids:
            # Get farmer's items for this order
            farmer_items = [item for item in order.items if item.farmer_id == farmer_id]
            item_count = len(farmer_items)
            total_amount = sum(item.total_price for item in farmer_items)

            # Create farmer status record
            farmer_status = UnifiedOrderFarmerStatus(
                order_id=order.id,
                farmer_id=farmer_id,
                status="confirmed"
            )
            self.db.add(farmer_status)

            # Send notification to farmer
            title = "New Order Received!"
            message = f"Order #{order.order_number} - {item_count} items, Rs {total_amount:.2f}"

            self.create_and_send_notification(
                user_id=farmer_id,
                notification_type=NotificationTypeEnum.ORDER_CREATED,
                title=title,
                message=message,
                order_id=order.id,
                data={
                    "order_number": order.order_number,
                    "item_count": item_count,
                    "amount": float(total_amount)
                }
            )

        self.db.commit()

    def notify_order_status_change(self, order: UnifiedOrder, farmer_id: int, new_status: str, old_status: str):
        """Send notification to customer when farmer changes order status"""

        # Get farmer info
        farmer = self.db.query(User).get(farmer_id)
        farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}" if farmer and farmer.farmer_profile else "Farmer"

        # Update farmer status record
        farmer_status = (
            self.db.query(UnifiedOrderFarmerStatus)
            .filter(
                UnifiedOrderFarmerStatus.order_id == order.id,
                UnifiedOrderFarmerStatus.farmer_id == farmer_id
            )
            .first()
        )

        if farmer_status:
            farmer_status.status = new_status
            farmer_status.status_changed_at = datetime.utcnow()

        # Create notification message based on status
        status_messages = {
            "processing": f"{farmer_name} is preparing your items",
            "out_for_delivery": f"{farmer_name}'s items are out for delivery",
            "delivered": f"{farmer_name}'s items have been delivered!",
            "cancelled": f"{farmer_name} has cancelled their items"
        }

        if new_status in status_messages:
            title = f"Order Update - #{order.order_number}"
            message = status_messages[new_status]

            self.create_and_send_notification(
                user_id=order.customer_id,
                notification_type=NotificationTypeEnum.ORDER_STATUS_CHANGED,
                title=title,
                message=message,
                order_id=order.id,
                farmer_id=farmer_id,
                data={
                    "order_number": order.order_number,
                    "farmer_name": farmer_name,
                    "new_status": new_status,
                    "old_status": old_status
                }
            )

        self.db.commit()

    def get_user_notifications(self, user_id: int, limit: int = 50, offset: int = 0) -> List[Notification]:
        """Get notifications for user"""
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def mark_notification_as_read(self, notification_id: int, user_id: int) -> bool:
        """Mark notification as read"""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
            .first()
        )

        if notification and not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            self.db.commit()
            return True

        return False

    def mark_all_notifications_as_read(self, user_id: int) -> int:
        """Mark all notifications as read for user"""
        updated_count = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .update({
                "is_read": True,
                "read_at": datetime.utcnow()
            })
        )
        self.db.commit()
        return updated_count

    def get_unread_count(self, user_id: int) -> int:
        """Get count of unread notifications for user"""
        return (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .count()
        )

    def get_order_farmer_statuses(self, order_id: int) -> Dict[int, str]:
        """Get farmer statuses for an order"""
        statuses = (
            self.db.query(UnifiedOrderFarmerStatus)
            .filter(UnifiedOrderFarmerStatus.order_id == order_id)
            .all()
        )

        return {status.farmer_id: status.status for status in statuses}