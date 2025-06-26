import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import Constants from 'expo-constants';

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
    const { t } = useLanguage();
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fixed: Use EventSubscription type
    const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

    const registerForPushNotifications = async () => {
        try {
            if (!Device.isDevice) {
                console.log('Push notifications only work on physical devices');
                return;
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Push notification permissions not granted');
                return;
            }

            const projectId = Constants.expoConfig?.extra?.eas?.projectId;

            console.log(projectId)

            const token = await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
            });

            console.log('Expo Push Token obtained:', token.data);

            // Set up Android notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#4CAF50',
                    sound: 'default',
                    enableVibrate: true,
                    showBadge: true,
                });

                // Create additional channels for different notification types
                await Notifications.setNotificationChannelAsync('orders', {
                    name: 'Order Updates',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#4CAF50',
                });
            }

            if (user && token.data) {
                await registerDeviceToken(token.data);
            }

        } catch (error) {
            console.error('Error registering for push notifications:', error);
            // Continue without crashing - local notifications will still work
        }
    };

    const registerDeviceToken = async (expoPushToken: string) => {
        try {
            const authToken = await AsyncStorage.getItem('token');
            if (!authToken) return;

            const deviceName = await Device.deviceName;
            const deviceId = `${deviceName}_${Date.now()}`;

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
            if (!user || isLoading) return;

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
            console.log('Should navigate to order:', data.order_id);
            // TODO: Navigate to order details screen
            // navigation.navigate('OrderDetails', { orderId: data.order_id });
        }
    };

    useEffect(() => {
        if (user) {
            registerForPushNotifications();
            refreshNotifications();

            // Set up notification listeners
            notificationListener.current = Notifications.addNotificationReceivedListener(handleNotificationReceived);
            responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

            return () => {
                notificationListener.current?.remove();
                responseListener.current?.remove();
            };
        } else {
            // Clear notifications when user logs out
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user?.id]);

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