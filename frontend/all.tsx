import { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '@/services/api';
import {User, AuthContextType, ProfileUpdateData} from '@/types';

export const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    logout: () => {},
    updateProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    const login = async (email: string, password: string) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            const token = res.data.access_token;
            await AsyncStorage.setItem('token', token);

            const profileRes = await api.get<User>('/auth/profile', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setUser(profileRes.data);
            router.replace('/(auth)/customer/homepage');
        } catch (error: any) {
            console.error('Login failed:', error.response?.data || error.message);
            throw error;
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        setUser(null);
        router.replace('/intro');
    };

    const updateProfile = async (profileData: ProfileUpdateData) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const res = await api.put<User>('/auth/profile', profileData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setUser(res.data);
        } catch (error: any) {
            console.error('Profile update failed:', error.response?.data || error.message);
            throw error;
        }
    };

    const checkLogin = async () => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            try {
                const res = await api.get<User>('/auth/profile', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(res.data);
            } catch {
                logout();
            }
        }
    };

    useEffect(() => {
        checkLogin();
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};


//////////////////////////////////////


// context/CartContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import api from '@/services/api';

interface CartContextType {
    cartItemCount: number;
    refreshCartCount: () => Promise<void>;
    triggerCartFlash: () => void;
    isFlashing: boolean;
}

const CartContext = createContext<CartContextType>({
    cartItemCount: 0,
    refreshCartCount: async () => {},
    triggerCartFlash: () => {},
    isFlashing: false,
});

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

interface CartProviderProps {
    children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
    const { user } = useContext(AuthContext);
    const [cartItemCount, setCartItemCount] = useState(0);
    const [isFlashing, setIsFlashing] = useState(false);

    const refreshCartCount = async () => {
        try {
            // Only fetch cart for customers (individual/business users)
            if (!user || !['individual', 'business'].includes(user.role)) {
                setCartItemCount(0);
                return;
            }

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setCartItemCount(0);
                return;
            }

            const response = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cartData = response.data;
            const totalItems = Number(cartData.total_items) || 0;
            setCartItemCount(totalItems);
        } catch (error) {
            console.error('Error fetching cart count:', error);
            setCartItemCount(0);
        }
    };

    const triggerCartFlash = () => {
        setIsFlashing(true);
        setTimeout(() => {
            setIsFlashing(false);
        }, 600); // Flash for 600ms
    };

    useEffect(() => {
        // Only refresh when user changes and is a customer
        if (user && ['individual', 'business'].includes(user.role)) {
            refreshCartCount();
        } else {
            setCartItemCount(0);
        }
    }, [user]);

    return (
        <CartContext.Provider value={{
            cartItemCount,
            refreshCartCount,
            triggerCartFlash,
            isFlashing,
        }}>
            {children}
        </CartContext.Provider>
    );
};


//////////////////////////////////////


// context/FarmerOrdersContext.tsx - Fixed version
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import api from '@/services/api';

interface FarmerOrdersContextType {
    pendingOrdersCount: number;
    refreshPendingOrdersCount: () => Promise<void>;
}

const FarmerOrdersContext = createContext<FarmerOrdersContextType>({
    pendingOrdersCount: 0,
    refreshPendingOrdersCount: async () => {},
});

export const useFarmerOrders = () => {
    const context = useContext(FarmerOrdersContext);
    if (!context) {
        throw new Error('useFarmerOrders must be used within a FarmerOrdersProvider');
    }
    return context;
};

interface FarmerOrdersProviderProps {
    children: ReactNode;
}

export const FarmerOrdersProvider = ({ children }: FarmerOrdersProviderProps) => {
    const { user } = useContext(AuthContext);
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false); // Add loading state to prevent multiple calls

    const refreshPendingOrdersCount = async () => {
        try {
            // Only fetch for farmers
            if (user?.role !== 'farmer' || isLoading) {
                setPendingOrdersCount(0);
                return;
            }

            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setPendingOrdersCount(0);
                return;
            }

            const response = await api.get('/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Count orders that are not delivered or cancelled
            const pendingOrders = response.data.filter((order: any) =>
                !['delivered', 'cancelled'].includes(order.status)
            );

            setPendingOrdersCount(pendingOrders.length);
        } catch (error) {
            console.error('Error fetching pending orders count:', error);
            setPendingOrdersCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only refresh when user.id changes and is a farmer
        if (user?.role === 'farmer') {
            refreshPendingOrdersCount();
        } else {
            setPendingOrdersCount(0);
        }
    }, [user?.id]); // Only depend on user.id, not the entire user object

    return (
        <FarmerOrdersContext.Provider value={{
            pendingOrdersCount,
            refreshPendingOrdersCount,
        }}>
            {children}
        </FarmerOrdersContext.Provider>
    );
};


//////////////////////////////////////


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


//////////////////////////////////////


import { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from "expo-router";
import { getProductBackgroundColor } from "@/utils/products";
import { UnitPrice } from "@/types";
import { useCart } from '@/context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: UnitPrice[];
    created_at: string;
}

interface ProductCardProps {
    product: Product;
}

// Helper functions
const getFilteredUnitPrices = (unitPrices: UnitPrice[], userRole: string): UnitPrice[] => {
    if (userRole === 'farmer') {
        return unitPrices;
    }

    const customerType = userRole as 'individual' | 'business';
    return unitPrices.filter(up => up.customer_type === customerType);
};

const getQuantityStep = (userRole: string): number => {
    return userRole === 'business' ? 25 : 1;
};

export default function ProductCard({ product }: ProductCardProps) {
    const { user } = useContext(AuthContext);
    const { triggerCartFlash } = useCart();
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUnitPrice, setSelectedUnitPrice] = useState<UnitPrice | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [imageError, setImageError] = useState(false);
    const [addingToCart, setAddingToCart] = useState(false);

    const backgroundOpacity = useSharedValue(0);
    const modalTranslateY = useSharedValue(1000);

    const productImage = getProductImage(product.item);
    const userRole = user?.role || 'individual';
    const quantityStep = getQuantityStep(userRole);

    // Filter unit prices based on user role
    const filteredUnitPrices = getFilteredUnitPrices(product.unit_prices, userRole);

    const addToCart = async (unitPriceId: number, selectedQuantity: number) => {
        try {
            setAddingToCart(true);
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                router.replace('/login');
                return;
            }

            await api.post('/orders/cart/items', {
                farmer_product_id: product.id,
                unit_price_id: unitPriceId,
                quantity: selectedQuantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Trigger cart flash animation instead of showing alert
            triggerCartFlash();

        } catch (error: any) {
            console.error('Error adding to cart:', error);
            // For errors, we could still show a brief message or just log
            // For now, we'll just log the error
        } finally {
            setAddingToCart(false);
        }
    };

    const quickAddToCart = async () => {
        if (filteredUnitPrices.length > 0) {
            const firstUnitPrice = filteredUnitPrices[0];
            const minOrder = firstUnitPrice.minimum_order;
            const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
            const finalQuantity = Math.max(adjustedMinOrder, quantityStep);

            await addToCart(firstUnitPrice.id, finalQuantity);
        }
    };

    const addToCartFromModal = async () => {
        if (selectedUnitPrice) {
            await addToCart(selectedUnitPrice.id, quantity);
            closeModal(); // Close modal after adding to cart
        }
    };

    const openModal = () => {
        if (filteredUnitPrices.length > 0) {
            setSelectedUnitPrice(filteredUnitPrices[0]);
            // Set quantity to minimum order, adjusted to quantity step
            const minOrder = filteredUnitPrices[0].minimum_order;
            const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
            setQuantity(Math.max(adjustedMinOrder, quantityStep));
        }
        setModalVisible(true);
        setImageError(false);
        backgroundOpacity.value = withTiming(1, { duration: 300 });
        modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 100 });
    };

    const closeModal = () => {
        backgroundOpacity.value = withTiming(0, { duration: 200 });
        modalTranslateY.value = withTiming(1000, { duration: 250 });
        setTimeout(() => {
            setModalVisible(false);
        }, 250);
    };

    const handleUnitPriceSelect = (unitPrice: UnitPrice) => {
        setSelectedUnitPrice(unitPrice);
        // Adjust quantity to minimum order and quantity step
        const minOrder = unitPrice.minimum_order;
        const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
        setQuantity(Math.max(adjustedMinOrder, quantityStep));
    };

    const adjustQuantity = (delta: number) => {
        if (!selectedUnitPrice) return;

        const newQuantity = quantity + (delta * quantityStep);
        const adjustedMinOrder = Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep;
        const minQuantity = Math.max(adjustedMinOrder, quantityStep);

        if (newQuantity >= minQuantity && newQuantity <= selectedUnitPrice.quantity_available) {
            setQuantity(newQuantity);
        }
    };

    const backgroundStyle = useAnimatedStyle(() => ({
        opacity: backgroundOpacity.value,
    }));

    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    // Don't render if no prices available for this user type
    if (filteredUnitPrices.length === 0) {
        return null;
    }

    return (
        <>
            {/* Main Product Card */}
            <TouchableOpacity
                onPress={openModal}
                className="bg-surface rounded-xl border border-gray-200 p-4"
                activeOpacity={0.7}
            >
                {/* Product Image Container */}
                <View className="w-1/2 aspect-square rounded-[40px] items-center justify-center mb-3 self-center">
                    {imageError ? (
                        <Text className="text-xs text-gray-500 text-center px-2">
                            Image failed to load
                        </Text>
                    ) : (
                        <Image
                            source={productImage}
                            style={{
                                width: '100%',
                                height: '100%',
                                resizeMode: 'contain',
                            }}
                            onError={() => setImageError(true)}
                        />
                    )}
                </View>

                {/* Product Name and Category Tag */}
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm font-medium text-black flex-1" numberOfLines={1}>
                        {product.item.toLowerCase()}
                    </Text>
                    <View className="px-3 py-1 bg-light-100 rounded-full">
                        <Text className="text-xs text-black font-medium">
                            {product.category}
                        </Text>
                    </View>
                </View>

                {/* Price and Add to Cart */}
                <View className="flex-row items-end justify-between">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <Text className="text-xs text-gray-500">
                                {filteredUnitPrices.map(up => up.unit).join(', ')}
                            </Text>
                        </View>
                        <View className="flex-row items-baseline">
                            <Text className="text-base font-bold text-black">
                                rs {filteredUnitPrices.length > 0 ? filteredUnitPrices[0].price_per_unit : product.lowest_price}
                            </Text>
                            <Text className="text-xs text-gray-500 ml-1">
                                / {filteredUnitPrices.length > 0 ? filteredUnitPrices[0].unit : 'unit'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            quickAddToCart();
                        }}
                        className="bg-background px-2 py-2 rounded-lg"
                        activeOpacity={0.7}
                        disabled={addingToCart}
                    >
                        {addingToCart ? (
                            <View className="w-4 h-4">
                                <Text className="text-xs text-center">...</Text>
                            </View>
                        ) : (
                            <Ionicons name="basket" size={16} color="black" />
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Product Details Modal */}
            <Modal
                animationType="none"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View className="flex-1 justify-end">
                    <TouchableOpacity
                        onPress={closeModal}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                        activeOpacity={1}
                    >
                        <Animated.View
                            style={[
                                {
                                    flex: 1,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                                },
                                backgroundStyle
                            ]}
                        />
                    </TouchableOpacity>

                    <Animated.View
                        className="bg-surface rounded-t-[40px] overflow-hidden p-3"
                        style={[
                            { height: '86%' },
                            modalStyle
                        ]}
                    >
                        {/* Large Product Image */}
                        <View
                            className="h-[24rem] rounded-[40px] w-full mb-3 items-center justify-center"
                            style={{ backgroundColor: getProductBackgroundColor(product.item) }}
                        >
                            {imageError ? (
                                <Text className="text-sm text-gray-500 text-center px-4">
                                    Image failed to load
                                </Text>
                            ) : (
                                <Image
                                    source={productImage}
                                    style={{
                                        width: '80%',
                                        height: '80%',
                                        resizeMode: 'contain',
                                    }}
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </View>

                        {/* Fixed Content Layout */}
                        <View className="flex-1 p-2">
                            {/* Product Name and Farmer */}
                            <View className="mb-3">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-xl font-medium text-black flex-1">
                                        {product.item.toLowerCase()}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        {userRole === 'business' && (
                                            <View className="px-3 py-1 bg-blue-100 rounded-full">
                                                <Text className="text-xs text-blue-600 font-medium">
                                                    bulk pricing
                                                </Text>
                                            </View>
                                        )}
                                        {/* Fresh indicator for items listed in last 3 days */}
                                        {(() => {
                                            const listingDate = new Date(product.created_at);
                                            const threeDaysAgo = new Date();
                                            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                                            return listingDate > threeDaysAgo;
                                        })() && (
                                            <View className="flex-row items-center">
                                                <Ionicons name="leaf" size={12} color="#4CAF50" />
                                                <Text className="text-xs text-action-green ml-1 font-medium">
                                                    fresh
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Text className="text-base text-gray-600">produced by: </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                closeModal();
                                                router.push(`/(auth)/customer/farmers/${product.farmer_id}`);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text className="text-base text-action-green font-medium">
                                                {product.farmer_name}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="location-outline" size={14} color="#666666" />
                                        <Text className="text-sm text-gray-600 ml-1">
                                            {product.farmer_district}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Description */}
                            {product.description && (
                                <View className="mb-3">
                                    <Text className="text-base font-medium text-black mb-2">
                                        description
                                    </Text>
                                    <Text className="text-gray-600 text-sm">
                                        {product.description}
                                    </Text>
                                </View>
                            )}

                            {/* Pricing & Stock */}
                            <View className="mb-3">
                                <Text className="text-base font-medium text-black mb-2">
                                    {userRole === 'business' ? 'select unit & bulk price' : 'select unit & price'}
                                </Text>
                                <View className="flex-row gap-2">
                                    {filteredUnitPrices.map((unitPrice) => (
                                        <TouchableOpacity
                                            key={unitPrice.id}
                                            onPress={() => handleUnitPriceSelect(unitPrice)}
                                            className={`p-3 rounded-lg border ${
                                                selectedUnitPrice?.id === unitPrice.id
                                                    ? 'bg-gray-100 border-action-green'
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                            style={{
                                                flex: filteredUnitPrices.length === 1 ? 1 : 1 / filteredUnitPrices.length,
                                                maxWidth: filteredUnitPrices.length === 1 ? '100%' : `${100 / filteredUnitPrices.length}%`
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text className={`text-center text-sm ${
                                                selectedUnitPrice?.id === unitPrice.id
                                                    ? 'text-action-green font-medium'
                                                    : 'text-black'
                                            }`}>
                                                rs {unitPrice.price_per_unit} / {unitPrice.unit}
                                            </Text>
                                            {userRole === 'business' && (
                                                <Text className="text-xs text-gray-500 text-center mt-1">
                                                    min: {unitPrice.minimum_order}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Quantity Selection */}
                            {selectedUnitPrice && (
                                <View className="mb-5">
                                    <Text className="text-base font-medium text-black mb-2">
                                        quantity {userRole === 'business' && `(steps of ${quantityStep})`}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        {/* Left Column - Quantity Controls */}
                                        <View className="flex-[65%]">
                                            <View className="flex-row items-center justify-between bg-gray-100 rounded-lg p-2">
                                                <TouchableOpacity
                                                    onPress={() => adjustQuantity(-1)}
                                                    className="w-8 h-8 bg-background rounded items-center justify-center"
                                                    activeOpacity={0.7}
                                                    disabled={quantity <= Math.max(
                                                        Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep,
                                                        quantityStep
                                                    )}
                                                >
                                                    <Ionicons
                                                        name="remove"
                                                        size={16}
                                                        color={quantity <= Math.max(
                                                            Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep,
                                                            quantityStep
                                                        ) ? "#ccc" : "#000"}
                                                    />
                                                </TouchableOpacity>

                                                <View className="flex-1 mx-3 items-center">
                                                    <Text className="text-lg font-medium text-black">
                                                        {quantity}
                                                    </Text>
                                                    <Text className="text-xs text-gray-600 text-center">
                                                        min: {selectedUnitPrice.minimum_order} | max: {selectedUnitPrice.quantity_available}
                                                    </Text>
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => adjustQuantity(1)}
                                                    className="w-8 h-8 bg-background rounded items-center justify-center"
                                                    activeOpacity={0.7}
                                                    disabled={quantity >= selectedUnitPrice.quantity_available}
                                                >
                                                    <Ionicons
                                                        name="add"
                                                        size={16}
                                                        color={quantity >= selectedUnitPrice.quantity_available ? "#ccc" : "#000"}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Right Column - Total Price */}
                                        <View className="flex-[35%] bg-gray-100 rounded-lg p-3 justify-center items-center flex flex-row gap-2">
                                            <Text className="text-center text-lg font-semibold">
                                                rs {(selectedUnitPrice.price_per_unit * quantity).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Action Button */}
                            <View className="pb-2">
                                <TouchableOpacity
                                    onPress={addToCartFromModal}
                                    className="bg-background py-4 px-6 rounded-xl"
                                    activeOpacity={0.7}
                                    disabled={addingToCart || !selectedUnitPrice}
                                >
                                    <Text className="text-center font-medium text-black">
                                        {addingToCart ? 'adding to cart...' : 'add to cart'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
}


//////////////////////////////////////


import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FarmerCardProps {
    farmer: {
        id: number;
        name: string;
        district: string;
        product_count: number;
    };
    onPress: () => void;
    variant?: 'horizontal' | 'vertical';
}

export default function FarmerCard({ farmer, onPress, variant = 'horizontal' }: FarmerCardProps) {
    if (variant === 'vertical') {
        return (
            <TouchableOpacity
                onPress={onPress}
                className="bg-surface rounded-xl border border-gray-300 p-4 flex-1"
                activeOpacity={0.7}
            >
                {/* Top Row: Icon and Name */}
                <View className="flex-row items-center mb-3">
                    <Ionicons name="person-circle" size={24} color="#000000" />
                    <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                        {farmer.name}
                    </Text>
                </View>

                {/* Location */}
                <View className="flex-row items-center mb-3">
                    <Ionicons name="location-outline" size={14} color="#666666" />
                    <Text className="text-sm text-gray-600 ml-1" numberOfLines={1}>
                        {farmer.district}
                    </Text>
                </View>

                {/* Product Count */}
                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={14} color="#4CAF50" />
                    <Text className="text-sm text-action-green ml-1 font-medium">
                        {farmer.product_count} product{farmer.product_count !== 1 ? 's' : ''}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // Horizontal variant
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-background rounded-xl p-4 w-64"
            activeOpacity={0.7}
        >
            {/* Top Row: Icon and Name */}
            <View className="flex-row items-center mb-3">
                <Ionicons name="person-circle" size={32} color="#000000" />
                <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                    {farmer.name}
                </Text>
            </View>

            {/* Location */}
            <View className="flex-row items-center mb-3">
                <Ionicons name="location-outline" size={16} color="#666666" />
                <Text className="text-sm text-gray-600 ml-2" numberOfLines={1}>
                    {farmer.district}
                </Text>
            </View>

            {/* Product Count */}
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={16} color="#4CAF50" />
                    <Text className="text-sm text-action-green ml-2 font-medium">
                        {farmer.product_count} product{farmer.product_count !== 1 ? 's' : ''}
                    </Text>
                </View>

                {/* Arrow indicator */}
                <Ionicons name="chevron-forward" size={18} color="#666666" />
            </View>
        </TouchableOpacity>
    );
}


//////////////////////////////////////


import { Stack } from "expo-router";
import { AuthProvider } from '@/context/AuthContext';
import { useFonts } from "expo-font";
import { useEffect } from "react";
import * as SplashScreen from 'expo-splash-screen';
import './globals.css';
import { CartProvider } from "@/context/CartContext";
import { FarmerOrdersProvider } from "@/context/FarmerOrdersContext";
import {NotificationProvider} from "@/context/NotificationContext";

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
        'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
        'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
        'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    });

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <AuthProvider>
            <CartProvider>
                <FarmerOrdersProvider>
                    <NotificationProvider>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                            }}
                        />
                    </NotificationProvider>
                </FarmerOrdersProvider>
            </CartProvider>
        </AuthProvider>
    );
}


//////////////////////////////////////


import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    color?: string;
    subtitle?: string;
    loading?: boolean;
}

export default function StatCard({
                                     title,
                                     value,
                                     icon,
                                     color = '#4CAF50',
                                     subtitle,
                                     loading = false
                                 }: StatCardProps) {
    return (
        <View
            className="bg-white rounded-xl p-4 border border-gray-200 flex-1 mx-1 relative overflow-hidden"
            style={{ height: 120 }}
        >
            {/* Background Icon - Top Right */}
            <View
                className="absolute -bottom-3 -right-3 rounded-full items-center justify-center"
                style={{
                    width: 60,
                    height: 60,
                    backgroundColor: `${color}15`
                }}
            >
                <Ionicons
                    name={icon as any}
                    size={30}
                    color={`${color}60`}
                />
            </View>

            {/* Content - Left Side */}
            <View className="flex-1 justify-between">
                {/* Header with Loading */}
                <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-gray-700">
                        {title}
                    </Text>
                    {loading && (
                        <ActivityIndicator size={12} color={color} />
                    )}
                </View>

                {/* Main Value */}
                <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                    {loading ? "..." : value}
                </Text>

                {/* Subtitle */}
                {subtitle && (
                    <Text className="text-xs text-gray-500" numberOfLines={1} style={{ marginTop: 4 }}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    );
}


//////////////////////////////////////


// app/(auth)/farmer/homepage.tsx - Complete Fixed Version
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import StatCard from '@/components/farmer/StatCard';
import ProductCard from '@/components/farmer/ProductCard';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnitPrice } from "@/types";

interface Product {
    id: number;
    item: string;
    category?: string;
    description?: string;
    farmer_id?: number;
    farmer_name?: string;
    farmer_district?: string;
    lowest_price?: number;
    unit_prices: UnitPrice[];
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

interface DashboardStats {
    totalProducts: number;
    activeProducts: number;
    totalSales: number;
    grossRevenue: number;
    netRevenue: number;
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

type CategoryTab = 'all' | 'fruits' | 'vegetables';
type TimePeriod = 'this_month' | 'this_week' | 'this_year' | 'all_time' | 'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december';

export default function FarmerDashboard() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalProducts: 0,
        activeProducts: 0,
        totalSales: 0,
        grossRevenue: 0,
        netRevenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [activeTab, setActiveTab] = useState<CategoryTab>('all');
    const [salesTimePeriod, setSalesTimePeriod] = useState<TimePeriod>('this_month');
    const [revenueTimePeriod, setRevenueTimePeriod] = useState<TimePeriod>('this_month');
    const [showSalesTimePeriodPicker, setShowSalesTimePeriodPicker] = useState(false);
    const [showRevenueTimePeriodPicker, setShowRevenueTimePeriodPicker] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);
    const [loadingRevenue, setLoadingRevenue] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    // Define which items are fruits vs vegetables
    const fruitItems = new Set([
        'apple', 'banana', 'orange', 'mango', 'pineapple', 'papaya',
        'guava', 'lychee', 'coconut', 'lemon', 'lime', 'watermelon',
        'melon', 'grapes', 'strawberry'
    ]);

    const vegetableItems = new Set([
        'tomato', 'potato', 'onion', 'carrot', 'cabbage', 'lettuce',
        'spinach', 'broccoli', 'cauliflower', 'bell_pepper', 'chili',
        'cucumber', 'eggplant', 'okra', 'green_beans', 'pumpkin',
        'beetroot', 'radish', 'ginger', 'garlic'
    ]);

    const timePeriodOptions = [
        { key: 'this_month' as TimePeriod, label: 'this month' },
        { key: 'this_week' as TimePeriod, label: 'this week' },
        { key: 'this_year' as TimePeriod, label: 'this year' },
        { key: 'all_time' as TimePeriod, label: 'all time' },
        { key: 'january' as TimePeriod, label: 'january' },
        { key: 'february' as TimePeriod, label: 'february' },
        { key: 'march' as TimePeriod, label: 'march' },
        { key: 'april' as TimePeriod, label: 'april' },
        { key: 'may' as TimePeriod, label: 'may' },
        { key: 'june' as TimePeriod, label: 'june' },
        { key: 'july' as TimePeriod, label: 'july' },
        { key: 'august' as TimePeriod, label: 'august' },
        { key: 'september' as TimePeriod, label: 'september' },
        { key: 'october' as TimePeriod, label: 'october' },
        { key: 'november' as TimePeriod, label: 'november' },
        { key: 'december' as TimePeriod, label: 'december' },
    ];

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    // Touch handler to close dropdowns when tapping outside
    const handleScreenTouch = () => {
        if (showSalesTimePeriodPicker) {
            setShowSalesTimePeriodPicker(false);
        }
        if (showRevenueTimePeriodPicker) {
            setShowRevenueTimePeriodPicker(false);
        }
    };

    useEffect(() => {
        if (user?.role !== 'farmer') {
            router.replace('/(auth)');
            return;
        }
        fetchDashboardData();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    // Separate effect for sales period changes
    useEffect(() => {
        if (user?.role === 'farmer') {
            fetchSalesData();
        }
    }, [salesTimePeriod, user]);

    // Separate effect for revenue period changes
    useEffect(() => {
        if (user?.role === 'farmer') {
            fetchRevenueData();
        }
    }, [revenueTimePeriod, user]);

    const fetchDashboardData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            // Fetch farmer's products
            const productsResponse = await api.get('/products/my', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProducts(productsResponse.data || []);

            // Calculate basic stats from products
            const totalProducts = (productsResponse.data || []).length;
            const activeProducts = (productsResponse.data || []).filter((p: Product) => p.is_active).length;

            // Update product stats
            setStats(prev => ({
                ...prev,
                totalProducts,
                activeProducts
            }));

            // Fetch sales and revenue data
            await Promise.all([
                fetchSalesData(),
                fetchRevenueData()
            ]);

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            showAlert(
                'error',
                'error',
                'failed to load dashboard data',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchSalesData = async () => {
        try {
            setLoadingSales(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const salesResponse = await api.get(`/orders/farmer/sales/${salesTimePeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const salesCount = salesResponse.data?.total_sales || 0;

            setStats(prev => ({
                ...prev,
                totalSales: salesCount
            }));

        } catch (salesError: any) {
            console.error('Error fetching sales data:', salesError);
            // Don't show alert for sales errors, just set to 0
            setStats(prev => ({
                ...prev,
                totalSales: 0
            }));
        } finally {
            setLoadingSales(false);
        }
    };

    const fetchRevenueData = async () => {
        try {
            setLoadingRevenue(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const revenueResponse = await api.get(`/orders/farmer/revenue/${revenueTimePeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const grossRevenue = revenueResponse.data?.grossRevenue || 0;
            const netRevenue = revenueResponse.data?.netRevenue || 0;

            setStats(prev => ({
                ...prev,
                grossRevenue: Number(grossRevenue),
                netRevenue: Number(netRevenue)
            }));

        } catch (revenueError: any) {
            console.error('Error fetching revenue data:', revenueError);
            // Don't show alert for revenue errors, just set to 0
            setStats(prev => ({
                ...prev,
                grossRevenue: 0,
                netRevenue: 0
            }));
        } finally {
            setLoadingRevenue(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const handleSalesTimePeriodChange = (newPeriod: TimePeriod) => {
        setSalesTimePeriod(newPeriod);
        setShowSalesTimePeriodPicker(false);
    };

    const handleRevenueTimePeriodChange = (newPeriod: TimePeriod) => {
        setRevenueTimePeriod(newPeriod);
        setShowRevenueTimePeriodPicker(false);
    };

    const handleAddProduct = () => {
        router.push('/farmer/add-product');
    };

    const handleEditProduct = (product: Product) => {
        router.push(`/farmer/edit-product/${product.id}`);
    };

    const handleToggleProductStatus = async (productId: number, newStatus: boolean) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.put(`/products/${productId}`,
                { is_active: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state
            setProducts(prev =>
                prev.map(p =>
                    p.id === productId ? { ...p, is_active: newStatus } : p
                )
            );

            // Update stats
            setStats(prev => ({
                ...prev,
                activeProducts: prev.activeProducts + (newStatus ? 1 : -1)
            }));

            showAlert(
                'success',
                'success',
                `product ${newStatus ? 'listed' : 'unlisted'} successfully`,
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error updating product status:', error);
            showAlert(
                'error',
                'error',
                'failed to update product status',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    const EmptyProductsComponent = ({ category }: { category: CategoryTab }) => {
        const getEmptyMessage = () => {
            switch (category) {
                case 'fruits':
                    return {
                        emoji: '🍎',
                        title: 'no fruits yet',
                        subtitle: 'you haven\'t listed any fruits for sale'
                    };
                case 'vegetables':
                    return {
                        emoji: '🥕',
                        title: 'no vegetables yet',
                        subtitle: 'you haven\'t listed any vegetables for sale'
                    };
                default:
                    return {
                        emoji: '🌱',
                        title: 'no products yet',
                        subtitle: 'start by adding your first product to begin selling on farmlink'
                    };
            }
        };

        const message = getEmptyMessage();

        return (
            <View className="bg-surface rounded-xl p-8 items-center mx-6">
                <Text className="text-6xl mb-4">{message.emoji}</Text>
                <Text className="text-lg font-medium text-black mb-2">
                    {message.title}
                </Text>
                <Text className="text-gray-600 text-center mb-4">
                    {message.subtitle}
                </Text>
            </View>
        );
    };

    const TabButton = ({ tab, title, isActive, onPress }: {
        tab: CategoryTab;
        title: string;
        isActive: boolean;
        onPress: () => void;
    }) => (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-1 py-2 px-4 rounded-lg ${
                isActive ? 'bg-background' : 'bg-gray-100'
            }`}
            activeOpacity={0.7}
        >
            <Text className={`text-center font-medium text-sm ${
                isActive ? 'text-black' : 'text-gray-600'
            }`}>
                {title}
            </Text>
        </TouchableOpacity>
    );

    // Calculate number of columns based on screen width
    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    // Filter products based on active tab
    const getFilteredProducts = () => {
        if (activeTab === 'all') return products;
        if (activeTab === 'fruits') {
            return products.filter(product => fruitItems.has(product.item));
        }
        if (activeTab === 'vegetables') {
            return products.filter(product => vegetableItems.has(product.item));
        }
        return products;
    };

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const filteredProducts = getFilteredProducts();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredProducts.length - 1) / numColumns);

        return (
            <View
                style={{
                    flex: 1,
                    marginBottom: isLastRow ? 0 : 12,
                    marginHorizontal: 4,
                    maxWidth: `${100 / numColumns - 2}%`
                }}
            >
                <ProductCard
                    product={item}
                    onEdit={handleEditProduct}
                    onToggleStatus={handleToggleProductStatus}
                />
            </View>
        );
    };

    const getSalesTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === salesTimePeriod);
        return option ? option.label : 'this month';
    };

    const getRevenueTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === revenueTimePeriod);
        return option ? option.label : 'this month';
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="dashboard" showSettingsButton={true} showOrdersButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading dashboard...</Text>
                </View>
            </View>
        );
    }

    const filteredProducts = getFilteredProducts();

    return (
        <TouchableWithoutFeedback onPress={handleScreenTouch}>
            <View className="flex-1 bg-surface">
                <Header
                    title="dashboard"
                    showSettingsButton={true}
                    showOrdersButton={true}
                    showNotificationButton={true}
                />

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
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {/* Welcome Section */}
                    <View className="px-5 pt-6 pb-4">
                        <Text className="text-xl font-semibold text-black mb-2">
                            welcome back, {user?.farmer_profile?.first_name.toLowerCase()}!
                        </Text>
                        <Text className="text-base text-gray-600">
                            here&#39;s your farm&#39;s performance overview
                        </Text>
                    </View>

                    {/* Statistics Cards - FIXED VERSION */}
                    <View className="px-5 mb-6">
                        <View className="flex-row mb-3">
                            <StatCard
                                title="total products"
                                value={stats.totalProducts}
                                icon="leaf-outline"
                                color="#4CAF50"
                            />
                            <StatCard
                                title="active listings"
                                value={stats.activeProducts}
                                icon="checkmark-circle-outline"
                                color="#2196F3"
                            />
                        </View>

                        {/* Bottom Row with Fixed Dropdowns */}
                        <View className="flex-row gap-2">
                            {/* Sales Card with Fixed Dropdown */}
                            <View className="flex-1 relative">
                                <View className="bg-white rounded-xl p-4 border border-gray-200 relative" style={{ height: 120, overflow: 'hidden' }}>
                                    {/* Background Icon */}
                                    <View
                                        className="absolute rounded-full items-center justify-center"
                                        style={{
                                            width: 60,
                                            height: 60,
                                            backgroundColor: '#FF980015',
                                            bottom: -10,
                                            right: -10
                                        }}
                                    >
                                        <Ionicons name="bag-handle-outline" size={30} color="#FF980060" />
                                    </View>

                                    {/* Content */}
                                    <View className="flex-1 justify-between relative z-10">
                                        {/* Header with Dropdown Button */}
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-sm font-medium text-gray-700">total sales</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowSalesTimePeriodPicker(!showSalesTimePeriodPicker)}
                                                className="p-1"
                                                activeOpacity={0.7}
                                                disabled={loadingSales}
                                            >
                                                <Ionicons
                                                    name={showSalesTimePeriodPicker ? "chevron-up" : "chevron-down"}
                                                    size={16}
                                                    color="#666666"
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Main Value */}
                                        <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                            {loadingSales ? "..." : stats.totalSales}
                                        </Text>

                                        {/* Subtitle with period */}
                                        <Text className="text-xs text-gray-500" style={{ marginTop: 4 }}>
                                            {getSalesTimePeriodLabel()}
                                        </Text>

                                        {/* Loading Indicator */}
                                        {loadingSales && (
                                            <View className="absolute top-2 right-8">
                                                <ActivityIndicator size={12} color="#FF9800" />
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Dropdown Menu - Fixed Positioning */}
                                {showSalesTimePeriodPicker && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: 40,
                                            right: 0,
                                            minWidth: 140,
                                            maxHeight: 200,
                                            backgroundColor: 'white',
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#e5e7eb',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 3.84,
                                            elevation: 10,
                                            zIndex: 1000,
                                            padding: 8
                                        }}
                                    >
                                        <ScrollView style={{ maxHeight: 192 }}>
                                            {timePeriodOptions.map((option) => (
                                                <TouchableOpacity
                                                    key={option.key}
                                                    onPress={() => handleSalesTimePeriodChange(option.key)}
                                                    style={{
                                                        paddingVertical: 8,
                                                        paddingHorizontal: 12,
                                                        borderRadius: 8,
                                                        backgroundColor: salesTimePeriod === option.key ? '#f3f4f6' : 'transparent'
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={{
                                                        fontSize: 14,
                                                        color: salesTimePeriod === option.key ? '#000' : '#666',
                                                        fontWeight: salesTimePeriod === option.key ? '500' : '400'
                                                    }}>
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Revenue Card with Fixed Dropdown */}
                            <View className="flex-1 relative">
                                <View className="bg-white rounded-xl p-4 border border-gray-200 relative" style={{ height: 120, overflow: 'hidden' }}>
                                    {/* Background Icon */}
                                    <View
                                        className="absolute rounded-full items-center justify-center"
                                        style={{
                                            width: 60,
                                            height: 60,
                                            backgroundColor: '#9C27B015',
                                            bottom: -10,
                                            right: -10
                                        }}
                                    >
                                        <Ionicons name="trending-up-outline" size={30} color="#9C27B060" />
                                    </View>

                                    {/* Content */}
                                    <View className="flex-1 justify-between relative z-10">
                                        {/* Header with Dropdown Button */}
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-sm font-medium text-gray-700">revenue</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowRevenueTimePeriodPicker(!showRevenueTimePeriodPicker)}
                                                className="p-1"
                                                activeOpacity={0.7}
                                                disabled={loadingRevenue}
                                            >
                                                <Ionicons
                                                    name={showRevenueTimePeriodPicker ? "chevron-up" : "chevron-down"}
                                                    size={16}
                                                    color="#666666"
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Main Value */}
                                        <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                            {loadingRevenue ? "..." : `rs ${stats.netRevenue.toFixed(0)}`}
                                        </Text>

                                        {/* Subtitle with period and gross revenue */}
                                        <View style={{ marginTop: 4 }}>
                                            <Text className="text-xs text-gray-500">
                                                {getRevenueTimePeriodLabel()}
                                            </Text>
                                            {!loadingRevenue && (
                                                <Text className="text-xs text-gray-400">
                                                    gross: rs {stats.grossRevenue.toFixed(0)}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Loading Indicator */}
                                        {loadingRevenue && (
                                            <View className="absolute top-2 right-8">
                                                <ActivityIndicator size={12} color="#9C27B0" />
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Dropdown Menu - Fixed Positioning */}
                                {showRevenueTimePeriodPicker && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: 40,
                                            right: 0,
                                            minWidth: 140,
                                            maxHeight: 200,
                                            backgroundColor: 'white',
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#e5e7eb',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 3.84,
                                            elevation: 10,
                                            zIndex: 1000,
                                            padding: 8
                                        }}
                                    >
                                        <ScrollView style={{ maxHeight: 192 }}>
                                            {timePeriodOptions.map((option) => (
                                                <TouchableOpacity
                                                    key={option.key}
                                                    onPress={() => handleRevenueTimePeriodChange(option.key)}
                                                    style={{
                                                        paddingVertical: 8,
                                                        paddingHorizontal: 12,
                                                        borderRadius: 8,
                                                        backgroundColor: revenueTimePeriod === option.key ? '#f3f4f6' : 'transparent'
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={{
                                                        fontSize: 14,
                                                        color: revenueTimePeriod === option.key ? '#000' : '#666',
                                                        fontWeight: revenueTimePeriod === option.key ? '500' : '400'
                                                    }}>
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Products Section */}
                    <View className="px-5">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-medium text-black">
                                my products
                            </Text>
                            <Text className="text-sm text-gray-500">
                                {filteredProducts.length} {activeTab === 'all' ? 'total' : activeTab}
                            </Text>
                        </View>

                        {/* Tab Navigation */}
                        <View className="flex-row mb-6 rounded-lg flex gap-2">
                            <TabButton
                                tab="all"
                                title="all"
                                isActive={activeTab === 'all'}
                                onPress={() => setActiveTab('all')}
                            />
                            <TabButton
                                tab="fruits"
                                title="fruits"
                                isActive={activeTab === 'fruits'}
                                onPress={() => setActiveTab('fruits')}
                            />
                            <TabButton
                                tab="vegetables"
                                title="vegetables"
                                isActive={activeTab === 'vegetables'}
                                onPress={() => setActiveTab('vegetables')}
                            />
                        </View>
                    </View>

                    {filteredProducts.length === 0 ? (
                        <EmptyProductsComponent category={activeTab} />
                    ) : (
                        <FlatList
                            data={filteredProducts}
                            renderItem={renderProductItem}
                            numColumns={getNumColumns()}
                            key={`${getNumColumns()}-${activeTab}`}
                            scrollEnabled={false}
                            contentContainerStyle={{ paddingHorizontal: 18 }}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </ScrollView>

                {/* Floating Action Button */}
                <FloatingActionButton
                    onPress={handleAddProduct}
                    icon="add"
                />

                {/* Custom Alert */}
                <CustomAlert
                    visible={alert.visible}
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    buttons={alert.buttons}
                    onClose={hideAlert}
                />
            </View>
        </TouchableWithoutFeedback>
    );
}


//////////////////////////////////////


// app/(auth)/farmer/orders.tsx
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { getProductBackgroundColor } from '@/utils/products';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

type OrderStatus = 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderItem {
    id: number;
    farmer_id: number;
    item_name: string;
    unit: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    product_description?: string;
    created_at: string;
}

interface Order {
    id: number;
    order_number: string;
    status: OrderStatus;
    final_amount: number;
    item_count: number;
    created_at: string;
}

interface OrderDetails {
    id: number;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    delivery_fee: number;
    final_amount: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    delivery_address: string;
    delivery_notes?: string;
    items: OrderItem[];
    created_at: string;
    updated_at: string;
    delivered_at?: string;
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

export default function FarmerOrdersScreen() {
    const { user } = useContext(AuthContext);
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [orderDetails, setOrderDetails] = useState<{ [key: number]: OrderDetails }>({});
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingOrderDetails, setLoadingOrderDetails] = useState<Set<number>>(new Set());
    const [animations, setAnimations] = useState<{ [key: number]: Animated.Value }>({});
    const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set());
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        if (user?.role !== 'farmer') {
            router.replace('/(auth)');
            return;
        }
        fetchOrders();
    }, [user]);

    const fetchOrders = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Sort orders: delivered orders at the end, others by oldest first
            const sortedOrders = response.data.sort((a: Order, b: Order) => {
                if (a.status === 'delivered' && b.status !== 'delivered') return 1;
                if (a.status !== 'delivered' && b.status === 'delivered') return -1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            setOrders(sortedOrders);
        } catch (error: any) {
            console.error('Error fetching orders:', error);
            if (error.response?.status === 401) {
                router.replace('/login');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchOrderDetails = async (orderId: number) => {
        if (orderDetails[orderId] || loadingOrderDetails.has(orderId)) {
            return;
        }

        setLoadingOrderDetails(prev => new Set(prev).add(orderId));

        try {
            const token = await AsyncStorage.getItem('token');
            const response = await api.get(`/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrderDetails(prev => ({
                ...prev,
                [orderId]: response.data
            }));
        } catch (error: any) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingOrderDetails(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
        }
    };

    const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
        showAlert(
            'warning',
            'Update Order Status',
            `Are you sure you want to change the status to ${newStatus.replace('_', ' ')}?`,
            [
                { text: 'Cancel', style: 'cancel', onPress: hideAlert },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: () => performStatusUpdate(orderId, newStatus)
                }
            ]
        );
    };

    const performStatusUpdate = async (orderId: number, newStatus: OrderStatus) => {
        setUpdatingStatus(prev => new Set(prev).add(orderId));

        try {
            const token = await AsyncStorage.getItem('token');

            await api.put(`/orders/${orderId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` }}
            );

            // Update local state
            setOrders(prev => prev.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            ));

            if (orderDetails[orderId]) {
                setOrderDetails(prev => ({
                    ...prev,
                    [orderId]: {
                        ...prev[orderId],
                        status: newStatus
                    }
                }));
            }

            showAlert(
                'success',
                'Status Updated',
                `Order status changed to ${newStatus.replace('_', ' ')}`,
                [{ text: 'OK', style: 'cancel', onPress: hideAlert }]
            );

        } catch (error: any) {
            console.error('Error updating order status:', error);

            let errorMessage = 'Failed to update order status';
            if (error.response?.status === 403) {
                errorMessage = 'You do not have permission to update this order status';
            } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            }

            showAlert(
                'error',
                'Update Failed',
                errorMessage,
                [{ text: 'OK', style: 'cancel', onPress: hideAlert }]
            );
        } finally {
            setUpdatingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const getAnimationValue = (orderId: number) => {
        if (!animations[orderId]) {
            const newAnimValue = new Animated.Value(0);
            setAnimations(prev => ({
                ...prev,
                [orderId]: newAnimValue
            }));
            return newAnimValue;
        }
        return animations[orderId];
    };

    const toggleOrderExpansion = (orderId: number) => {
        const newExpanded = new Set(expandedOrders);
        const animationValue = getAnimationValue(orderId);

        if (newExpanded.has(orderId)) {
            // Collapse
            Animated.timing(animationValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                newExpanded.delete(orderId);
                setExpandedOrders(new Set(newExpanded));
            });
        } else {
            // Expand
            newExpanded.add(orderId);
            setExpandedOrders(new Set(newExpanded));
            fetchOrderDetails(orderId);

            Animated.timing(animationValue, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    };

    const getStatusColor = (status: OrderStatus): string => {
        switch (status) {
            case 'confirmed':
                return '#3b82f6'; // blue
            case 'processing':
                return '#f59e0b'; // amber
            case 'out_for_delivery':
                return '#8b5cf6'; // purple
            case 'delivered':
                return '#10b981'; // green
            case 'cancelled':
                return '#ef4444'; // red
            default:
                return '#6b7280'; // gray
        }
    };

    const getStatusText = (status: OrderStatus): string => {
        switch (status) {
            case 'confirmed':
                return 'confirmed';
            case 'processing':
                return 'processing';
            case 'out_for_delivery':
                return 'out for delivery';
            case 'delivered':
                return 'delivered';
            case 'cancelled':
                return 'cancelled';
            default:
                return status;
        }
    };

    const getAvailableStatusOptions = (currentStatus: OrderStatus): OrderStatus[] => {
        switch (currentStatus) {
            case 'confirmed':
                return ['processing', 'out_for_delivery', 'delivered', 'cancelled'];
            case 'processing':
                return ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
            case 'out_for_delivery':
                return ['processing', 'delivered', 'cancelled'];
            case 'delivered':
                return []; // Can't change from delivered
            case 'cancelled':
                return []; // Can't change from cancelled
            default:
                return [];
        }
    };

    const formatPrice = (price: number | string | undefined): string => {
        const numPrice = Number(price) || 0;
        return numPrice.toFixed(2);
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderStatusButton = (orderId: number, status: OrderStatus, isCurrentStatus: boolean) => {
        const isUpdating = updatingStatus.has(orderId);

        return (
            <TouchableOpacity
                key={status}
                onPress={() => updateOrderStatus(orderId, status)}
                disabled={isUpdating}
                className={`px-3 py-2 rounded-lg mr-2 mb-2 ${
                    isCurrentStatus ? 'bg-gray-200' : 'bg-background'
                }`}
                activeOpacity={0.7}
            >
                <Text
                    className={`text-sm font-medium ${
                        isCurrentStatus ? 'text-gray-500' : 'text-black'
                    }`}
                    style={isCurrentStatus ? {} : { color: getStatusColor(status) }}
                >
                    {getStatusText(status)}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderOrderItem = (item: OrderItem) => {
        const productImage = getProductImage(item.item_name || '');

        return (
            <View key={item.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0">
                {/* Product Image */}
                <View
                    className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: getProductBackgroundColor(item.item_name.toLowerCase() || '') }}
                >
                    <Image
                        source={productImage}
                        style={{
                            width: 28,
                            height: 28,
                            resizeMode: 'contain',
                        }}
                    />
                </View>

                {/* Product Info */}
                <View className="flex-1">
                    <Text className="text-sm font-medium text-black">
                        {item.item_name || 'unknown product'}
                    </Text>
                    <Text className="text-xs text-gray-600">
                        {item.quantity} {item.unit} × rs {formatPrice(item.unit_price)}
                    </Text>
                </View>

                {/* Total Price */}
                <Text className="text-sm font-semibold text-black">
                    rs {formatPrice(item.total_price)}
                </Text>
            </View>
        );
    };

    const renderOrder = (order: Order) => {
        const isExpanded = expandedOrders.has(order.id);
        const details = orderDetails[order.id];
        const isLoadingDetails = loadingOrderDetails.has(order.id);
        const animationValue = getAnimationValue(order.id);
        const isUpdating = updatingStatus.has(order.id);

        return (
            <View key={order.id} className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-200">
                {/* Order Header - Clickable */}
                <TouchableOpacity
                    onPress={() => toggleOrderExpansion(order.id)}
                    className="p-4"
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-black mb-1">
                                #{order.order_number}
                            </Text>
                            <Text className="text-sm text-gray-600">
                                {formatDate(order.created_at)}
                            </Text>
                        </View>

                        <View className="items-end">
                            <View
                                className="px-3 py-1 rounded-full mb-1"
                                style={{ backgroundColor: getStatusColor(order.status) + '20' }}
                            >
                                <Text
                                    className="text-xs font-medium capitalize"
                                    style={{ color: getStatusColor(order.status) }}
                                >
                                    {getStatusText(order.status)}
                                </Text>
                            </View>
                            <Text className="text-lg font-bold text-black">
                                rs {formatPrice(order.final_amount)}
                            </Text>
                        </View>
                    </View>

                    <Text className="text-sm text-gray-600">
                        {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                    </Text>
                </TouchableOpacity>

                {/* Animated Expanded Order Details */}
                {isExpanded && (
                    <Animated.View
                        style={{
                            maxHeight: animationValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 1000],
                            }),
                            opacity: animationValue,
                        }}
                        className="border-t border-gray-100 overflow-hidden"
                    >
                        {isLoadingDetails ? (
                            <View className="p-4 items-center">
                                <ActivityIndicator size="small" color="#4CAF50" />
                                <Text className="text-gray-600 mt-2 text-sm">loading order details...</Text>
                            </View>
                        ) : details ? (
                            <View className="p-4">
                                {/* Customer Information */}
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">customer information</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        <Text className="text-sm font-medium text-black mb-1">{details.customer_name}</Text>
                                        <Text className="text-sm text-gray-600 mb-1">{details.customer_phone}</Text>
                                        <Text className="text-sm text-gray-600">{details.customer_email}</Text>
                                    </View>
                                </View>

                                {/* Delivery Address */}
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">delivery address</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        <Text className="text-sm text-gray-600">{details.delivery_address}</Text>
                                        {details.delivery_notes && (
                                            <Text className="text-sm text-gray-500 mt-1">
                                                note: {details.delivery_notes}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* Order Items */}
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-3">order items</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        {details.items.map(renderOrderItem)}
                                    </View>
                                </View>

                                {/* Order Status Actions */}
                                {getAvailableStatusOptions(details.status).length > 0 && (
                                    <View className="mb-4">
                                        <Text className="text-sm font-medium text-black mb-3">
                                            change order status
                                            {isUpdating && <Text className="text-gray-500"> (updating...)</Text>}
                                        </Text>
                                        <View className="flex-row flex-wrap">
                                            {getAvailableStatusOptions(details.status).map(status =>
                                                renderStatusButton(order.id, status, false)
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Order Total */}
                                <View className="bg-gray-50 rounded-lg p-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">items total</Text>
                                        <Text className="text-sm text-black">rs {formatPrice(details.total_amount)}</Text>
                                    </View>
                                    {details.delivery_fee > 0 && (
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-sm text-gray-600">delivery fee</Text>
                                            <Text className="text-sm text-black">rs {formatPrice(details.delivery_fee)}</Text>
                                        </View>
                                    )}
                                    <View className="flex-row justify-between items-center mb-2 pt-2 border-t border-gray-200">
                                        <Text className="text-sm font-medium text-black">order total</Text>
                                        <Text className="text-sm font-medium text-black">rs {formatPrice(details.final_amount)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">platform fee (10%)</Text>
                                        <Text className="text-sm text-red-600">- rs {formatPrice(details.final_amount * 0.1)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-300">
                                        <Text className="text-base font-semibold text-black">your earnings</Text>
                                        <Text className="text-base font-bold text-green-600">rs {formatPrice(details.final_amount * 0.9)}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View className="p-4">
                                <Text className="text-gray-500 text-sm text-center">failed to load order details</Text>
                            </View>
                        )}
                    </Animated.View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="my orders"
                    showBackButton={true}
                    showNotificationButton={true}
                    showHomeButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading orders...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="my orders"
                showBackButton={true}
                showNotificationButton={true}
                showHomeButton={true}
            />

            {orders.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        no orders yet
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        when customers place orders for your products, they will appear here
                    </Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-5 pt-6"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#4CAF50']}
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {orders.map(renderOrder)}
                </ScrollView>
            )}

            {/* Custom Alert */}
            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}


//////////////////////////////////////


import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import FarmerCard from '@/components/customer/FarmerCard';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {UnitPrice} from "@/types";

interface Farmer {
    id: number;
    name: string;
    district: string;
    product_count: number;
}

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: UnitPrice[];
    created_at: string;
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

export default function CustomerHomePage() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [latestProducts, setLatestProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }
        fetchHomeData();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    const fetchHomeData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            // Fetch farmers and latest products in parallel
            const [farmersResponse, productsResponse] = await Promise.all([
                api.get('/browse/farmers?limit=10', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                api.get('/browse/products/latest?limit=20', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setFarmers(farmersResponse.data);

            // Filter products that have pricing for the current user type
            const userRole = user?.role || 'individual';
            const filteredProducts = productsResponse.data.filter((product: Product) => {
                const customerType = userRole as 'individual' | 'business';
                return product.unit_prices.some(up => up.customer_type === customerType);
            });

            setLatestProducts(filteredProducts);

        } catch (error: any) {
            console.error('Error fetching home data:', error);
            showAlert(
                'error',
                'error',
                'failed to load homepage data',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchHomeData();
    };// app/(auth)/customer/homepage.tsx - Updated with Suggested For You section
    import { useEffect, useState, useContext } from 'react';
    import {
        View,
        Text,
        ScrollView,
        RefreshControl,
        ActivityIndicator,
        FlatList,
        TouchableOpacity,
        Dimensions
    } from 'react-native';
    import { useRouter } from 'expo-router';
    import { AuthContext } from '@/context/AuthContext';
    import Header from '@/components/ui/Header';
    import FarmerCard from '@/components/customer/FarmerCard';
    import ProductCard from '@/components/customer/ProductCard';
    import CustomAlert from '@/components/ui/CustomAlert';
    import { Ionicons } from '@expo/vector-icons';
    import api from '@/services/api';
    import AsyncStorage from '@react-native-async-storage/async-storage';
    import {UnitPrice} from "@/types";

    interface Farmer {
        id: number;
        name: string;
        district: string;
        product_count: number;
    }

    interface Product {
        id: number;
        item: string;
        category: string;
        description?: string;
        farmer_id: number;
        farmer_name: string;
        farmer_district: string;
        lowest_price: number;
        unit_prices: UnitPrice[];
        created_at: string;
    }

    interface RecommendationData {
        recommendations: Product[];
        has_purchase_history: boolean;
        total_recommendations: number;
        message: string;
    }

    interface AlertState {
        visible: boolean;
        type: 'success' | 'error' | 'warning' | 'info';
        title: string;
        message: string;
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>;
    }

    export default function CustomerHomePage() {
        const router = useRouter();
        const { user } = useContext(AuthContext);
        const [farmers, setFarmers] = useState<Farmer[]>([]);
        const [latestProducts, setLatestProducts] = useState<Product[]>([]);
        const [recommendations, setRecommendations] = useState<RecommendationData>({
            recommendations: [],
            has_purchase_history: false,
            total_recommendations: 0,
            message: ''
        });
        const [loading, setLoading] = useState(true);
        const [refreshing, setRefreshing] = useState(false);
        const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
        const [alert, setAlert] = useState<AlertState>({
            visible: false,
            type: 'info',
            title: '',
            message: '',
            buttons: []
        });

        const showAlert = (
            type: 'success' | 'error' | 'warning' | 'info',
            title: string,
            message: string,
            buttons: Array<{
                text: string;
                onPress: () => void;
                style?: 'default' | 'cancel' | 'destructive';
            }>
        ) => {
            setAlert({
                visible: true,
                type,
                title,
                message,
                buttons
            });
        };

        const hideAlert = () => {
            setAlert(prev => ({ ...prev, visible: false }));
        };

        useEffect(() => {
            if (user?.role !== 'individual' && user?.role !== 'business') {
                router.replace('/(auth)');
                return;
            }
            fetchHomeData();

            // Listen for screen dimension changes
            const subscription = Dimensions.addEventListener('change', ({ window }) => {
                setScreenWidth(window.width);
            });

            return () => subscription?.remove();
        }, [user]);

        const fetchHomeData = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    router.replace('/login');
                    return;
                }

                // Fetch farmers, latest products, and recommendations in parallel
                const [farmersResponse, productsResponse, recommendationsResponse] = await Promise.all([
                    api.get('/browse/farmers?limit=10', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    api.get('/browse/products/latest?limit=20', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    api.get('/browse/products/recommendations', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                setFarmers(farmersResponse.data);

                // Filter products that have pricing for the current user type
                const userRole = user?.role || 'individual';
                const filteredProducts = productsResponse.data.filter((product: Product) => {
                    const customerType = userRole as 'individual' | 'business';
                    return product.unit_prices.some(up => up.customer_type === customerType);
                });

                setLatestProducts(filteredProducts);
                setRecommendations(recommendationsResponse.data);

            } catch (error: any) {
                console.error('Error fetching home data:', error);
                showAlert(
                    'error',
                    'error',
                    'failed to load homepage data',
                    [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        };

        const handleRefresh = () => {
            setRefreshing(true);
            fetchHomeData();
        };

        const handleFarmerPress = (farmer: Farmer) => {
            router.push(`/customer/farmers/${farmer.id}`);
        };

        const handleViewAllProducts = () => {
            router.push('/customer/products');
        };

        const getNumColumns = () => {
            if (screenWidth < 390) return 1;
            if (screenWidth < 768) return 2;
            return 3;
        };

        const renderFarmerItem = ({ item }: { item: Farmer }) => (
            <FarmerCard
                farmer={item}
                onPress={() => handleFarmerPress(item)}
            />
        );

        const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
            const numColumns = getNumColumns();
            const isLastRow = Math.floor(index / numColumns) === Math.floor((latestProducts.length - 1) / numColumns);

            return (
                <View
                    style={{
                        flex: 1,
                        marginBottom: isLastRow ? 0 : 12,
                        marginHorizontal: 4,
                        maxWidth: `${100 / numColumns - 2}%`
                    }}
                >
                    <ProductCard product={item} />
                </View>
            );
        };

        const renderRecommendationItem = ({ item }: { item: Product }) => (
            <View style={{ width: screenWidth * 0.45, marginRight: 12 }}>
                <ProductCard product={item} />
            </View>
        );

        if (loading) {
            return (
                <View className="flex-1 bg-surface">
                    <Header
                        title="farmlink"
                        showCartButton={true}
                    />
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text className="text-gray-600 mt-4">loading homepage...</Text>
                    </View>
                </View>
            );
        }

        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="farmlink"
                    showCartButton={true}
                    showSettingsButton={true}
                    showOrdersButton={true}
                    showNotificationButton={true}
                />

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
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {/* Welcome Section */}
                    <View className="px-5 pt-6 pb-4">
                        <Text className="text-xl font-semibold text-black mb-2">
                            welcome back, {user?.individual_profile?.first_name?.toLowerCase() ||
                            user?.business_profile?.contact_name?.toLowerCase() || 'there'}!
                        </Text>
                        <Text className="text-base text-gray-600">
                            discover fresh produce from local farmers
                            {user?.role === 'business' && ' with bulk pricing'}
                        </Text>
                    </View>

                    {/* Suggested For You Section */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center px-5 mb-4">
                            <View className="flex-row items-center">
                                <Ionicons name="sparkles" size={20} color="#4CAF50" />
                                <Text className="text-lg font-medium text-black ml-2">
                                    suggested for you
                                </Text>
                            </View>
                            {recommendations.has_purchase_history && recommendations.recommendations.length > 0 && (
                                <TouchableOpacity
                                    onPress={handleViewAllProducts}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-sm text-action-green font-medium">
                                        explore more
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {recommendations.recommendations.length === 0 ? (
                            <View className="bg-surface rounded-xl p-6 mx-5 border border-gray-100">
                                <View className="items-center">
                                    <View className="w-16 h-16 bg-green-50 rounded-full items-center justify-center mb-4">
                                        <Ionicons name="bulb" size={32} color="#4CAF50" />
                                    </View>
                                    <Text className="text-base font-medium text-black mb-2 text-center">
                                        your personalized picks await
                                    </Text>
                                    <Text className="text-sm text-gray-600 text-center leading-5">
                                        {recommendations.message}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={handleViewAllProducts}
                                        className="bg-action-green px-6 py-3 rounded-xl mt-4"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-white font-medium">
                                            start exploring
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-sm text-gray-600 mb-4 px-5">
                                    {recommendations.message}
                                </Text>
                                <FlatList
                                    data={recommendations.recommendations}
                                    renderItem={({ item }) => (
                                        <View style={{ width: screenWidth * 0.45, marginRight: 12 }}>
                                            <ProductCard product={item} />
                                        </View>
                                    )}
                                    keyExtractor={(item) => item.id.toString()}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 20 }}
                                />
                            </View>
                        )}
                    </View>

                    {/* Featured Farmers Section */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center px-5 mb-4">
                            <Text className="text-lg font-medium text-black">
                                featured farmers
                            </Text>
                            <TouchableOpacity
                                onPress={() => router.push('/customer/farmers')}
                                activeOpacity={0.7}
                            >
                                <Text className="text-sm text-action-green font-medium">
                                    view all
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {farmers.length === 0 ? (
                            <View className="bg-surface rounded-xl p-8 items-center mx-6">
                                <Text className="text-4xl mb-4">👨‍🌾</Text>
                                <Text className="text-lg font-medium text-black mb-2">
                                    no farmers available
                                </Text>
                                <Text className="text-gray-600 text-center">
                                    check back later for featured farmers in your area
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={farmers}
                                renderItem={renderFarmerItem}
                                keyExtractor={(item) => item.id.toString()}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                            />
                        )}
                    </View>

                    {/* Fresh Arrivals Section */}
                    <View className="px-5">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-medium text-black">
                                fresh arrivals
                            </Text>
                            <TouchableOpacity
                                onPress={handleViewAllProducts}
                                activeOpacity={0.7}
                            >
                                <Text className="text-sm text-action-green font-medium">
                                    view all
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {latestProducts.length === 0 ? (
                            <View className="bg-surface rounded-xl p-8 items-center">
                                <Text className="text-lg font-medium text-black mb-2">
                                    {user?.role === 'business'
                                        ? 'no bulk products available'
                                        : 'no products available'
                                    }
                                </Text>
                                <Text className="text-gray-600 text-center">
                                    {user?.role === 'business'
                                        ? 'farmers are working to add bulk pricing options soon'
                                        : 'farmers are working hard to bring fresh produce soon'
                                    }
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={latestProducts}
                                renderItem={renderProductItem}
                                numColumns={getNumColumns()}
                                key={`latest-${getNumColumns()}`}
                                scrollEnabled={false}
                                contentContainerStyle={{ paddingHorizontal: 0 }}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </ScrollView>

                {/* Custom Alert */}
                <CustomAlert
                    visible={alert.visible}
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    buttons={alert.buttons}
                    onClose={hideAlert}
                />
            </View>
        );
    }


//////////////////////////////////////


// Updated app/(auth)/customer/orders.tsx - Smart status display for multi vs single farmer orders
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { getProductBackgroundColor } from '@/utils/products';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

type OrderStatus = 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderItem {
    id: number;
    farmer_id: number;
    item_name: string;
    unit: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    product_description?: string;
    created_at: string;
}

interface Order {
    id: number;
    order_number: string;
    status: OrderStatus;
    final_amount: number;
    farmer_count?: number;
    item_count: number;
    created_at: string;
    items?: OrderItem[];
}

interface OrderDetails {
    id: number;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    delivery_fee: number;
    final_amount: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    delivery_address: string;
    delivery_notes?: string;
    items: OrderItem[];
    created_at: string;
    updated_at: string;
    delivered_at?: string;
}

interface FarmerStatus {
    farmer_name: string;
    status: string;
    farmer_district?: string;
}

interface FarmerStatuses {
    [farmerId: number]: FarmerStatus;
}

export default function OrdersScreen() {
    const { user } = useContext(AuthContext);
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [orderDetails, setOrderDetails] = useState<{ [key: number]: OrderDetails }>({});
    const [farmerStatuses, setFarmerStatuses] = useState<{ [key: number]: FarmerStatuses }>({});
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingOrderDetails, setLoadingOrderDetails] = useState<Set<number>>(new Set());
    const [animations, setAnimations] = useState<{ [key: number]: Animated.Value }>({});

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }
        fetchOrders();
    }, [user]);

    const fetchOrders = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrders(response.data);
        } catch (error: any) {
            console.error('Error fetching orders:', error);
            if (error.response?.status === 401) {
                router.replace('/login');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchOrderDetails = async (orderId: number) => {
        if (orderDetails[orderId] || loadingOrderDetails.has(orderId)) {
            return;
        }

        setLoadingOrderDetails(prev => new Set(prev).add(orderId));

        try {
            const token = await AsyncStorage.getItem('token');

            // Fetch order details
            const orderResponse = await api.get(`/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrderDetails(prev => ({
                ...prev,
                [orderId]: orderResponse.data
            }));

            // Fetch farmer statuses for this order
            try {
                const statusResponse = await api.get(`/notification/order/${orderId}/farmer-statuses`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setFarmerStatuses(prev => ({
                    ...prev,
                    [orderId]: statusResponse.data.farmer_statuses
                }));
            } catch (statusError) {
                console.error('Error fetching farmer statuses:', statusError);
            }

        } catch (error: any) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingOrderDetails(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const getAnimationValue = (orderId: number) => {
        if (!animations[orderId]) {
            const newAnimValue = new Animated.Value(0);
            setAnimations(prev => ({
                ...prev,
                [orderId]: newAnimValue
            }));
            return newAnimValue;
        }
        return animations[orderId];
    };

    const toggleOrderExpansion = (orderId: number) => {
        const newExpanded = new Set(expandedOrders);
        const animationValue = getAnimationValue(orderId);

        if (newExpanded.has(orderId)) {
            // Collapse
            Animated.timing(animationValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                newExpanded.delete(orderId);
                setExpandedOrders(new Set(newExpanded));
            });
        } else {
            // Expand
            newExpanded.add(orderId);
            setExpandedOrders(new Set(newExpanded));
            fetchOrderDetails(orderId);

            Animated.timing(animationValue, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    };

    const getStatusColor = (status: OrderStatus): string => {
        switch (status) {
            case 'confirmed':
                return '#3b82f6'; // blue
            case 'processing':
                return '#f59e0b'; // amber
            case 'out_for_delivery':
                return '#8b5cf6'; // purple
            case 'delivered':
                return '#10b981'; // green
            case 'cancelled':
                return '#ef4444'; // red
            default:
                return '#6b7280'; // gray
        }
    };

    const getStatusText = (status: OrderStatus): string => {
        switch (status) {
            case 'confirmed':
                return 'confirmed';
            case 'processing':
                return 'processing';
            case 'out_for_delivery':
                return 'out for delivery';
            case 'delivered':
                return 'delivered';
            case 'cancelled':
                return 'cancelled';
            default:
                return status;
        }
    };

    const formatPrice = (price: number | string | undefined): string => {
        const numPrice = Number(price) || 0;
        return numPrice.toFixed(2);
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderOrderItem = (item: OrderItem) => {
        const productImage = getProductImage(item.item_name || '');

        return (
            <View key={item.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0">
                {/* Product Image */}
                <View
                    className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: getProductBackgroundColor(item.item_name.toLowerCase() || '') }}
                >
                    <Image
                        source={productImage}
                        style={{
                            width: 28,
                            height: 28,
                            resizeMode: 'contain',
                        }}
                    />
                </View>

                {/* Product Info */}
                <View className="flex-1">
                    <Text className="text-sm font-medium text-black">
                        {item.item_name.toLowerCase() || 'unknown product'}
                    </Text>
                    <Text className="text-xs text-gray-600">
                        {item.quantity} {item.unit} × rs {formatPrice(item.unit_price)}
                    </Text>
                </View>

                {/* Total Price */}
                <Text className="text-sm font-semibold text-black">
                    rs {formatPrice(item.total_price)}
                </Text>
            </View>
        );
    };

    // Group items by farmer for display
    const groupItemsByFarmer = (items: OrderItem[], orderId: number) => {
        const grouped: { [key: number]: { farmer_id: number; items: OrderItem[]; total: number } } = {};

        items.forEach(item => {
            if (!grouped[item.farmer_id]) {
                grouped[item.farmer_id] = {
                    farmer_id: item.farmer_id,
                    items: [],
                    total: 0
                };
            }
            grouped[item.farmer_id].items.push(item);
            grouped[item.farmer_id].total += Number(item.total_price);
        });

        return Object.values(grouped).map(group => {
            const farmerStatus = farmerStatuses[orderId]?.[group.farmer_id];
            return {
                ...group,
                farmer_name: farmerStatus?.farmer_name || 'Unknown Farmer',
                farmer_district: farmerStatus?.farmer_district || 'Unknown District',
                status: farmerStatus?.status || 'confirmed'
            };
        });
    };

    // Helper function to determine if order has multiple farmers
    const getOrderType = (order: Order) => {
        const details = orderDetails[order.id];
        if (!details) return { isMultiFarmer: false, farmerCount: order.farmer_count || 1 };

        const farmerIds = new Set(details.items.map(item => item.farmer_id));
        return {
            isMultiFarmer: farmerIds.size > 1,
            farmerCount: farmerIds.size
        };
    };

    // Get the single farmer's status for single-farmer orders
    const getSingleFarmerStatus = (order: Order): OrderStatus => {
        const details = orderDetails[order.id];
        if (!details) return order.status;

        const farmerIds = new Set(details.items.map(item => item.farmer_id));
        if (farmerIds.size === 1) {
            const farmerId = Array.from(farmerIds)[0];
            const farmerStatus = farmerStatuses[order.id]?.[farmerId];
            return (farmerStatus?.status as OrderStatus) || 'confirmed';
        }
        return order.status;
    };

    const renderOrder = (order: Order) => {
        const isExpanded = expandedOrders.has(order.id);
        const details = orderDetails[order.id];
        const isLoadingDetails = loadingOrderDetails.has(order.id);
        const animationValue = getAnimationValue(order.id);
        const { isMultiFarmer, farmerCount } = getOrderType(order);
        const displayStatus = isMultiFarmer ? order.status : getSingleFarmerStatus(order);

        return (
            <View key={order.id} className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-200">
                {/* Order Header - Clickable */}
                <TouchableOpacity
                    onPress={() => toggleOrderExpansion(order.id)}
                    className="p-4"
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-black mb-1">
                                #{order.order_number}
                            </Text>
                            <Text className="text-sm text-gray-600">
                                {formatDate(order.created_at)}
                            </Text>
                        </View>

                        <View className="items-end">
                            {/* Smart Status Display */}
                            {farmerCount > 1 ? (
                                // Multi-farmer: Show "Expand" text
                                <View className="px-3 py-1 rounded-full mb-1 bg-gray-100">
                                    <View className="flex-row items-center">
                                        <Text className="text-xs font-medium text-gray-500 mr-1">
                                            expand
                                        </Text>
                                        <Ionicons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={12}
                                            color="#6b7280"
                                        />
                                    </View>
                                </View>
                            ) : (
                                // Single farmer: Show farmer's actual status
                                <View
                                    className="px-3 py-1 rounded-full mb-1"
                                    style={{ backgroundColor: getStatusColor(displayStatus) + '20' }}
                                >
                                    <Text
                                        className="text-xs font-medium capitalize"
                                        style={{ color: getStatusColor(displayStatus) }}
                                    >
                                        {getStatusText(displayStatus)}
                                    </Text>
                                </View>
                            )}

                            <Text className="text-lg font-bold text-black">
                                rs {formatPrice(order.final_amount)}
                            </Text>
                        </View>
                    </View>

                    {/* Order Summary Info */}
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-600">
                            {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                        </Text>
                        <Text className="text-sm text-gray-600">
                            {farmerCount} farmer{farmerCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Animated Expanded Order Details */}
                {isExpanded && (
                    <Animated.View
                        style={{
                            maxHeight: animationValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 1500],
                            }),
                            opacity: animationValue,
                        }}
                        className="border-t border-gray-100 overflow-hidden"
                    >
                        {isLoadingDetails ? (
                            <View className="p-4 items-center">
                                <ActivityIndicator size="small" color="#4CAF50" />
                                <Text className="text-gray-600 mt-2 text-sm">loading order details...</Text>
                            </View>
                        ) : details ? (
                            <View className="p-4">
                                {/* Delivery Address */}
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">delivery address</Text>
                                    <Text className="text-sm text-gray-600">{details.delivery_address}</Text>
                                    {details.delivery_notes && (
                                        <Text className="text-sm text-gray-500 mt-1">
                                            note: {details.delivery_notes}
                                        </Text>
                                    )}
                                </View>

                                {/* Items grouped by farmer with smart status display */}
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-3">
                                        {isMultiFarmer ? 'order items by farmer' : 'order items'}
                                    </Text>

                                    {groupItemsByFarmer(details.items, order.id).map((farmerGroup, index) => (
                                        <View key={farmerGroup.farmer_id} className="mb-4 last:mb-0">
                                            {/* Farmer Header with Smart Status */}
                                            <View className="bg-gray-50 rounded-lg p-3 mb-2">
                                                <View className="flex-row items-center justify-between mb-2">
                                                    <View className="flex-1">
                                                        <Text className="text-sm font-medium text-black">
                                                            {farmerGroup.farmer_name.toLowerCase()}
                                                        </Text>
                                                        <View className="flex-row items-center mt-1">
                                                            <Ionicons name="location-outline" size={12} color="#666666" />
                                                            <Text className="text-xs text-gray-600 ml-1">
                                                                {farmerGroup.farmer_district.toLowerCase()}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {/* Status only for multi-farmer orders */}
                                                    <View className="items-end">
                                                        {isMultiFarmer && (
                                                            <View
                                                                className="px-2 py-1 rounded-full mb-1"
                                                                style={{ backgroundColor: getStatusColor(farmerGroup.status as OrderStatus) + '20' }}
                                                            >
                                                                <Text
                                                                    className="text-xs font-medium"
                                                                    style={{ color: getStatusColor(farmerGroup.status as OrderStatus) }}
                                                                >
                                                                    {getStatusText(farmerGroup.status as OrderStatus)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        <Text className="text-xs text-gray-600">
                                                            rs {formatPrice(farmerGroup.total)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Farmer's Items */}
                                            <View className="bg-white border border-gray-100 rounded-lg p-3">
                                                {farmerGroup.items.map(renderOrderItem)}
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {/* Order Total Breakdown */}
                                <View className="bg-gray-50 rounded-lg p-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">subtotal</Text>
                                        <Text className="text-sm text-black">rs {formatPrice(details.total_amount)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">delivery fee</Text>
                                        <Text className="text-sm text-black">rs {formatPrice(details.delivery_fee)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-200">
                                        <Text className="text-base font-semibold text-black">total</Text>
                                        <Text className="text-base font-bold text-black">rs {formatPrice(details.final_amount)}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View className="p-4">
                                <Text className="text-gray-500 text-sm text-center">failed to load order details</Text>
                            </View>
                        )}
                    </Animated.View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="my orders"
                    showBackButton={true}
                    showNotificationButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading orders...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="my orders"
                showBackButton={true}
                showNotificationButton={true}
            />

            {orders.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        no orders yet
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        when you place your first order, it will appear here
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/(auth)/customer/products')}
                        className="bg-action-green px-8 py-4 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white font-medium text-lg">
                            browse products
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-5 pt-6"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#4CAF50']}
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {orders.map(renderOrder)}
                </ScrollView>
            )}
        </View>
    );
}


//////////////////////////////////////


// app/(auth)/customer/cart.tsx - Complete Version with Fixed AI Recipe Slider
import { useEffect, useState, useContext, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import RecipeSuggestions from '@/components/customer/RecipeSuggestions';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { getProductBackgroundColor } from '@/utils/products';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

interface CartItem {
    id: number;
    farmer_product_id: number;
    unit_price_id: number;
    quantity: number;
    unit_price_snapshot: number;
    total_price: number;
    product_name: string;
    unit_name: string;
    farmer_name: string;
}

interface FarmerGroup {
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    items: CartItem[];
    subtotal: number;
}

interface Cart {
    id: number | null;
    farmer_groups: FarmerGroup[];
    total_amount: number;
    total_items: number;
    created_at: string | null;
    updated_at: string | null;
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

export default function CartScreen() {
    const { user } = useContext(AuthContext);
    const { refreshCartCount } = useCart();
    const router = useRouter();
    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingItem, setUpdatingItem] = useState<number | null>(null);
    const [processingCheckout, setProcessingCheckout] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons?: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons: buttons || [{ text: 'OK', onPress: hideAlert, style: 'cancel' }]
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    const fetchCart = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cartData = response.data;

            const processedCart: Cart = {
                id: cartData.id || null,
                farmer_groups: cartData.farmer_groups || [],
                total_amount: Number(cartData.total_amount) || 0,
                total_items: Number(cartData.total_items) || 0,
                created_at: cartData.created_at || null,
                updated_at: cartData.updated_at || null
            };

            processedCart.farmer_groups = processedCart.farmer_groups.map(group => ({
                ...group,
                subtotal: Number(group.subtotal) || 0,
                items: group.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    unit_price_snapshot: Number(item.unit_price_snapshot) || 0,
                    total_price: Number(item.total_price) || 0
                }))
            }));

            setCart(processedCart);
            await refreshCartCount();

        } catch (error: any) {
            console.error('Error fetching cart:', error);
            if (error.response?.status === 401) {
                router.replace('/login');
            } else {
                setCart({
                    id: null,
                    farmer_groups: [],
                    total_amount: 0,
                    total_items: 0,
                    created_at: null,
                    updated_at: null
                });
            }
            await refreshCartCount();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router, refreshCartCount]);

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }
        fetchCart();
    }, [user, fetchCart]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCart();
    };

    const updateItemQuantity = async (itemId: number, newQuantity: number) => {
        try {
            setUpdatingItem(itemId);
            const token = await AsyncStorage.getItem('token');

            await api.put(`/orders/cart/items/${itemId}`,
                { quantity: newQuantity },
                { headers: { Authorization: `Bearer ${token}` }}
            );

            await fetchCart();

            showAlert(
                'success',
                'Updated',
                'Item quantity updated successfully'
            );
        } catch (error: any) {
            console.error('Error updating item:', error);
            showAlert(
                'error',
                'Update Failed',
                error.response?.data?.detail || 'Failed to update item quantity'
            );
        } finally {
            setUpdatingItem(null);
        }
    };

    const removeItem = async (itemId: number) => {
        showAlert(
            'warning',
            'Remove Item',
            'Are you sure you want to remove this item from your cart?',
            [
                { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            await api.delete(`/orders/cart/items/${itemId}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            await fetchCart();

                            showAlert(
                                'success',
                                'Removed',
                                'Item removed from cart'
                            );
                        } catch (error: any) {
                            console.error('Error removing item:', error);
                            showAlert(
                                'error',
                                'Remove Failed',
                                'Failed to remove item from cart'
                            );
                        }
                    }
                }
            ]
        );
    };

    const proceedToCheckout = () => {
        if (!cart || cart.farmer_groups.length === 0) {
            showAlert(
                'info',
                'Empty Cart',
                'Your cart is empty. Add some items before checkout.'
            );
            return;
        }

        router.push('/(auth)/customer/checkout');
    };

    // Handle when AI adds ingredients to cart
    const handleIngredientsAdded = useCallback(async () => {
        // Refresh cart to show new items
        await fetchCart();
    }, [fetchCart]);

    const getQuantityStep = (userRole: string): number => {
        return userRole === 'business' ? 25 : 1;
    };

    const adjustQuantity = (item: CartItem, delta: number) => {
        const quantityStep = getQuantityStep(user?.role || 'individual');
        const newQuantity = item.quantity + (delta * quantityStep);

        if (newQuantity > 0) {
            updateItemQuantity(item.id, newQuantity);
        }
    };

    const formatPrice = (price: number | string | undefined): string => {
        const numPrice = Number(price) || 0;
        return numPrice.toFixed(2);
    };

    // Convert cart items to format needed for AI
    const getCartItemsForAI = (): Array<{product_name: string, quantity: number, unit_name: string}> => {
        if (!cart) return [];

        const allItems: Array<{product_name: string, quantity: number, unit_name: string}> = [];

        cart.farmer_groups.forEach(group => {
            group.items.forEach(item => {
                allItems.push({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_name: item.unit_name
                });
            });
        });

        return allItems;
    };

    const renderCartItem = (item: CartItem) => {
        const productImage = getProductImage(item.product_name || '');

        return (
            <View key={item.id} className="p-4 border-b border-gray-100 last:border-b-0">
                <View className="flex-row items-center">
                    {/* Product Image */}
                    <View
                        className="w-16 h-16 rounded-lg items-center justify-center mr-3"
                        style={{ backgroundColor: getProductBackgroundColor(item.product_name.toLowerCase() || '') }}
                    >
                        <Image
                            source={productImage}
                            style={{
                                width: 32,
                                height: 32,
                                resizeMode: 'contain',
                            }}
                        />
                    </View>

                    {/* Product Info */}
                    <View className="flex-1">
                        <Text className="text-base font-medium text-black mb-1">
                            {item.product_name.toLowerCase() || 'unknown'}
                        </Text>
                    </View>

                    {/* Quantity Controls and Price per Unit */}
                    <View className="items-center mr-4">
                        <View className="flex-row items-center bg-gray-100 rounded-lg mb-1">
                            <TouchableOpacity
                                onPress={() => adjustQuantity(item, -1)}
                                className="w-8 h-10 bg-background rounded items-center justify-center"
                                activeOpacity={0.7}
                                disabled={updatingItem === item.id}
                            >
                                <Ionicons
                                    name="remove"
                                    size={14}
                                    color={updatingItem === item.id ? "#ccc" : "#000"}
                                />
                            </TouchableOpacity>

                            <View className="px-3 py-2 min-w-[40]">
                                {updatingItem === item.id ? (
                                    <ActivityIndicator size="small" color="#4CAF50" />
                                ) : (
                                    <Text className="text-base font-medium text-black text-center">
                                        {Number(item.quantity) || 0}
                                    </Text>
                                )}
                            </View>

                            <TouchableOpacity
                                onPress={() => adjustQuantity(item, 1)}
                                className="w-8 h-10 bg-background rounded items-center justify-center"
                                activeOpacity={0.7}
                                disabled={updatingItem === item.id}
                            >
                                <Ionicons
                                    name="add"
                                    size={14}
                                    color={updatingItem === item.id ? "#ccc" : "#000"}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text className="text-xs text-gray-500 text-center">
                            rs {formatPrice(item.unit_price_snapshot)} per {item.unit_name || 'unit'}
                        </Text>
                    </View>

                    {/* Price */}
                    <Text className="text-xs font-semibold text-black mr-2">
                        rs {formatPrice(item.total_price)}
                    </Text>

                    {/* Remove Button */}
                    <TouchableOpacity
                        onPress={() => removeItem(item.id)}
                        className="p-2"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderFarmerGroup = (group: FarmerGroup, index: number) => (
        <View key={group.farmer_id} className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-200">
            {/* Farmer Header */}
            <View className="bg-gray-100 px-4 py-3 flex-row items-center justify-between">
                <View className="flex-1">
                    <Text className="text-lg font-semibold text-black mb-1">
                        {group.farmer_name || 'unknown farmer'}
                    </Text>
                    <View className="flex-row items-center">
                        <Ionicons name="location-outline" size={14} color="#666666" />
                        <Text className="text-sm text-gray-600 ml-1">
                            {group.farmer_district || 'unknown district'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => router.push(`/(auth)/customer/farmers/${group.farmer_id}`)}
                    className="p-2"
                    activeOpacity={0.7}
                >
                    <Ionicons name="storefront-outline" size={20} color="#666666" />
                </TouchableOpacity>
            </View>

            {/* Items */}
            <View>
                {group.items.map(renderCartItem)}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="my cart"
                    showBackButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading cart...</Text>
                </View>
            </View>
        );
    }

    const isEmpty = !cart || cart.farmer_groups.length === 0;

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="my cart"
                showBackButton={true}
                showHomeButton={true}
                showOrdersButton={true}
            />

            {isEmpty ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="basket-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        your cart is empty
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        browse our fresh products and add items to your cart
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/(auth)/customer/products')}
                        className="bg-action-green px-8 py-4 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white font-medium text-lg">
                            browse products
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-5 pt-6"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#4CAF50']}
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {/* Business pricing indicator */}
                    {user?.role === 'business' && (
                        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <View className="flex-row items-center">
                                <Ionicons name="business-outline" size={20} color="#2563eb" />
                                <Text className="text-blue-700 text-sm font-medium ml-2">
                                    business bulk pricing applied
                                </Text>
                            </View>
                            <Text className="text-blue-600 text-xs mt-1">
                                you&#39;re getting special wholesale prices for bulk orders
                            </Text>
                        </View>
                    )}

                    {/* Farmer Groups */}
                    {cart.farmer_groups.map(renderFarmerGroup)}

                    {/* AI Recipe Suggestions - Only for individual customers */}
                    <RecipeSuggestions
                        cartItems={getCartItemsForAI()}
                        customerType={user?.role as 'individual' | 'business'}
                        onIngredientsAdded={handleIngredientsAdded}
                        onAlert={showAlert}
                    />

                    {/* Bottom Checkout Section - Reverted to original */}
                    <View className="bg-white rounded-xl p-2 mt-4 mb-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-sm text-gray-600">total amount</Text>
                                <Text className="text-2xl font-bold text-black">
                                    rs {formatPrice(cart.total_amount)}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-sm text-gray-600">
                                    {cart.total_items} item{cart.total_items !== 1 ? 's' : ''}
                                </Text>
                                <Text className="text-sm text-gray-600">
                                    {cart.farmer_groups.length} farmer{cart.farmer_groups.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={proceedToCheckout}
                            className="bg-background py-4 px-6 rounded-xl"
                            activeOpacity={0.7}
                            disabled={processingCheckout}
                        >
                            <Text className="text-center font-medium text-black text-lg">
                                {processingCheckout ? 'processing...' : 'checkout'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}

            {/* Custom Alert */}
            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}


//////////////////////////////////////


// services/ruleBasedAIService.ts - Updated to use external recipe database
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import {
    MAURITIAN_RECIPES,
    INGREDIENT_CATEGORIES,
    CUISINE_AFFINITIES,
    RecipeRule,
    RecipeIngredient
} from '@/constants/recipes';

interface CartItem {
    product_name: string;
    quantity: number;
    unit_name: string;
}

interface Recipe {
    id: string;
    name: string;
    description: string;
    prep_time: string;
    difficulty: 'easy' | 'medium' | 'hard';
    cuisine_type: 'mauritian' | 'creole' | 'indian' | 'chinese';
    ingredients: RecipeIngredient[];
    missing_ingredients: RecipeIngredient[];
    available_missing_ingredients: RecipeIngredient[];
    estimated_total_cost: number;
    instructions: string[];
    nutritional_benefits: string[];
    confidence_score: number;
}

class RuleBasedAIService {
    private recipeRules: RecipeRule[] = [];
    private ingredientCategories: Map<string, string[]> = new Map();
    private cuisineAffinities: Map<string, string[]> = new Map();

    constructor() {
        this.initializeKnowledgeBase();
    }

    /**
     * Initialize knowledge base from external recipe database
     */
    private initializeKnowledgeBase() {
        // Load recipes from external file
        this.recipeRules = MAURITIAN_RECIPES;
        this.ingredientCategories = INGREDIENT_CATEGORIES;
        this.cuisineAffinities = CUISINE_AFFINITIES;
    }

    /**
     * MAIN AI FUNCTION: Generate personalized recipe suggestions
     */
    async generatePersonalizedRecipes(
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: {
            preferredCuisine?: string[];
            dietaryRestrictions?: string[];
            skillLevel?: 'beginner' | 'intermediate' | 'advanced';
        }
    ): Promise<Recipe[]> {
        console.log('🤖 AI: Starting rule-based recipe generation...');

        const cartAnalysis = this.analyzeCartContents(cartItems);
        const candidateRecipes = this.applyRecipeRules(cartItems, cartAnalysis);
        const scoredRecipes = this.scoreAndRankRecipes(candidateRecipes, cartItems, customerType, userPreferences);
        const topRecipes = scoredRecipes.slice(0, 3);
        const processedRecipes = await Promise.all(
            topRecipes.map(recipe => this.processRecipeForMissingIngredients(recipe, cartItems, customerType))
        );

        console.log('🤖 AI: Generated', processedRecipes.length, 'personalized recipes');
        return processedRecipes;
    }

    /**
     * Analyze cart contents using classification algorithms
     */
    private analyzeCartContents(cartItems: CartItem[]) {
        const analysis = {
            vegetableCount: 0,
            fruitCount: 0,
            categories: new Set<string>(),
            dominantCategory: '',
            complexity: 'simple',
            cuisineHints: new Set<string>()
        };

        for (const item of cartItems) {
            const itemName = item.product_name.toLowerCase();

            if (this.isVegetable(itemName)) {
                analysis.vegetableCount++;
                analysis.categories.add('vegetables');
            } else if (this.isFruit(itemName)) {
                analysis.fruitCount++;
                analysis.categories.add('fruits');
            }

            this.getCuisineHints(itemName).forEach(hint =>
                analysis.cuisineHints.add(hint)
            );
        }

        analysis.dominantCategory = analysis.vegetableCount > analysis.fruitCount ? 'vegetables' : 'fruits';
        analysis.complexity = cartItems.length > 4 ? 'complex' : 'simple';

        return analysis;
    }

    /**
     * Apply recipe matching rules
     */
    private applyRecipeRules(cartItems: CartItem[], cartAnalysis: any): Recipe[] {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const matchingRecipes: Recipe[] = [];

        console.log('🔍 Cart items:', cartItemNames);

        for (const rule of this.recipeRules) {
            const matchScore = this.calculateRuleMatchScore(rule, cartItemNames);

            console.log(`🔍 Recipe: ${rule.name}, Match score: ${matchScore}`);

            if (matchScore > 0.1) {
                const recipe = this.createRecipeFromRule(rule, cartItems, matchScore);
                matchingRecipes.push(recipe);
                console.log(`✅ Added recipe: ${rule.name}`);
            }
        }

        console.log(`📝 Total matching recipes: ${matchingRecipes.length}`);
        return matchingRecipes;
    }

    /**
     * Score and rank recipes using ML-inspired algorithms
     */
    private scoreAndRankRecipes(
        recipes: Recipe[],
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): Recipe[] {
        return recipes
            .map(recipe => ({
                ...recipe,
                confidence_score: this.calculateConfidenceScore(recipe, cartItems, customerType, userPreferences)
            }))
            .sort((a, b) => b.confidence_score - a.confidence_score);
    }

    /**
     * Calculate ML-style confidence score (0-1)
     */
    private calculateConfidenceScore(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): number {
        let score = 0;
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        // Ingredient overlap score (0.4 weight)
        const ingredientOverlap = recipe.ingredients.filter(ingredient =>
            cartItemNames.some(cartItem =>
                cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
            )
        ).length;
        score += (ingredientOverlap / recipe.ingredients.length) * 0.4;

        // Customer type relevance (0.2 weight)
        if (customerType === 'business' && recipe.difficulty !== 'hard') {
            score += 0.2;
        } else if (customerType === 'individual' && recipe.difficulty === 'easy') {
            score += 0.2;
        }

        // Cuisine preference (0.2 weight)
        if (userPreferences?.preferredCuisine?.includes(recipe.cuisine_type)) {
            score += 0.2;
        }

        // Completeness bonus (0.2 weight)
        const missingCount = recipe.ingredients.filter(ing =>
            !cartItemNames.some(cartItem =>
                cartItem.includes(ing.name) || ing.name.includes(cartItem)
            )
        ).length;
        score += (1 - (missingCount / recipe.ingredients.length)) * 0.2;

        return Math.min(score, 1.0);
    }

    /**
     * Calculate rule match score using set similarity
     */
    private calculateRuleMatchScore(rule: RecipeRule, cartItemNames: string[]): number {
        const triggerMatches = rule.triggerIngredients.filter((trigger: string) =>
            cartItemNames.some(cartItem => {
                const cartItemLower = cartItem.toLowerCase();
                const triggerLower = trigger.toLowerCase();

                return cartItemLower === triggerLower ||
                    cartItemLower.includes(triggerLower) ||
                    triggerLower.includes(cartItemLower);
            })
        );

        const score = triggerMatches.length > 0 ? triggerMatches.length / rule.triggerIngredients.length : 0;
        return score > 0 ? Math.max(score, 0.5) : 0;
    }

    /**
     * Helper methods for ingredient classification
     */
    private isVegetable(itemName: string): boolean {
        const vegetables = this.ingredientCategories.get('vegetables') || [];
        return vegetables.some(veg => itemName.includes(veg) || veg.includes(itemName));
    }

    private isFruit(itemName: string): boolean {
        const fruits = this.ingredientCategories.get('fruits') || [];
        return fruits.some(fruit => itemName.includes(fruit) || fruit.includes(itemName));
    }

    private getCuisineHints(itemName: string): string[] {
        const hints: string[] = [];
        for (const [cuisine, ingredients] of this.cuisineAffinities) {
            if (ingredients.some(ing => itemName.includes(ing) || ing.includes(itemName))) {
                hints.push(cuisine);
            }
        }
        return hints;
    }

    /**
     * Create recipe from rule
     */
    private createRecipeFromRule(rule: RecipeRule, cartItems: CartItem[], matchScore: number): Recipe {
        return {
            id: `rule_${rule.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            name: rule.name,
            description: rule.description,
            prep_time: rule.prep_time,
            difficulty: rule.difficulty,
            cuisine_type: rule.cuisine_type,
            ingredients: rule.ingredients,
            missing_ingredients: [],
            available_missing_ingredients: [],
            estimated_total_cost: 0,
            instructions: rule.instructions,
            nutritional_benefits: rule.nutritional_benefits,
            confidence_score: matchScore
        };
    }

    /**
     * Process recipe to find missing ingredients and check their availability
     */
    private async processRecipeForMissingIngredients(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business'
    ): Promise<Recipe> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const missingIngredients: RecipeIngredient[] = [];

        // Find ALL missing ingredients
        for (const ingredient of recipe.ingredients) {
            const ingredientName = ingredient.name.toLowerCase();
            const isInCart = cartItemNames.some(cartItem =>
                cartItem.includes(ingredientName) || ingredientName.includes(cartItem)
            );

            if (!isInCart) {
                missingIngredients.push(ingredient);
            }
        }

        // Check availability of missing ingredients
        const availableMissingIngredients = await this.checkIngredientsAvailability(
            missingIngredients,
            customerType
        );

        const estimatedCost = await this.estimateMissingIngredientsCost(availableMissingIngredients, customerType);

        return {
            ...recipe,
            missing_ingredients: missingIngredients,
            available_missing_ingredients: availableMissingIngredients,
            estimated_total_cost: estimatedCost
        };
    }

    /**
     * Check which missing ingredients are actually available from farmers
     */
    private async checkIngredientsAvailability(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<RecipeIngredient[]> {
        const availableIngredients: RecipeIngredient[] = [];

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return availableIngredients;

            for (const ingredient of missingIngredients) {
                try {
                    console.log(`🔍 Checking availability for: ${ingredient.name}`);

                    const searchResponse = await api.get(`/browse/products/search`, {
                        params: { search: ingredient.name, limit: 10 },
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const products = searchResponse.data.items || [];
                    console.log(`📦 Found ${products.length} products for ${ingredient.name}`);

                    // Check if any farmer has this ingredient available for this customer type
                    let hasAvailableProduct = false;
                    let productDetails = [];

                    for (const product of products) {
                        const availableUnitPrices = product.unit_prices.filter((up: any) =>
                            up.customer_type === customerType && up.quantity_available > 0
                        );

                        if (availableUnitPrices.length > 0) {
                            hasAvailableProduct = true;
                            productDetails.push({
                                name: product.item,
                                farmer: product.farmer_name,
                                prices: availableUnitPrices.length
                            });
                        }
                    }

                    console.log(`✅ ${ingredient.name} available: ${hasAvailableProduct}`, productDetails);

                    if (hasAvailableProduct) {
                        availableIngredients.push(ingredient);
                    }
                } catch (error) {
                    console.error(`❌ Error checking availability for ${ingredient.name}:`, error);
                    // Continue to next ingredient if one fails
                }
            }
        } catch (error) {
            console.error('❌ Error checking ingredients availability:', error);
        }

        console.log(`📋 Available ingredients summary:`, availableIngredients.map(ing => ing.name));
        return availableIngredients;
    }

    /**
     * Estimate missing ingredients cost
     */
    private async estimateMissingIngredientsCost(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<number> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return 0;

            let totalCost = 0;

            for (const ingredient of missingIngredients) {
                const searchResponse = await api.get(`/browse/products/search`, {
                    params: { search: ingredient.name, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                const products = searchResponse.data.items || [];

                const prices = products
                    .flatMap((product: any) =>
                        product.unit_prices
                            .filter((up: any) => up.customer_type === customerType)
                            .map((up: any) => up.price_per_unit)
                    )
                    .sort((a: number, b: number) => a - b);

                if (prices.length > 0) {
                    const lowestPrices = prices.slice(0, 3);
                    const medianPrice = lowestPrices[Math.floor(lowestPrices.length / 2)];
                    // Estimate cost for 1 unit
                    totalCost += medianPrice * 1;
                }
            }

            return totalCost;
        } catch (error) {
            console.error('Error estimating costs:', error);
            return 0;
        }
    }

    /**
     * Find best product match for an ingredient
     */
    async findBestProductMatch(ingredientName: string, customerType: 'individual' | 'business'): Promise<any> {
        try {
            console.log(`🔍 Finding best match for: ${ingredientName} (${customerType})`);

            const token = await AsyncStorage.getItem('token');
            const searchResponse = await api.get(`/browse/products/search`, {
                params: { search: ingredientName, limit: 20 },
                headers: { Authorization: `Bearer ${token}` }
            });

            const products = searchResponse.data.items || [];
            console.log(`📦 Found ${products.length} products for ${ingredientName}`);

            let bestMatch = null;
            let lowestPrice = Infinity;

            for (const product of products) {
                console.log(`🏪 Checking product: ${product.item} from ${product.farmer_name}`);

                const suitablePrices = product.unit_prices.filter(
                    (up: any) => up.customer_type === customerType && up.quantity_available > 0
                );

                console.log(`💰 Found ${suitablePrices.length} suitable prices for ${product.item}`);

                for (const unitPrice of suitablePrices) {
                    console.log(`   Price: rs ${unitPrice.price_per_unit}, Available: ${unitPrice.quantity_available}, Min order: ${unitPrice.minimum_order}`);

                    if (unitPrice.price_per_unit < lowestPrice) {
                        lowestPrice = unitPrice.price_per_unit;
                        bestMatch = {
                            farmer_product_id: product.id,
                            unit_price_id: unitPrice.id,
                            product_name: product.item,
                            farmer_name: product.farmer_name,
                            price_per_unit: unitPrice.price_per_unit,
                            minimum_order: unitPrice.minimum_order,
                            unit: unitPrice.unit
                        };
                        console.log(`✅ New best match: ${product.item} from ${product.farmer_name} at rs ${unitPrice.price_per_unit}`);
                    }
                }
            }

            if (bestMatch) {
                console.log(`🎯 Final best match for ${ingredientName}:`, bestMatch);
            } else {
                console.log(`❌ No suitable match found for ${ingredientName}`);
            }

            return bestMatch;
        } catch (error) {
            console.error(`❌ Error finding product match for ${ingredientName}:`, error);
            return null;
        }
    }

    /**
     * Add missing ingredients to cart
     */
    async addMissingIngredientsToCart(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<{success: boolean, addedItems: any[], errors: string[]}> {
        try {
            console.log(`🛒 Adding ${missingIngredients.length} missing ingredients to cart for ${customerType}`);

            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('No authentication token');

            const addedItems: any[] = [];
            const errors: string[] = [];

            for (const ingredient of missingIngredients) {
                try {
                    console.log(`🔄 Processing ingredient: ${ingredient.name}`);

                    const bestMatch = await this.findBestProductMatch(ingredient.name, customerType);

                    if (bestMatch) {
                        // Always add just 1 unit or minimum order, whichever is higher
                        const finalQuantity = Math.max(1, bestMatch.minimum_order);

                        console.log(`📝 Adding to cart: ${finalQuantity} ${bestMatch.unit} of ${bestMatch.product_name}`);

                        const cartResponse = await api.post('/orders/cart/items', {
                            farmer_product_id: bestMatch.farmer_product_id,
                            unit_price_id: bestMatch.unit_price_id,
                            quantity: finalQuantity
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        console.log(`✅ Successfully added ${ingredient.name} to cart`);

                        addedItems.push({
                            name: ingredient.name,
                            product: bestMatch.product_name,
                            farmer: bestMatch.farmer_name,
                            price: bestMatch.price_per_unit,
                            quantity: finalQuantity,
                            unit: bestMatch.unit
                        });
                    } else {
                        console.log(`❌ No match found for ${ingredient.name}`);
                        errors.push(`Could not find ${ingredient.name} from any farmer`);
                    }
                } catch (itemError: any) {
                    console.error(`❌ Failed to add ${ingredient.name}:`, itemError);
                    console.error('Error details:', itemError.response?.data);
                    errors.push(`Failed to add ${ingredient.name}: ${itemError.response?.data?.detail || itemError.message}`);
                }
            }

            console.log(`📊 Cart addition summary: ${addedItems.length} added, ${errors.length} errors`);
            if (errors.length > 0) {
                console.log(`❌ Errors:`, errors);
            }

            return { success: addedItems.length > 0, addedItems, errors };
        } catch (error: any) {
            console.error('❌ Fatal error adding ingredients to cart:', error);
            return { success: false, addedItems: [], errors: ['Failed to add ingredients to cart: ' + error.message] };
        }
    }
}

export default new RuleBasedAIService();