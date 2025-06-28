import requests
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models.notification import DeviceToken, Notification, NotificationTypeEnum
from models.order import UnifiedOrder
from models.user import User
from datetime import datetime


class PushNotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.expo_push_url = "https://exp.host/--/api/v2/push/send"

    def register_device_token(self, user_id: int, expo_push_token: str, device_id: str, platform: str) -> DeviceToken:
        existing_token = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.device_id == device_id
            )
            .first()
        )

        if existing_token:
            existing_token.expo_push_token = expo_push_token
            existing_token.platform = platform
            existing_token.is_active = True
            existing_token.updated_at = datetime.utcnow()
            self.db.commit()
            return existing_token
        else:
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
        print(f"=== PUSH NOTIFICATION DEBUG START ===")
        print(f"Tokens to send to: {len(expo_push_tokens)}")
        print(f"Title: {title}")
        print(f"Message: {message}")
        print(f"Data: {data}")

        if not expo_push_tokens:
            print("No expo push tokens provided")
            return False

        messages = []
        for i, token in enumerate(expo_push_tokens):
            print(f"Token {i + 1}: {token[:20]}...")
            message_data = {
                "to": token,
                "title": title,
                "body": message,
                "sound": "default",
                "data": data or {}
            }
            messages.append(message_data)

        try:
            print(f"Sending {len(messages)} messages to Expo...")
            response = requests.post(
                self.expo_push_url,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                data=json.dumps(messages)
            )

            print(f"Expo response status: {response.status_code}")
            print(f"Expo response body: {response.text}")

            if response.status_code == 200:
                response_data = response.json()
                print(f"Expo response data: {response_data}")

                success_count = 0
                error_count = 0

                for i, receipt in enumerate(response_data.get('data', [])):
                    if receipt.get('status') == 'error':
                        error_count += 1
                        print(f"Push notification error for token {i + 1}: {receipt.get('message')}")
                        print(f"Error details: {receipt.get('details', {})}")
                    else:
                        success_count += 1
                        print(f"Push notification success for token {i + 1}: {receipt.get('id', 'No ID')}")

                print(f"Push results: {success_count} success, {error_count} errors")
                print(f"=== PUSH NOTIFICATION DEBUG END ===")
                return success_count > 0
            else:
                print(f"Failed to send push notification: {response.status_code} - {response.text}")
                print(f"=== PUSH NOTIFICATION DEBUG END ===")
                return False

        except Exception as e:
            print(f"Exception sending push notification: {str(e)}")
            print(f"=== PUSH NOTIFICATION DEBUG END ===")
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

        device_tokens = (
            self.db.query(DeviceToken)
            .filter(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active == True
            )
            .all()
        )

        expo_tokens = [token.expo_push_token for token in device_tokens]
        print(f"Found {len(expo_tokens)} device tokens for user {user_id}")

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
                print(f"Push notification sent successfully to user {user_id}")
            else:
                print(f"Failed to send push notification to user {user_id}")
        else:
            print(f"No device tokens found for user {user_id}")

        self.db.flush()
        return notification

    def notify_new_order_to_farmers(self, order: UnifiedOrder):
        farmer_ids = set(item.farmer_id for item in order.items)
        print(f"Processing order {order.id}, farmer IDs: {farmer_ids}")

        # Initialize farmer statuses in the order
        if not order.farmer_statuses:
            order.farmer_statuses = {}

        for farmer_id in farmer_ids:
            # Get farmer's items for this order
            farmer_items = [item for item in order.items if item.farmer_id == farmer_id]
            item_count = len(farmer_items)
            total_amount = sum(item.total_price for item in farmer_items)

            print(f"Farmer {farmer_id}: {item_count} items, total: {total_amount}")

            # Initialize farmer status in the JSON field
            order.farmer_statuses[str(farmer_id)] = {
                "status": "confirmed",
                "delivered_at": None
            }

            # Send notification to farmer
            title = "New Order Received!"
            message = f"Order #{order.order_number} - {item_count} items, Rs {total_amount:.2f}"

            notification = Notification(
                user_id=farmer_id,
                order_id=order.id,
                farmer_id=None,
                type=NotificationTypeEnum.ORDER_CREATED,
                title=title,
                message=message,
                data=json.dumps({
                    "order_number": order.order_number,
                    "item_count": item_count,
                    "amount": float(total_amount)
                })
            )
            self.db.add(notification)
            print(f"Created notification for farmer {farmer_id}")

            device_tokens = (
                self.db.query(DeviceToken)
                .filter(
                    DeviceToken.user_id == farmer_id,
                    DeviceToken.is_active == True
                )
                .all()
            )

            expo_tokens = [token.expo_push_token for token in device_tokens]
            print(f"Found {len(expo_tokens)} device tokens for farmer {farmer_id}")

            if expo_tokens:
                success = self.send_push_notification(
                    expo_tokens,
                    title,
                    message,
                    {
                        "order_id": order.id,
                        "farmer_id": farmer_id,
                        "type": NotificationTypeEnum.ORDER_CREATED.value,
                        "order_number": order.order_number,
                        "item_count": item_count,
                        "amount": float(total_amount)
                    }
                )

                if success:
                    notification.is_sent = True
                    notification.sent_at = datetime.utcnow()
                    print(f"Push notification sent successfully to farmer {farmer_id}")
                else:
                    print(f"Failed to send push notification to farmer {farmer_id}")
            else:
                print(f"No device tokens found for farmer {farmer_id}")

        try:
            self.db.commit()
            print(f"Successfully committed notifications for order {order.id}")
        except Exception as e:
            print(f"Error committing notifications: {e}")
            self.db.rollback()
            raise

        # Check what was actually created AFTER commit
        notifications = (
            self.db.query(Notification)
            .filter(Notification.order_id == order.id)
            .all()
        )
        print(f"Total notifications in DB for order {order.id}: {len(notifications)}")

        if len(notifications) == 0 and len(farmer_ids) > 0:
            print("WARNING: Notifications were not saved to database!")

    def notify_order_status_change(self, order: UnifiedOrder, farmer_id: int, new_status: str, old_status: str):
        """Notify customer about farmer's status change"""

        print(f"=== NOTIFICATION DEBUG START ===")
        print(f"Order ID: {order.id}, Customer ID: {order.customer_id}")
        print(f"Farmer ID: {farmer_id}, Status: {old_status} -> {new_status}")

        # Only send notification if status actually changed
        if new_status == old_status:
            print(f"Status unchanged for farmer {farmer_id}: {old_status}")
            return

        farmer = self.db.query(User).get(farmer_id)
        farmer_name = f"{farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}" if farmer and farmer.farmer_profile else "Farmer"

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

            print(f"Creating notification: {title} - {message}")
            print(f"Target user ID: {order.customer_id}")

            # Check if customer has device tokens
            device_tokens = (
                self.db.query(DeviceToken)
                .filter(
                    DeviceToken.user_id == order.customer_id,
                    DeviceToken.is_active == True
                )
                .all()
            )

            print(f"Found {len(device_tokens)} device tokens for customer {order.customer_id}")
            for i, token in enumerate(device_tokens):
                print(f"  Token {i + 1}: {token.expo_push_token[:20]}... (platform: {token.platform})")

            notification = self.create_and_send_notification(
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

            print(f"Notification created: ID {notification.id}, Sent: {notification.is_sent}")
            print(f"=== NOTIFICATION DEBUG END ===")

        self.db.commit()

    def get_user_notifications(self, user_id: int, limit: int = 50, offset: int = 0) -> List[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def mark_notification_as_read(self, notification_id: int, user_id: int) -> bool:
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
        return (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .count()
        )

    def get_order_farmer_statuses(self, order_id: int) -> Dict[int, str]:
        order = self.db.query(UnifiedOrder).filter(UnifiedOrder.id == order_id).first()
        if not order or not order.farmer_statuses:
            return {}

        # Convert string keys back to int and extract status
        return {
            int(farmer_id): status_data.get("status", "confirmed")
            for farmer_id, status_data in order.farmer_statuses.items()
        }