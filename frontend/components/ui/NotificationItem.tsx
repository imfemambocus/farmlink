import {TouchableOpacity, View, Text} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useNotificationTranslation} from '@/utils/useBackendTranslation';
import {useTranslation} from "@/context/LanguageContext";

interface AppNotification {
    id: number;
    type: string;
    title: string;
    message: string;
    order_id?: number;
    farmer_id?: number;
    farmer_name?: string;
    data?: any;
    is_read: boolean;
    created_at: string;
    read_at?: string;
}

const NotificationItem = ({ notification, onPress }: {
    notification: AppNotification;
    onPress: (notification: AppNotification) => void;
}) => {
    const { tNotifications } = useTranslation();
    const { translatedTitle, translatedMessage } = useNotificationTranslation(
        notification.title,
        notification.message,
        notification.type
    );

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order_created':
                return 'bag-handle-outline';
            case 'order_status_changed':
                return 'refresh-outline';
            case 'order_delivered':
                return 'checkmark-circle-outline';
            case 'order_cancelled':
                return 'close-circle-outline';
            default:
                return 'notifications-outline';
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'order_created':
                return '#3b82f6';
            case 'order_status_changed':
                return '#f59e0b';
            case 'order_delivered':
                return '#10b981';
            case 'order_cancelled':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return tNotifications('justNow');
        if (diffInMinutes < 60) return `${diffInMinutes}${tNotifications('minutesAgo')}`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}${tNotifications('hoursAgo')}`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}${tNotifications('daysAgo')}`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    return (
        <TouchableOpacity
            onPress={() => onPress(notification)}
            className={`p-4 border-b border-gray-100 ${
                !notification.is_read ? 'bg-blue-50' : 'bg-white'
            }`}
            activeOpacity={0.7}
        >
            <View className="flex-row items-start">
                <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3 mt-1"
                    style={{ backgroundColor: getNotificationColor(notification.type) + '20' }}
                >
                    <Ionicons
                        name={getNotificationIcon(notification.type) as any}
                        size={20}
                        color={getNotificationColor(notification.type)}
                    />
                </View>

                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className={`text-base font-medium ${
                            !notification.is_read ? 'text-black' : 'text-gray-700'
                        }`}>
                            {translatedTitle}
                        </Text>
                        {!notification.is_read && (
                            <View className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                        )}
                    </View>

                    <Text className={`text-sm mb-2 ${
                        !notification.is_read ? 'text-gray-700' : 'text-gray-600'
                    }`}>
                        {translatedMessage}
                    </Text>

                    {notification.farmer_name && (
                        <Text className="text-xs text-gray-500 mb-1">
                            {tNotifications('from')} {notification.farmer_name}
                        </Text>
                    )}

                    <Text className="text-xs text-gray-400">
                        {formatDate(notification.created_at)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default NotificationItem;