from typing import List, Optional
from pydantic import BaseModel


class DeviceTokenRegister(BaseModel):
    expo_push_token: str
    device_id: str
    platform: str  # iOS or Android


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