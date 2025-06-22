// context/NotificationContext.tsx - Fixed version
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '@/services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

interface NotificationData {
    order_id?: number;
    farmer_id?: number;
    type?: string;
    order_number?: string;
    farmer_name?: string;
    new_status?: string;
    old_status?: string;
    item_count?: number;
    amount?: number;
}

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

interface NotificationContextType {
    unreadCount: number;
    notifications: AppNotification[];
    refreshNotifications: () => Promise<void>;
    markAsRead: (notificationId: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    registerForPushNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadCount: 0,
    notifications: [],
    refreshNotifications: async () => {},
    markAsRead: async () => {},
    markAllAsRead: async () => {},
    registerForPushNotifications: async () => {},
});

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
    const { user } = useContext(AuthContext);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Add loading state to prevent multiple calls
    const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    const registerForPushNotifications = async () => {
        try {
            if (!Device.isDevice) {
                return;
            }

            // Check existing permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            // Request permissions if not granted
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Permission not granted for push notifications');
                return;
            }

            // Get push token
            const token = await Notifications.getExpoPushTokenAsync({
                projectId: process.env.EXPO_PROJECT_ID,
            });

            // Configure notification channel for Android
            if (Platform.OS === 'android') {
                Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#4CAF50',
                });
            }

            // Register token with backend
            if (user && token.data) {
                await registerDeviceToken(token.data);
            }

        } catch (error) {
            console.error('Error registering for push notifications:', error);
        }
    };

    const registerDeviceToken = async (expoPushToken: string) => {
        try {
            const authToken = await AsyncStorage.getItem('token');
            if (!authToken) return;

            const deviceId = await Device.deviceName + '_' + Date.now();

            await api.post('/notification/device-token', {
                expo_push_token: expoPushToken,
                device_id: deviceId,
                platform: Platform.OS
            }, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            console.log('Device token registered successfully');
        } catch (error) {
            console.error('Error registering device token:', error);
        }
    };

    const refreshNotifications = async () => {
        try {
            if (!user || isLoading) return; // Prevent multiple simultaneous calls

            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await api.get('/notification', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNotifications(response.data.notifications || []);
            setUnreadCount(response.data.unread_count || 0);

        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const markAsRead = async (notificationId: number) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.put(`/notification/${notificationId}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId
                        ? { ...notif, is_read: true, read_at: new Date().toISOString() }
                        : notif
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));

        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.put('/notification/read-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state
            setNotifications(prev =>
                prev.map(notif => ({
                    ...notif,
                    is_read: true,
                    read_at: new Date().toISOString()
                }))
            );
            setUnreadCount(0);

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const handleNotificationReceived = (notification: Notifications.Notification) => {
        console.log('Notification received:', notification);
        refreshNotifications();

        const data = notification.request.content.data as NotificationData;
        if (data?.type === 'order_created') {
            console.log('New order notification received');
        } else if (data?.type === 'order_status_changed') {
            console.log('Order status change notification received');
        }
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
        console.log('Notification tapped:', response);
        const data = response.notification.request.content.data as NotificationData;

        if (data?.order_id) {
            console.log('Navigate to order:', data.order_id);
        }
    };

    useEffect(() => {
        if (user) {
            // Only run once when user changes
            registerForPushNotifications();
            refreshNotifications();

            // Set up notification listeners - Fixed deprecation
            const notifSub = Notifications.addNotificationReceivedListener(handleNotificationReceived);
            const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

            notificationListener.current = notifSub;
            responseListener.current = responseSub;

            return () => {
                // Fixed deprecation warning - use .remove() instead
                notifSub.remove();
                responseSub.remove();
            };
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user?.id]); // Only depend on user.id, not the entire user object

    return (
        <NotificationContext.Provider value={{
            unreadCount,
            notifications,
            refreshNotifications,
            markAsRead,
            markAllAsRead,
            registerForPushNotifications,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};