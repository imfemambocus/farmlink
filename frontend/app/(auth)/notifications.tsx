import {useContext, useEffect, useState} from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Header from '@/components/ui/Header';
import { useNotifications } from '@/context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';
import {AuthContext} from "@/context/AuthContext";
import { useTranslation } from '@/context/LanguageContext';
import NotificationItem from "@/components/ui/NotificationItem";

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
    const { user } = useContext(AuthContext);
    const router = useRouter();
    const { notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { tNotifications } = useTranslation();

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
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        if (notification.order_id) {
            router.push(`/(auth)/${user?.farmer_profile ? 'farmer' : 'customer'}/orders`);
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount > 0) {
            await markAllAsRead();
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <View className="absolute top-0 left-0 right-0 z-10">
                    <Header title={tNotifications('notificationsTitle')} showBackButton={true} />
                </View>
                <View
                    className="flex-1 justify-center items-center"
                    style={{ paddingTop: Dimensions.get('window').height * 0.2 }}
                >
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tNotifications('loadingNotifications')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <View className="absolute top-0 left-0 right-0 z-10">
                <Header title={tNotifications('notificationsTitle')} showBackButton={true} />
            </View>

            <View className="flex-1" style={{ paddingTop: Dimensions.get('window').height * 0.2 }}>
                {notifications.length > 0 && (
                    <View className="px-5 py-3 bg-white border-b border-gray-100">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-sm text-gray-600">
                                {unreadCount > 0 ? `${unreadCount} ${tNotifications('unread')}` : tNotifications('allCaughtUp')}
                            </Text>
                            {unreadCount > 0 && (
                                <TouchableOpacity
                                    onPress={handleMarkAllRead}
                                    className="px-3 py-1 bg-background rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-sm font-medium text-black">
                                        {tNotifications('markAllRead')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {notifications.length === 0 ? (
                    <View className="flex-1 justify-center items-center px-6">
                        <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
                        <Text className="text-lg font-medium text-black mt-4 mb-2">
                            {tNotifications('noNotificationsYet')}
                        </Text>
                        <Text className="text-gray-600 text-sm text-center">
                            {tNotifications('notificationsAppearHere')}
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
                        {notifications.map(notification => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onPress={handleNotificationPress}
                            />
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}