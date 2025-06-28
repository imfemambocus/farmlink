import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import Constants from 'expo-constants';
import {router} from "expo-router";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
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

    const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastFetchTime = useRef<number>(0);
    const appStateSubscription = useRef<any>(null);

    const registerForPushNotifications = async () => {
        try {
            if (!Device.isDevice) {
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

            const token = await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
            });



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

            const storedTokenKey = `expo_push_token_${user?.id}`;
            await AsyncStorage.setItem(storedTokenKey, expoPushToken);

        } catch (error: unknown) {
            console.error('Error registering device token:', error);

            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: unknown; status?: number } };
                if (axiosError.response) {
                    console.error('Error response data:', axiosError.response.data);
                    console.error('Error response status:', axiosError.response.status);
                }
            }
        }
    };

    const refreshNotifications = async () => {
        try {
            if (!user || isLoading) return;

            // Prevent too frequent API calls (minimum 10 seconds between calls)
            const now = Date.now();
            if (now - lastFetchTime.current < 10000) {
                return;
            }

            setIsLoading(true);
            lastFetchTime.current = now;

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
        // Immediately update in-app notifications when a push notification is received
        refreshNotifications();

        const data = notification.request.content.data as NotificationData;
        if (data?.type === 'order_created') {
            // New order notification - increment unread count immediately for better UX
            setUnreadCount(prev => prev + 1);
        } else if (data?.type === 'order_status_changed') {
            // Order status change notification - increment unread count immediately
            setUnreadCount(prev => prev + 1);
        }
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as NotificationData;

        if (data?.type === 'order_created' && data?.order_id) {
            router.push('/(auth)/farmer/orders');
        } else if (data?.type === 'order_status_changed' && data?.order_id) {
            router.push('/(auth)/customer/orders');
        } else if (data?.order_id) {
            // Fallback based on user role
            if (user?.role === 'farmer') {
                router.push('/(auth)/farmer/orders');
            } else {
                router.push('/(auth)/customer/orders');
            }
        }
    };

    // Start polling for notifications (only when app is active)
    const startPolling = () => {
        if (pollingInterval.current) return; // Already polling

        pollingInterval.current = setInterval(() => {
            // Only poll if app is in active state
            if (AppState.currentState === 'active') {
                refreshNotifications();
            }
        }, 30000); // Poll every 30 seconds
    };

    // Stop polling
    const stopPolling = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'active' && user) {
            // App became active - refresh notifications immediately and ensure polling is running
            refreshNotifications();
            if (!pollingInterval.current) {
                startPolling();
            }
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
            // App went to background - stop polling to save battery and data
            stopPolling();
        }
    };

    // Clear stored token when user logs out
    const clearStoredToken = async () => {
        if (user?.id) {
            const storedTokenKey = `expo_push_token_${user.id}`;
            await AsyncStorage.removeItem(storedTokenKey);
        }
    };

    useEffect(() => {
        if (user) {
            registerForPushNotifications();
            refreshNotifications();

            // Set up app state listener
            appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

            // Start polling only if app is currently active
            if (AppState.currentState === 'active') {
                startPolling();
            }

            // Set up notification listeners (only work on physical devices)
            notificationListener.current = Notifications.addNotificationReceivedListener(handleNotificationReceived);
            responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

            return () => {
                stopPolling();
                appStateSubscription.current?.remove();
                notificationListener.current?.remove();
                responseListener.current?.remove();
            };
        } else {
            // Clear notifications and stored token when user logs out
            stopPolling();
            appStateSubscription.current?.remove();
            setNotifications([]);
            setUnreadCount(0);
            clearStoredToken();
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