// app/(auth)/notifications.tsx
import { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Header from '@/components/ui/Header';
import { useNotifications } from '@/context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';

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

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            await refreshNotifications();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadNotifications();
    };

    const handleNotificationPress = async (notification: AppNotification) => {
        // Mark as read if not already read
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        // Navigate based on notification type and data
        if (notification.order_id) {
            router.push(`/(auth)/customer/orders`); // You can make this more specific
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount > 0) {
            await markAllAsRead();
        }
    };

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
                return '#3b82f6'; // blue
            case 'order_status_changed':
                return '#f59e0b'; // amber
            case 'order_delivered':
                return '#10b981'; // green
            case 'order_cancelled':
                return '#ef4444'; // red
            default:
                return '#6b7280'; // gray
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return 'just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const renderNotification = (notification: AppNotification) => (
        <TouchableOpacity
            key={notification.id}
            onPress={() => handleNotificationPress(notification)}
            className={`p-4 border-b border-gray-100 ${
                !notification.is_read ? 'bg-blue-50' : 'bg-white'
            }`}
            activeOpacity={0.7}
        >
            <View className="flex-row items-start">
                {/* Icon */}
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

                {/* Content */}
                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className={`text-base font-medium ${
                            !notification.is_read ? 'text-black' : 'text-gray-700'
                        }`}>
                            {notification.title.toLowerCase()}
                        </Text>
                        {!notification.is_read && (
                            <View className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                        )}
                    </View>

                    <Text className={`text-sm mb-2 ${
                        !notification.is_read ? 'text-gray-700' : 'text-gray-600'
                    }`}>
                        {notification.message.toLowerCase()}
                    </Text>

                    {/* Additional info for order notifications */}
                    {notification.farmer_name && (
                        <Text className="text-xs text-gray-500 mb-1">
                            from {notification.farmer_name.toLowerCase()}
                        </Text>
                    )}

                    <Text className="text-xs text-gray-400">
                        {formatDate(notification.created_at)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="notifications" showBackButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading notifications...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header title="notifications" showBackButton={true} />

            {/* Header Actions */}
            {notifications.length > 0 && (
                <View className="px-5 py-3 bg-white border-b border-gray-100">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-gray-600">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'all caught up!'}
                        </Text>
                        {unreadCount > 0 && (
                            <TouchableOpacity
                                onPress={handleMarkAllRead}
                                className="px-3 py-1 bg-background rounded-lg"
                                activeOpacity={0.7}
                            >
                                <Text className="text-sm font-medium text-black">
                                    mark all read
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {notifications.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        no notifications yet
                    </Text>
                    <Text className="text-gray-600 text-center">
                        you'll receive notifications about order updates and new orders here
                    </Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#4CAF50']}
                        />
                    }
                >
                    {notifications.map(renderNotification)}
                </ScrollView>
            )}
        </View>
    );
}