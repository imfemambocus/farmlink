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


// app/(auth)/farmer/homepage.tsx - Horizontal Slider Picker Version
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
    Dimensions,
    Modal,
    Animated
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
type PickerType = 'sales' | 'revenue' | null;

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
    const [loadingSales, setLoadingSales] = useState(false);
    const [loadingRevenue, setLoadingRevenue] = useState(false);
    const [activePicker, setActivePicker] = useState<PickerType>(null);
    const [slideAnim] = useState(new Animated.Value(300)); // Start below screen
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
        { key: 'this_week' as TimePeriod, label: 'this week', short: 'week' },
        { key: 'this_month' as TimePeriod, label: 'this month', short: 'month' },
        { key: 'this_year' as TimePeriod, label: 'this year', short: 'year' },
        { key: 'all_time' as TimePeriod, label: 'all time', short: 'all' },
        { key: 'january' as TimePeriod, label: 'january', short: 'jan' },
        { key: 'february' as TimePeriod, label: 'february', short: 'feb' },
        { key: 'march' as TimePeriod, label: 'march', short: 'mar' },
        { key: 'april' as TimePeriod, label: 'april', short: 'apr' },
        { key: 'may' as TimePeriod, label: 'may', short: 'may' },
        { key: 'june' as TimePeriod, label: 'june', short: 'jun' },
        { key: 'july' as TimePeriod, label: 'july', short: 'jul' },
        { key: 'august' as TimePeriod, label: 'august', short: 'aug' },
        { key: 'september' as TimePeriod, label: 'september', short: 'sep' },
        { key: 'october' as TimePeriod, label: 'october', short: 'oct' },
        { key: 'november' as TimePeriod, label: 'november', short: 'nov' },
        { key: 'december' as TimePeriod, label: 'december', short: 'dec' },
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

    // Slider Picker Functions
    const showPicker = (type: PickerType) => {
        setActivePicker(type);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10
        }).start();
    };

    const hidePicker = () => {
        setActivePicker(null);
        Animated.spring(slideAnim, {
            toValue: 300,
            useNativeDriver: true,
            tension: 100,
            friction: 8
        }).start();
    };

    const selectPeriod = (period: TimePeriod) => {
        if (activePicker === 'sales') {
            setSalesTimePeriod(period);
        } else if (activePicker === 'revenue') {
            setRevenueTimePeriod(period);
        }
        hidePicker();
    };

    const getCurrentPeriod = (): TimePeriod => {
        return activePicker === 'sales' ? salesTimePeriod : revenueTimePeriod;
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
        return option ? option.label.toLowerCase() : 'this month';
    };

    const getRevenueTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === revenueTimePeriod);
        return option ? option.label.toLowerCase() : 'this month';
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

                {/* Statistics Cards - WITH HORIZONTAL SLIDER PICKER */}
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

                    {/* Bottom Row with Horizontal Slider Triggers */}
                    <View className="flex-row gap-2">
                        {/* Sales Card */}
                        <View className="flex-1">
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
                                    {/* Header with 3-dots Button */}
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-sm font-medium text-gray-700">total sales</Text>
                                        <TouchableOpacity
                                            onPress={() => showPicker('sales')}
                                            className="p-1"
                                            activeOpacity={0.7}
                                            disabled={loadingSales}
                                        >
                                            <Ionicons
                                                name="ellipsis-horizontal"
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
                        </View>

                        {/* Revenue Card */}
                        <View className="flex-1">
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
                                    {/* Header with 3-dots Button */}
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-sm font-medium text-gray-700">revenue</Text>
                                        <TouchableOpacity
                                            onPress={() => showPicker('revenue')}
                                            className="p-1"
                                            activeOpacity={0.7}
                                            disabled={loadingRevenue}
                                        >
                                            <Ionicons
                                                name="ellipsis-horizontal"
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

            {/* Horizontal Slider Picker Modal */}
            <Modal
                visible={activePicker !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={hidePicker}
            >
                <TouchableWithoutFeedback onPress={hidePicker}>
                    <View
                        className="flex-1 justify-end"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                    >
                        <Animated.View
                            className="bg-white rounded-t-3xl"
                            style={{
                                transform: [{ translateY: slideAnim }],
                                paddingBottom: 40,
                                paddingTop: 20
                            }}
                        >
                            {/* Handle Bar */}
                            <View className="items-center mb-4">
                                <View
                                    className="bg-gray-300 rounded-full"
                                    style={{ width: 40, height: 4 }}
                                />
                            </View>

                            {/* Title */}
                            <View className="px-6 mb-6">
                                <Text className="text-lg font-semibold text-black text-center">
                                    select {activePicker === 'sales' ? 'sales' : 'revenue'} period
                                </Text>
                            </View>

                            {/* Horizontal Options Slider */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 8
                                }}
                                className="flex-grow-0"
                            >
                                {timePeriodOptions.map((option, index) => {
                                    const isSelected = option.key === getCurrentPeriod();
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            onPress={() => selectPeriod(option.key)}
                                            className={`px-6 py-3 rounded-full mr-3 ${
                                                isSelected
                                                    ? 'bg-background'
                                                    : 'bg-gray-100'
                                            }`}
                                            activeOpacity={0.7}
                                            style={{
                                                minWidth: 80,
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Text className={`text-sm font-medium ${
                                                isSelected ? 'text-black' : 'text-gray-600'
                                            }`}>
                                                {option.short}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Close Button */}
                            <View className="px-6 mt-6">
                                <TouchableOpacity
                                    onPress={hidePicker}
                                    className="bg-gray-200 py-4 rounded-xl"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-center font-medium text-gray-700">
                                        close
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

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


// Updated app/(auth)/customer/homepage.tsx with Voice FloatingActionButton
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
import FloatingActionButton from '@/components/ui/FloatingActionButton'; // Updated with voice
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

    // Voice input handlers
    const handleVoiceResult = (data: any) => {
        if (data?.products) {
            // Navigate to products page with search results
            router.push({
                pathname: '/(auth)/customer/products',
                params: { searchTerm: data.searchTerm || '' }
            });
        }
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

            {/* Voice Command Floating Action Button */}
            <FloatingActionButton
                showVoice={true}
                onResult={handleVoiceResult}
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


// services/ruleBasedAIService.ts - Optimized with caching and reduced API calls
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

interface CachedProductSearch {
    products: any[];
    timestamp: number;
    customerType: string;
}

class RuleBasedAIService {
    private recipeRules: RecipeRule[] = [];
    private ingredientCategories: Map<string, string[]> = new Map();
    private cuisineAffinities: Map<string, string[]> = new Map();

    // CACHING: Reduce redundant API calls
    private productSearchCache: Map<string, CachedProductSearch> = new Map();
    private lastCartHash: string = '';
    private lastRecipesResult: Recipe[] = [];
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly CART_DEBOUNCE_TIME = 2000; // 2 seconds
    private cartUpdateTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.initializeKnowledgeBase();
    }

    private initializeKnowledgeBase() {
        this.recipeRules = MAURITIAN_RECIPES;
        this.ingredientCategories = INGREDIENT_CATEGORIES;
        this.cuisineAffinities = CUISINE_AFFINITIES;
    }

    /**
     * OPTIMIZED: Generate recipes with caching and debouncing
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
        console.log('🤖 AI: Starting optimized recipe generation...');

        // OPTIMIZATION 1: Create cart hash to detect changes
        const cartHash = this.createCartHash(cartItems, customerType);

        // OPTIMIZATION 2: Return cached result if cart hasn't changed
        if (cartHash === this.lastCartHash && this.lastRecipesResult.length > 0) {
            console.log('🎯 AI: Returning cached recipes (cart unchanged)');
            return this.lastRecipesResult;
        }

        // OPTIMIZATION 3: Debounce rapid cart changes
        if (this.cartUpdateTimer) {
            clearTimeout(this.cartUpdateTimer);
        }

        return new Promise((resolve) => {
            this.cartUpdateTimer = setTimeout(async () => {
                try {
                    const cartAnalysis = this.analyzeCartContents(cartItems);
                    const candidateRecipes = this.applyRecipeRules(cartItems, cartAnalysis);
                    const scoredRecipes = this.scoreAndRankRecipes(candidateRecipes, cartItems, customerType, userPreferences);
                    const topRecipes = scoredRecipes.slice(0, 3);

                    // OPTIMIZATION 4: Batch process missing ingredients
                    const processedRecipes = await this.batchProcessMissingIngredients(topRecipes, cartItems, customerType);

                    // Cache results
                    this.lastCartHash = cartHash;
                    this.lastRecipesResult = processedRecipes;

                    console.log('🤖 AI: Generated', processedRecipes.length, 'optimized recipes');
                    resolve(processedRecipes);
                } catch (error) {
                    console.error('🤖 AI: Error generating recipes:', error);
                    resolve(this.lastRecipesResult || []);
                }
            }, this.CART_DEBOUNCE_TIME);
        });
    }

    /**
     * OPTIMIZATION: Create hash of cart contents to detect changes
     */
    private createCartHash(cartItems: CartItem[], customerType: string): string {
        const cartString = cartItems
            .map(item => `${item.product_name}:${item.quantity}:${item.unit_name}`)
            .sort()
            .join('|') + `|${customerType}`;

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < cartString.length; i++) {
            const char = cartString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * OPTIMIZATION: Batch process missing ingredients to reduce API calls
     */
    private async batchProcessMissingIngredients(
        recipes: Recipe[],
        cartItems: CartItem[],
        customerType: 'individual' | 'business'
    ): Promise<Recipe[]> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        // STEP 1: Collect ALL unique missing ingredients across all recipes
        const allMissingIngredients = new Set<string>();
        const recipeIngredientMap = new Map<string, { recipe: Recipe, ingredients: RecipeIngredient[] }>();

        recipes.forEach(recipe => {
            const missingIngredients: RecipeIngredient[] = [];

            recipe.ingredients.forEach(ingredient => {
                const ingredientName = ingredient.name.toLowerCase();
                const isInCart = cartItemNames.some(cartItem =>
                    cartItem.includes(ingredientName) || ingredientName.includes(cartItem)
                );

                if (!isInCart) {
                    missingIngredients.push(ingredient);
                    allMissingIngredients.add(ingredientName);
                }
            });

            recipeIngredientMap.set(recipe.id, { recipe, ingredients: missingIngredients });
        });

        // STEP 2: Batch search for all missing ingredients (ONE API call per unique ingredient)
        const ingredientAvailabilityMap = await this.batchCheckIngredientsAvailability(
            Array.from(allMissingIngredients),
            customerType
        );

        // STEP 3: Process each recipe using the batched results
        const processedRecipes: Recipe[] = [];

        for (const [recipeId, { recipe, ingredients: missingIngredients }] of recipeIngredientMap) {
            const availableMissingIngredients = missingIngredients.filter(ingredient =>
                ingredientAvailabilityMap.has(ingredient.name.toLowerCase())
            );

            const estimatedCost = this.estimateCostFromAvailabilityMap(
                availableMissingIngredients,
                ingredientAvailabilityMap
            );

            processedRecipes.push({
                ...recipe,
                missing_ingredients: missingIngredients,
                available_missing_ingredients: availableMissingIngredients,
                estimated_total_cost: estimatedCost
            });
        }

        return processedRecipes;
    }

    /**
     * OPTIMIZATION: Batch check ingredient availability with caching
     */
    private async batchCheckIngredientsAvailability(
        ingredientNames: string[],
        customerType: 'individual' | 'business'
    ): Promise<Map<string, { products: any[], lowestPrice: number }>> {
        const availabilityMap = new Map<string, { products: any[], lowestPrice: number }>();
        const uncachedIngredients: string[] = [];

        // STEP 1: Check cache first
        ingredientNames.forEach(ingredientName => {
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                // Use cached data
                const suitableProducts = cached.products.filter(product =>
                    product.unit_prices.some((up: any) =>
                        up.customer_type === customerType && up.quantity_available > 0
                    )
                );

                if (suitableProducts.length > 0) {
                    const lowestPrice = this.findLowestPrice(suitableProducts, customerType);
                    availabilityMap.set(ingredientName, { products: suitableProducts, lowestPrice });
                }
            } else {
                uncachedIngredients.push(ingredientName);
            }
        });

        // STEP 2: Batch search for uncached ingredients
        if (uncachedIngredients.length > 0) {
            console.log(`🔍 Batch searching for ${uncachedIngredients.length} ingredients`);

            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return availabilityMap;

                // OPTIMIZATION: Search for multiple ingredients in fewer API calls
                const searchPromises = uncachedIngredients.map(async (ingredientName) => {
                    try {
                        const searchResponse = await api.get(`/browse/products/search`, {
                            params: { search: ingredientName, limit: 10 },
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        const products = searchResponse.data.items || [];

                        // Cache the result
                        const cacheKey = `${ingredientName}:${customerType}`;
                        this.productSearchCache.set(cacheKey, {
                            products,
                            timestamp: Date.now(),
                            customerType
                        });

                        // Check if available for this customer type
                        const suitableProducts = products.filter((product: any) =>
                            product.unit_prices.some((up: any) =>
                                up.customer_type === customerType && up.quantity_available > 0
                            )
                        );

                        if (suitableProducts.length > 0) {
                            const lowestPrice = this.findLowestPrice(suitableProducts, customerType);
                            return { ingredientName, products: suitableProducts, lowestPrice };
                        }

                        return null;
                    } catch (error) {
                        console.error(`❌ Error searching for ${ingredientName}:`, error);
                        return null;
                    }
                });

                // Wait for all searches to complete
                const results = await Promise.all(searchPromises);

                results.forEach(result => {
                    if (result) {
                        availabilityMap.set(result.ingredientName, {
                            products: result.products,
                            lowestPrice: result.lowestPrice
                        });
                    }
                });

            } catch (error) {
                console.error('❌ Error in batch ingredient search:', error);
            }
        }

        console.log(`📋 Found ${availabilityMap.size} available ingredients out of ${ingredientNames.length}`);
        return availabilityMap;
    }

    /**
     * OPTIMIZATION: Find lowest price from cached data
     */
    private findLowestPrice(products: any[], customerType: string): number {
        let lowestPrice = Infinity;

        products.forEach((product: any) => {
            product.unit_prices.forEach((up: any) => {
                if (up.customer_type === customerType && up.quantity_available > 0) {
                    lowestPrice = Math.min(lowestPrice, up.price_per_unit);
                }
            });
        });

        return lowestPrice === Infinity ? 0 : lowestPrice;
    }

    /**
     * OPTIMIZATION: Estimate cost from availability map (no additional API calls)
     */
    private estimateCostFromAvailabilityMap(
        ingredients: RecipeIngredient[],
        availabilityMap: Map<string, { products: any[], lowestPrice: number }>
    ): number {
        let totalCost = 0;

        ingredients.forEach(ingredient => {
            const availability = availabilityMap.get(ingredient.name.toLowerCase());
            if (availability) {
                totalCost += availability.lowestPrice;
            }
        });

        return totalCost;
    }

    /**
     * OPTIMIZATION: Improved product matching with caching
     */
    async findBestProductMatch(ingredientName: string, customerType: 'individual' | 'business'): Promise<any> {
        try {
            console.log(`🔍 Finding best match for: ${ingredientName} (${customerType})`);

            // Check cache first
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);
            let products: any[] = [];

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                console.log(`📋 Using cached data for ${ingredientName}`);
                products = cached.products;
            } else {
                // Fetch from API
                const token = await AsyncStorage.getItem('token');
                const searchResponse = await api.get(`/browse/products/search`, {
                    params: { search: ingredientName, limit: 20 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                products = searchResponse.data.items || [];

                // Cache the result
                this.productSearchCache.set(cacheKey, {
                    products,
                    timestamp: Date.now(),
                    customerType
                });
            }

            console.log(`📦 Found ${products.length} products for ${ingredientName}`);

            let bestMatch = null;
            let lowestPrice = Infinity;

            for (const product of products) {
                const suitablePrices = product.unit_prices.filter(
                    (up: any) => up.customer_type === customerType && up.quantity_available > 0
                );

                for (const unitPrice of suitablePrices) {
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
                    }
                }
            }

            if (bestMatch) {
                console.log(`🎯 Best match for ${ingredientName}:`, bestMatch.product_name);
            }

            return bestMatch;
        } catch (error) {
            console.error(`❌ Error finding product match for ${ingredientName}:`, error);
            return null;
        }
    }

    /**
     * OPTIMIZATION: Clear cache when needed
     */
    clearCache() {
        this.productSearchCache.clear();
        this.lastCartHash = '';
        this.lastRecipesResult = [];
        console.log('🧹 AI: Cache cleared');
    }

    // Keep all the other existing methods unchanged...
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

    private applyRecipeRules(cartItems: CartItem[], cartAnalysis: any): Recipe[] {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const matchingRecipes: Recipe[] = [];

        for (const rule of this.recipeRules) {
            const matchScore = this.calculateRuleMatchScore(rule, cartItemNames);

            if (matchScore > 0.1) {
                const recipe = this.createRecipeFromRule(rule, cartItems, matchScore);
                matchingRecipes.push(recipe);
            }
        }

        return matchingRecipes;
    }

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

    private calculateConfidenceScore(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): number {
        let score = 0;
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        const ingredientOverlap = recipe.ingredients.filter(ingredient =>
            cartItemNames.some(cartItem =>
                cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
            )
        ).length;
        score += (ingredientOverlap / recipe.ingredients.length) * 0.4;

        if (customerType === 'business' && recipe.difficulty !== 'hard') {
            score += 0.2;
        } else if (customerType === 'individual' && recipe.difficulty === 'easy') {
            score += 0.2;
        }

        if (userPreferences?.preferredCuisine?.includes(recipe.cuisine_type)) {
            score += 0.2;
        }

        const missingCount = recipe.ingredients.filter(ing =>
            !cartItemNames.some(cartItem =>
                cartItem.includes(ing.name) || ing.name.includes(cartItem)
            )
        ).length;
        score += (1 - (missingCount / recipe.ingredients.length)) * 0.2;

        return Math.min(score, 1.0);
    }

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
                    const bestMatch = await this.findBestProductMatch(ingredient.name, customerType);

                    if (bestMatch) {
                        const finalQuantity = Math.max(1, bestMatch.minimum_order);

                        await api.post('/orders/cart/items', {
                            farmer_product_id: bestMatch.farmer_product_id,
                            unit_price_id: bestMatch.unit_price_id,
                            quantity: finalQuantity
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        addedItems.push({
                            name: ingredient.name,
                            product: bestMatch.product_name,
                            farmer: bestMatch.farmer_name,
                            price: bestMatch.price_per_unit,
                            quantity: finalQuantity,
                            unit: bestMatch.unit
                        });
                    } else {
                        errors.push(`Could not find ${ingredient.name} from any farmer`);
                    }
                } catch (itemError: any) {
                    errors.push(`Failed to add ${ingredient.name}: ${itemError.response?.data?.detail || itemError.message}`);
                }
            }

            return { success: addedItems.length > 0, addedItems, errors };
        } catch (error: any) {
            console.error('❌ Fatal error adding ingredients to cart:', error);
            return { success: false, addedItems: [], errors: ['Failed to add ingredients to cart: ' + error.message] };
        }
    }
}

export default new RuleBasedAIService();


//////////////////////////////////////


// services/voiceService.ts - Fixed with better error handling
    import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
    import AsyncStorage from '@react-native-async-storage/async-storage';
    import api from '@/services/api';
    import { Platform } from 'react-native';

    interface VoiceCommand {
        action: 'search' | 'add' | 'checkout' | 'unknown';
        product?: string;
        quantity?: number;
        unit?: string;
        district?: string;
        farmer?: string;
        confidence: number;
    }

    interface VoiceResult {
        success: boolean;
        command?: VoiceCommand;
        message: string;
        data?: any;
        suggestions?: string[];
    }

    interface ProductMatch {
        id: number;
        item: string;
        farmer_name: string;
        farmer_district: string;
        unit_prices: Array<{
            id: number;
            unit: string;
            customer_type: string;
            price_per_unit: number;
            quantity_available: number;
            minimum_order: number;
        }>;
    }

    class VoiceInputService {
        private isListening = false;
        private recognizedText = '';
        private isInitialized = false;

        // Common product mappings for Mauritian context
        private productMappings = new Map([
            ['tomato', ['tomato', 'tomate']],
            ['potato', ['potato', 'pomme de terre']],
            ['onion', ['onion', 'oignon']],
            ['carrot', ['carrot', 'carotte']],
            ['cabbage', ['cabbage', 'chou']],
            ['lettuce', ['lettuce', 'laitue']],
            ['spinach', ['spinach', 'épinard']],
            ['broccoli', ['broccoli', 'brocoli']],
            ['cauliflower', ['cauliflower', 'chou-fleur']],
            ['bell pepper', ['bell pepper', 'pepper', 'capsicum', 'poivron']],
            ['chili', ['chili', 'chilli', 'hot pepper', 'piment']],
            ['cucumber', ['cucumber', 'concombre']],
            ['eggplant', ['eggplant', 'aubergine', 'brinjal']],
            ['okra', ['okra', 'lady finger', 'gombo']],
            ['green beans', ['green beans', 'beans', 'haricots verts']],
            ['pumpkin', ['pumpkin', 'citrouille']],
            ['beetroot', ['beetroot', 'beet', 'betterave']],
            ['radish', ['radish', 'radis']],
            ['ginger', ['ginger', 'gingembre']],
            ['garlic', ['garlic', 'ail']],
            ['apple', ['apple', 'pomme']],
            ['banana', ['banana', 'banane']],
            ['orange', ['orange']],
            ['mango', ['mango', 'mangue']],
            ['pineapple', ['pineapple', 'ananas']],
            ['papaya', ['papaya', 'papaye']],
            ['guava', ['guava', 'goyave']],
            ['lychee', ['lychee', 'litchi']],
            ['coconut', ['coconut', 'coco']],
            ['lemon', ['lemon', 'citron']],
            ['lime', ['lime', 'citron vert']],
            ['watermelon', ['watermelon', 'pastèque']],
            ['melon', ['melon']],
            ['grapes', ['grapes', 'raisin']],
            ['strawberry', ['strawberry', 'fraise']]
        ]);

        // Unit mappings
        private unitMappings = new Map([
            ['kilogram', ['kg', 'kilo', 'kilogram', 'kilograms']],
            ['gram', ['g', 'gram', 'grams', 'gramme', 'grammes']],
            ['piece', ['piece', 'pieces', 'unit', 'units', 'each']],
            ['bunch', ['bunch', 'bunches', 'bouquet']],
            ['dozen', ['dozen', 'douzaine']],
            ['basket', ['basket', 'baskets', 'panier']]
        ]);

        // Mauritian districts
        private districts = [
            'port louis', 'beau bassin-rose hill', 'vacoas-phoenix', 'curepipe', 'quatre bornes',
            'triolet', 'goodlands', 'centre de flacq', 'mahebourg', 'saint pierre', 'rose belle',
            'riviere du rempart', 'grand baie', 'pamplemousses', 'grand port', 'black river',
            'moka', 'plaines wilhems', 'riviere noire', 'savanne', 'flacq'
        ];

        constructor() {
            // Initialize but don't set up listeners immediately
        }

        private async initializeVoice() {
            if (this.isInitialized) return;

            try {
                // Check if voice is available on this platform
                if (Platform.OS === 'web') {
                    console.warn('Voice recognition not available on web platform');
                    return;
                }

                Voice.onSpeechStart = this.onSpeechStart;
                Voice.onSpeechRecognized = this.onSpeechRecognized;
                Voice.onSpeechEnd = this.onSpeechEnd;
                Voice.onSpeechError = this.onSpeechError;
                Voice.onSpeechResults = this.onSpeechResults;

                this.isInitialized = true;
                console.log('🎤 Voice service initialized successfully');
            } catch (error) {
                console.error('Voice initialization error:', error);
                throw new Error('Voice recognition not available on this device');
            }
        }

        private onSpeechStart = () => {
            console.log('🎤 Voice: Speech started');
            this.isListening = true;
        };

        private onSpeechRecognized = () => {
            console.log('🎤 Voice: Speech recognized');
        };

        private onSpeechEnd = () => {
            console.log('🎤 Voice: Speech ended');
            this.isListening = false;
        };

        private onSpeechError = (error: SpeechErrorEvent) => {
            console.error('🎤 Voice: Speech error', error);
            this.isListening = false;
        };

        private onSpeechResults = (event: SpeechResultsEvent) => {
            if (event.value && event.value.length > 0) {
                this.recognizedText = event.value[0];
                console.log('🎤 Voice: Recognized text:', this.recognizedText);
            }
        };

        /**
         * Start listening for voice input
         */
        async startListening(): Promise<void> {
            try {
                await this.initializeVoice();

                if (this.isListening) {
                    await this.stopListening();
                }

                // Reset recognized text
                this.recognizedText = '';

                await Voice.start('en-US');
                this.isListening = true;
            } catch (error) {
                console.error('Error starting voice recognition:', error);
                throw new Error('Failed to start voice recognition. Please check your microphone permissions.');
            }
        }

        /**
         * Stop listening and return recognized text
         */
        async stopListening(): Promise<string> {
            try {
                if (this.isListening) {
                    await Voice.stop();
                }
                this.isListening = false;
                return this.recognizedText;
            } catch (error) {
                console.error('Error stopping voice recognition:', error);
                this.isListening = false;
                return this.recognizedText;
            }
        }

        /**
         * Process voice command and execute action
         */
        async processVoiceCommand(
            recognizedText: string,
            customerType: 'individual' | 'business'
        ): Promise<VoiceResult> {
            try {
                console.log('🤖 Processing voice command:', recognizedText);

                if (!recognizedText || recognizedText.trim().length === 0) {
                    return {
                        success: false,
                        message: "I didn't hear anything clearly. Please try speaking again.",
                        suggestions: [
                            "Make sure you're speaking clearly",
                            "Check your microphone permissions",
                            "Try again in a quieter environment"
                        ]
                    };
                }

                const command = this.parseVoiceCommand(recognizedText);
                console.log('🧠 Parsed command:', command);

                if (command.confidence < 0.3) {
                    return {
                        success: false,
                        message: "I didn't understand that command. Try saying something like 'Search for tomatoes', 'Add 2 kg of potatoes to cart', or 'Checkout my items'.",
                        suggestions: [
                            "Search for tomatoes",
                            "Add 2 kg of potatoes to cart",
                            "Find carrots from Curepipe",
                            "Checkout my items"
                        ]
                    };
                }

                switch (command.action) {
                    case 'search':
                        return await this.executeSearch(command, customerType);
                    case 'add':
                        return await this.executeAddToCart(command, customerType);
                    case 'checkout':
                        return await this.executeCheckout();
                    default:
                        return {
                            success: false,
                            message: "I understood your speech but couldn't determine the action. Try being more specific.",
                            suggestions: [
                                "Search for [product name]",
                                "Add [quantity] [unit] of [product] to cart",
                                "Checkout my items"
                            ]
                        };
                }
            } catch (error) {
                console.error('Error processing voice command:', error);
                return {
                    success: false,
                    message: "Sorry, there was an error processing your command. Please try again."
                };
            }
        }

        /**
         * Parse voice command using NLP techniques
         */
        private parseVoiceCommand(text: string): VoiceCommand {
            const normalizedText = text.toLowerCase().trim();
            console.log('🔍 Parsing:', normalizedText);

            let command: VoiceCommand = {
                action: 'unknown',
                confidence: 0
            };

            // Action detection with higher confidence scoring
            if (this.containsWords(normalizedText, ['search', 'find', 'look for', 'show me'])) {
                command.action = 'search';
                command.confidence += 0.4;
            } else if (this.containsWords(normalizedText, ['add', 'put', 'include', 'cart'])) {
                command.action = 'add';
                command.confidence += 0.4;
            } else if (this.containsWords(normalizedText, ['checkout', 'check out', 'buy', 'purchase', 'order now'])) {
                command.action = 'checkout';
                command.confidence += 0.8; // High confidence for checkout
                return command; // Return early for checkout
            }

            // Product detection
            const detectedProduct = this.detectProduct(normalizedText);
            if (detectedProduct) {
                command.product = detectedProduct;
                command.confidence += 0.3;
            }

            // Quantity and unit detection
            const { quantity, unit } = this.detectQuantityAndUnit(normalizedText);
            if (quantity) {
                command.quantity = quantity;
                command.confidence += 0.2;
            }
            if (unit) {
                command.unit = unit;
                command.confidence += 0.1;
            }

            // District detection
            const detectedDistrict = this.detectDistrict(normalizedText);
            if (detectedDistrict) {
                command.district = detectedDistrict;
                command.confidence += 0.1;
            }

            console.log('📊 Final command confidence:', command.confidence);
            return command;
        }

        /**
         * Execute search command
         */
        private async executeSearch(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    return { success: false, message: "Please log in to search for products." };
                }

                const searchParams: any = { limit: 20 };

                if (command.product) {
                    searchParams.search = command.product;
                }
                if (command.district) {
                    searchParams.district = command.district;
                }

                console.log('🔍 Searching with params:', searchParams);

                const response = await api.get('/browse/products/search', {
                    params: searchParams,
                    headers: { Authorization: `Bearer ${token}` }
                });

                const products = response.data.items || [];

                // Filter products that have pricing for the customer type
                const filteredProducts = products.filter((product: any) =>
                    product.unit_prices.some((up: any) =>
                        up.customer_type === customerType && up.quantity_available > 0
                    )
                );

                if (filteredProducts.length === 0) {
                    let message = `No ${command.product || 'products'} found`;
                    if (command.district) {
                        message += ` from farmers in ${command.district}`;
                    }
                    message += ` for ${customerType} customers.`;

                    return {
                        success: false,
                        message,
                        suggestions: [
                            "Try searching without specifying a district",
                            "Search for a different product",
                            "Say 'search for vegetables' for broader results"
                        ]
                    };
                }

                const productNames = filteredProducts.slice(0, 5).map((p: any) => p.item).join(', ');
                let message = `Found ${filteredProducts.length} ${command.product || 'products'}`;
                if (command.district) {
                    message += ` from ${command.district}`;
                }
                message += `: ${productNames}${filteredProducts.length > 5 ? ' and more' : ''}.`;

                return {
                    success: true,
                    message,
                    data: { products: filteredProducts, searchTerm: command.product }
                };

            } catch (error) {
                console.error('Search error:', error);
                return {
                    success: false,
                    message: "Sorry, there was an error searching for products. Please try again."
                };
            }
        }

        /**
         * Execute add to cart command with intelligent matching
         */
        private async executeAddToCart(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    return { success: false, message: "Please log in to add items to cart." };
                }

                if (!command.product) {
                    return {
                        success: false,
                        message: "Please specify which product you want to add. For example: 'Add 2 kg of tomatoes to cart'."
                    };
                }

                // Search for the product
                const searchResponse = await api.get('/browse/products/search', {
                    params: { search: command.product, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                const products: ProductMatch[] = searchResponse.data.items || [];

                // Filter and find best matches
                const suitableProducts = products.filter(product =>
                    product.unit_prices.some(up =>
                        up.customer_type === customerType && up.quantity_available > 0
                    )
                );

                if (suitableProducts.length === 0) {
                    return {
                        success: false,
                        message: `Sorry, ${command.product} is not available from any farmers for ${customerType} customers right now.`,
                        suggestions: [
                            "Try searching for the product first to see availability",
                            "Search for similar products",
                            "Try again later as farmers update their inventory regularly"
                        ]
                    };
                }

                // Intelligent product and unit price selection
                const bestMatch = this.findBestProductMatch(suitableProducts, command, customerType);
                if (!bestMatch) {
                    return {
                        success: false,
                        message: `Found ${command.product} but couldn't match your requirements. Please try with different units or quantities.`
                    };
                }

                // Determine final quantity
                const finalQuantity = this.calculateFinalQuantity(
                    command.quantity || 1,
                    bestMatch.unitPrice.minimum_order,
                    customerType
                );

                // Check availability
                if (finalQuantity > bestMatch.unitPrice.quantity_available) {
                    return {
                        success: false,
                        message: `Sorry, only ${bestMatch.unitPrice.quantity_available} ${bestMatch.unitPrice.unit} of ${bestMatch.product.item} available from ${bestMatch.product.farmer_name}.`,
                        suggestions: [
                            "Try a smaller quantity",
                            "Search for the same product from other farmers"
                        ]
                    };
                }

                // Add to cart
                await api.post('/orders/cart/items', {
                    farmer_product_id: bestMatch.product.id,
                    unit_price_id: bestMatch.unitPrice.id,
                    quantity: finalQuantity
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const totalCost = (finalQuantity * bestMatch.unitPrice.price_per_unit).toFixed(2);

                return {
                    success: true,
                    message: `Added ${finalQuantity} ${bestMatch.unitPrice.unit} of ${bestMatch.product.item} from ${bestMatch.product.farmer_name} to your cart for Rs ${totalCost}.`,
                    data: {
                        product: bestMatch.product.item,
                        farmer: bestMatch.product.farmer_name,
                        quantity: finalQuantity,
                        unit: bestMatch.unitPrice.unit,
                        cost: totalCost
                    }
                };

            } catch (error: any) {
                console.error('Add to cart error:', error);

                if (error.response?.status === 400) {
                    return {
                        success: false,
                        message: error.response.data.detail || "Unable to add item to cart. Please check the quantity and try again."
                    };
                }

                return {
                    success: false,
                    message: "Sorry, there was an error adding the item to your cart. Please try again."
                };
            }
        }

        /**
         * Execute checkout command
         */
        private async executeCheckout(): Promise<VoiceResult> {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    return { success: false, message: "Please log in to checkout." };
                }

                // Get current cart
                const cartResponse = await api.get('/orders/cart', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const cart = cartResponse.data;

                if (!cart.farmer_groups || cart.farmer_groups.length === 0) {
                    return {
                        success: false,
                        message: "Your cart is empty. Add some items before checkout.",
                        suggestions: [
                            "Say 'Add tomatoes to cart' to add items",
                            "Say 'Search for vegetables' to browse products"
                        ]
                    };
                }

                const itemCount = Number(cart.total_items) || 0;
                const totalAmount = Number(cart.total_amount) || 0;
                const farmerCount = cart.farmer_groups ? cart.farmer_groups.length : 0;

                return {
                    success: true,
                    message: `Proceeding to checkout with ${itemCount} items from ${farmerCount} farmer${farmerCount > 1 ? 's' : ''} for Rs ${totalAmount.toFixed(2)}.`,
                    data: {
                        action: 'navigate_to_checkout',
                        cart: cart
                    }
                };

            } catch (error) {
                console.error('Checkout error:', error);
                return {
                    success: false,
                    message: "Sorry, there was an error accessing your cart for checkout."
                };
            }
        }

        // Helper methods
        private containsWords(text: string, words: string[]): boolean {
            return words.some(word => text.includes(word));
        }

        private detectProduct(text: string): string | undefined {
            for (const [product, variants] of this.productMappings) {
                if (variants.some(variant => text.includes(variant))) {
                    return product;
                }
            }
            return undefined;
        }

        private detectQuantityAndUnit(text: string): { quantity?: number; unit?: string } {
            // Enhanced quantity detection with support for decimals and fractions
            const quantityRegex = /(\d+(?:\.\d+)?|\bhalf\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)/i;
            const quantityMatch = text.match(quantityRegex);

            let quantity: number | undefined;
            if (quantityMatch) {
                const quantityStr = quantityMatch[1].toLowerCase();
                if (quantityStr === 'half') quantity = 0.5;
                else if (quantityStr === 'one') quantity = 1;
                else if (quantityStr === 'two') quantity = 2;
                else if (quantityStr === 'three') quantity = 3;
                else if (quantityStr === 'four') quantity = 4;
                else if (quantityStr === 'five') quantity = 5;
                else if (quantityStr === 'six') quantity = 6;
                else if (quantityStr === 'seven') quantity = 7;
                else if (quantityStr === 'eight') quantity = 8;
                else if (quantityStr === 'nine') quantity = 9;
                else if (quantityStr === 'ten') quantity = 10;
                else quantity = parseFloat(quantityStr);
            }

            // Unit detection
            let unit: string | undefined;
            for (const [standardUnit, variants] of this.unitMappings) {
                if (variants.some(variant => text.includes(variant))) {
                    unit = standardUnit === 'kilogram' ? 'kg' :
                        standardUnit === 'gram' ? 'g' :
                            standardUnit;
                    break;
                }
            }

            return { quantity, unit };
        }

        private detectDistrict(text: string): string | undefined {
            return this.districts.find(district =>
                text.includes(district) || text.includes(district.replace(/\s+/g, ''))
            );
        }

        private findBestProductMatch(
            products: ProductMatch[],
            command: VoiceCommand,
            customerType: 'individual' | 'business'
        ) {
            for (const product of products) {
                const suitableUnitPrices = product.unit_prices.filter(up =>
                    up.customer_type === customerType && up.quantity_available > 0
                );

                // If specific unit requested, try to match it
                if (command.unit) {
                    const matchingUnitPrice = suitableUnitPrices.find(up =>
                        up.unit.toLowerCase() === command.unit?.toLowerCase() ||
                        this.unitMappings.get(command.unit || '')?.includes(up.unit.toLowerCase())
                    );

                    if (matchingUnitPrice) {
                        return { product, unitPrice: matchingUnitPrice };
                    }
                }

                // Otherwise, pick best available unit price (lowest price)
                if (suitableUnitPrices.length > 0) {
                    const bestUnitPrice = suitableUnitPrices.sort((a, b) => a.price_per_unit - b.price_per_unit)[0];
                    return { product, unitPrice: bestUnitPrice };
                }
            }

            return null;
        }

        private calculateFinalQuantity(
            requestedQuantity: number,
            minimumOrder: number,
            customerType: 'individual' | 'business'
        ): number {
            const quantityStep = customerType === 'business' ? 25 : 1;
            const adjustedMinimum = Math.ceil(minimumOrder / quantityStep) * quantityStep;
            return Math.max(requestedQuantity, adjustedMinimum);
        }

        /**
         * Check if microphone permission is available
         */
        async checkPermissions(): Promise<boolean> {
            try {
                if (Platform.OS === 'web') {
                    return false;
                }

                await this.initializeVoice();
                const available = await Voice.isAvailable();
                // Voice.isAvailable() returns 1 for true, 0 for false
                return available === 1;
            } catch (error) {
                console.error('Permission check error:', error);
                return false;
            }
        }

        /**
         * Clean up voice recognition resources
         */
        async cleanup(): Promise<void> {
            try {
                if (this.isListening) {
                    await Voice.stop();
                }
                if (this.isInitialized) {
                    await Voice.destroy();
                    Voice.removeAllListeners();
                    this.isInitialized = false;
                }
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }

        /**
         * Get current listening state
         */
        getIsListening(): boolean {
            return this.isListening;
        }
    }

    export default new VoiceInputService();


//////////////////////////////////////


// Updated VoiceInput.tsx with improved design and floating button capability
import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Animated,
    Dimensions,
    Alert,
    ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'expo-router';
import VoiceInputService from '@/services/voiceService';

interface VoiceInputProps {
    onResult?: (result: any) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    style?: ViewStyle; // NEW: Allow custom styling for floating button
    iconSize?: number; // NEW: Custom icon size
    iconColor?: string; // NEW: Custom icon color
}

export default function VoiceInput({
                                       onResult,
                                       onError,
                                       disabled = false,
                                       style,
                                       iconSize = 20,
                                       iconColor = "black"
                                   }: VoiceInputProps) {
    const { user } = useContext(AuthContext);
    const { refreshCartCount } = useCart();
    const router = useRouter();

    const [isVisible, setIsVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [result, setResult] = useState<string>('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [pulseAnim] = useState(new Animated.Value(1));
    const [waveAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        return () => {
            VoiceInputService.cleanup();
        };
    }, []);

    useEffect(() => {
        if (isListening) {
            startPulseAnimation();
            startWaveAnimation();
        } else {
            stopAnimations();
        }
    }, [isListening]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const startWaveAnimation = () => {
        Animated.loop(
            Animated.timing(waveAnim, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    };

    const stopAnimations = () => {
        pulseAnim.stopAnimation();
        waveAnim.stopAnimation();
        pulseAnim.setValue(1);
        waveAnim.setValue(0);
    };

    const handleVoicePress = async () => {
        if (disabled) return;

        try {
            // Check permissions first
            const hasPermission = await VoiceInputService.checkPermissions();
            if (!hasPermission) {
                Alert.alert(
                    'Microphone Permission',
                    'Please enable microphone permission in your device settings to use voice commands.',
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsVisible(true);
            setIsListening(false);
            setIsProcessing(false);
            setRecognizedText('');
            setResult('');
            setSuggestions([]);

            await startVoiceRecognition();
        } catch (error) {
            console.error('Voice input error:', error);
            setIsVisible(false);
            onError?.('Failed to start voice recognition. Please try again.');
        }
    };

    const startVoiceRecognition = async () => {
        try {
            setIsListening(true);
            await VoiceInputService.startListening();

            // Auto-stop after 10 seconds
            setTimeout(async () => {
                if (isListening) {
                    await stopVoiceRecognition();
                }
            }, 10000);

        } catch (error) {
            console.error('Start listening error:', error);
            setIsListening(false);
            setResult('Failed to start voice recognition.');
        }
    };

    const stopVoiceRecognition = async () => {
        try {
            setIsListening(false);
            const recognizedText = await VoiceInputService.stopListening();

            if (recognizedText.trim()) {
                setRecognizedText(recognizedText);
                await processVoiceCommand(recognizedText);
            } else {
                setResult("I didn't hear anything. Please try again.");
                setSuggestions([
                    "Make sure your microphone is working",
                    "Speak clearly and try again",
                    "Check your device volume"
                ]);
            }
        } catch (error) {
            console.error('Stop listening error:', error);
            setResult('Error processing your voice command.');
        }
    };

    const processVoiceCommand = async (text: string) => {
        try {
            setIsProcessing(true);

            const customerType = user?.role as 'individual' | 'business';
            const result = await VoiceInputService.processVoiceCommand(text, customerType);

            setResult(result.message);
            setSuggestions(result.suggestions || []);

            if (result.success) {
                // Handle successful commands
                if (result.data?.action === 'navigate_to_checkout') {
                    // Navigate to checkout after a brief delay
                    setTimeout(() => {
                        setIsVisible(false);
                        router.push('/(auth)/customer/checkout');
                    }, 2000);
                } else if (result.data?.products) {
                    // For search results, could navigate to products page with search term
                    onResult?.(result.data);
                } else {
                    // For add to cart, refresh cart count
                    await refreshCartCount();
                    onResult?.(result.data);
                }
            }

        } catch (error) {
            console.error('Process command error:', error);
            setResult('Sorry, there was an error processing your command.');
            setSuggestions(['Please try again']);
        } finally {
            setIsProcessing(false);
        }
    };

    const retryVoiceInput = async () => {
        setRecognizedText('');
        setResult('');
        setSuggestions([]);
        await startVoiceRecognition();
    };

    const closeModal = () => {
        setIsVisible(false);
        setIsListening(false);
        setIsProcessing(false);
        VoiceInputService.stopListening().catch(console.error);
    };

    const trySuggestion = (suggestion: string) => {
        setRecognizedText(suggestion);
        processVoiceCommand(suggestion);
    };

    if (!user || (user.role !== 'individual' && user.role !== 'business')) {
        return null;
    }

    return (
        <>
            {/* Voice Input Button */}
            <TouchableOpacity
                onPress={handleVoicePress}
                disabled={disabled}
                style={style || {
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#EAF3D0',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="mic"
                    size={iconSize}
                    color={disabled ? "#999" : iconColor}
                />
            </TouchableOpacity>

            {/* Voice Input Modal - UPDATED DESIGN */}
            <Modal
                visible={isVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View
                    className="flex-1 bg-black bg-opacity-50 justify-center items-center"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                >
                    <View className="bg-white rounded-2xl p-6 mx-6 w-full max-w-sm">

                        {/* Voice Visualization */}
                        <View className="items-center mb-6">
                            {isListening ? (
                                <View className="relative items-center justify-center my-8">
                                    {/* Outer pulse ring - Better green ripple */}
                                    <Animated.View
                                        className="absolute w-32 h-32 rounded-full"
                                        style={{
                                            backgroundColor: '#EAF3D0',
                                            opacity: 0.55,
                                            transform: [{ scale: pulseAnim }],
                                        }}
                                    />

                                    {/* Wave rings - Better green */}
                                    <Animated.View
                                        className="absolute w-24 h-24 rounded-full border-2"
                                        style={{
                                            borderColor: '#000000',
                                            opacity: waveAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.8, 0],
                                            }),
                                            transform: [{
                                                scale: waveAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [1, 1.5],
                                                }),
                                            }],
                                        }}
                                    />

                                    {/* Center microphone with green background */}
                                    <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                        <Ionicons name="mic" size={32} color="black" />
                                    </View>
                                </View>
                            ) : isProcessing ? (
                                <View className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center">
                                    <ActivityIndicator size="large" color="white" />
                                </View>
                            ) : (
                                // CHANGED: Mic icon instead of checkmark, bg-background with black icon
                                <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                    <Ionicons name="mic" size={32} color="black" />
                                </View>
                            )}
                        </View>

                        {/* Status Text */}
                        <View className="mb-4">
                            {isListening ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        listening...
                                    </Text>
                                    <Text className="text-xs text-gray-600 text-center my-4">
                                        Try saying: &#34;Add 2 kg tomatoes to cart&#34; or &#34;Search for vegetables from Curepipe&#34;
                                    </Text>
                                </View>
                            ) : isProcessing ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        Processing...
                                    </Text>
                                    {recognizedText && (
                                        <Text className="text-sm text-gray-600 text-center italic">
                                            &#34;{recognizedText}&#34;
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {recognizedText && (
                                        <View className="mb-3">
                                            <Text className="text-sm text-gray-500 mb-1">You said:</Text>
                                            <Text className="text-base italic text-gray-700">
                                                &#34;{recognizedText}&#34;
                                            </Text>
                                        </View>
                                    )}

                                    {result && (
                                        <View className="mb-3">
                                            <Text className="text-base text-black leading-5">
                                                {result}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Suggestions */}
                        {suggestions.length > 0 && !isListening && !isProcessing && (
                            <View className="mb-4">
                                <Text className="text-sm font-medium text-gray-700 mb-2">
                                    Try these commands:
                                </Text>
                                {suggestions.map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => trySuggestion(suggestion)}
                                        className="bg-gray-100 rounded-lg p-3 mb-2"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-sm text-gray-700">
                                            &#34;{suggestion}&#34;
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View className="flex-row gap-3">
                            {!isListening && !isProcessing && (
                                <TouchableOpacity
                                    onPress={retryVoiceInput}
                                    className="flex-1 bg-background py-3 rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-black font-medium text-center">
                                        try again
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {isListening && (
                                <TouchableOpacity
                                    onPress={stopVoiceRecognition}
                                    className="flex-1 bg-red-500 py-3 rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-white font-medium text-center">
                                        stop listening
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={closeModal}
                                className="flex-1 bg-gray-200 py-3 rounded-lg"
                                activeOpacity={0.7}
                                disabled={isProcessing}
                            >
                                <Text className="text-black font-medium text-center">
                                    {isProcessing ? 'processing...' : 'close'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Help Text */}
                        {!isListening && !isProcessing && !result && (
                            <View className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <Text className="text-xs text-blue-700 text-center">
                                    <Text className="font-semibold">Voice Commands:</Text>
                                    {'\n'}• &#34;Search for tomatoes&#34;
                                    {'\n'}• &#34;Add 2 kg potatoes to cart&#34;
                                    {'\n'}• &#34;Find carrots from Curepipe&#34;
                                    {'\n'}• &#34;Checkout my items&#34;
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}


//////////////////////////////////////


    export default {
        expo: {
            name: "Farmlink",
            slug: "farmlink",
            version: "1.0.0",
            orientation: "portrait",
            icon: "./assets/images/logo.png",
            scheme: "farmlink",
            userInterfaceStyle: "automatic",
            newArchEnabled: true,
            ios: {
                supportsTablet: true,
                bundleIdentifier: "com.imfestudio.farmlink",
                infoPlist: {
                    UIBackgroundModes: ["remote-notification"],
                    ITSAppUsesNonExemptEncryption: false,
                    NSMicrophoneUsageDescription: "FarmLink needs microphone access for voice commands to search products and add items to cart",
                    NSSpeechRecognitionUsageDescription: "FarmLink uses speech recognition to process your voice commands for easier shopping"
                }
            },
            android: {
                package: "com.imfestudio.farmlink",
                adaptiveIcon: {
                    foregroundImage: "./assets/images/logo.png",
                    backgroundColor: "#F2FBE0",
                },
                permissions: [
                    "RECEIVE_BOOT_COMPLETED",
                    "VIBRATE",
                    "WAKE_LOCK",
                    "INTERNET",
                    "SYSTEM_ALERT_WINDOW",
                    "RECORD_AUDIO"
                ],
                usesCleartextTraffic: true,
                edgeToEdgeEnabled: true,
            },
            web: {
                bundler: "metro",
                output: "static",
                favicon: "./assets/images/logo.png",
            },
            notification: {
                icon: "./assets/icons/notification.png",
                color: "#4CAF50",
                // sounds: ["./assets/notification.wav"]
            },
            plugins: [
                "expo-router",
                "expo-web-browser",
                "expo-dev-client",
                [
                    "expo-splash-screen",
                    {
                        image: "./assets/images/logo.png",
                        imageWidth: 128,
                        resizeMode: "contain",
                        backgroundColor: "#F2FBE0",
                    }
                ],
                [
                    "expo-notifications",
                    {
                        icon: "./assets/icons/notification.png",
                        color: "#4CAF50",
                        // sounds: ["./assets/notification.wav"],
                        mode: "development" // or "production"
                    }
                ],
                [
                    "@react-native-voice/voice",
                    {
                        microphonePermission: "CUSTOM: FarmLink needs microphone access for voice commands to search products and add items to cart.",
                        speechRecognitionPermission: "CUSTOM: FarmLink uses speech recognition to process your voice commands for easier shopping."
                    }
                ]
            ],
            assetBundlePatterns: [
                "assets/fonts/*",
                "assets/images/*",
                "assets/icons/*"
            ],
            experiments: {
                typedRoutes: true,
            },
            extra: {
                eas: {
                    projectId: process.env.EXPO_PROJECT_ID || "a41102c3-6cc4-4134-a832-4a6db668c1b2"
                },
                STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_51RbVKCR2koWNU5mYXZLTBS8F2QFV6BNavZXTeL8vi2W84bBMncWqogZCYDdOKZxsLF3sqkOqytjofCnFzk3DTCB100zbpCFyuk",
                MERCHANT_IDENTIFIER: process.env.MERCHANT_IDENTIFIER || "",
                API_BASE_URL: process.env.API_BASE_URL || "https://farmlink-bmiy.onrender.com",
            },
            owner: "imfestudio",
        },
    };


//////////////////////////////////////


import { useEffect, useState, useContext, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TextInput,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import FloatingActionButton from '@/components/ui/FloatingActionButton'; // Updated with voice
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: Array<{
        id: number;
        unit: string;
        customer_type: 'individual' | 'business';
        price_per_unit: number;
        quantity_available: number;
        minimum_order: number;
    }>;
    created_at: string;
}

interface SearchFilters {
    search: string;
    category: string;
    district: string;
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

const categories = [
    { value: '', label: 'all categories' },
    { value: 'fruits', label: 'fruits' },
    { value: 'vegetables', label: 'vegetables' }
];

export default function ProductsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [districts, setDistricts] = useState<string[]>([]);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({
        search: '',
        category: '',
        district: ''
    });
    const [pagination, setPagination] = useState({
        offset: 0,
        limit: 20,
        hasMore: true,
        total: 0
    });
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

    // Voice input handlers
    const handleVoiceResult = (data: any) => {
        if (data?.searchTerm) {
            setSearchText(data.searchTerm);
        }
        if (data?.products) {
            showAlert(
                'success',
                'Voice Search',
                `Found ${data.products.length} products matching your search.`,
                [{ text: 'OK', onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    // Debounce search function
    const debounceSearch = useCallback(
        (() => {
            let timeoutId: number;
            return (searchValue: string) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    setActiveFilters(prev => ({ ...prev, search: searchValue }));
                }, 500);
            };
        })(),
        []
    );

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

        // Set initial search term from voice command or navigation params
        if (params.searchTerm) {
            setSearchText(params.searchTerm as string);
        }

        // Load initial data
        fetchAllDistricts();
        fetchProducts(true);

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user, params.searchTerm]);

    // Trigger search when activeFilters change
    useEffect(() => {
        if (!loading) {
            fetchProducts(true);
        }
    }, [activeFilters]);

    // Handle search text changes with debouncing
    useEffect(() => {
        debounceSearch(searchText);
    }, [searchText, debounceSearch]);

    // Fetch all districts separately to keep them persistent
    const fetchAllDistricts = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await api.get('/browse/districts', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const allDistricts = response.data.map((d: any) => d.district).sort();

            setDistricts(allDistricts);
        } catch (error) {
            console.error('Error fetching districts:', error);
        }
    };

    const buildSearchParams = (isNewSearch: boolean = false) => {
        const params = new URLSearchParams();

        if (activeFilters.search) params.append('search', activeFilters.search);
        if (activeFilters.category) params.append('category', activeFilters.category);
        if (activeFilters.district) params.append('district', activeFilters.district);

        params.append('limit', pagination.limit.toString());
        params.append('offset', isNewSearch ? '0' : pagination.offset.toString());

        return params.toString();
    };

    const fetchProducts = async (isNewSearch: boolean = false) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            if (isNewSearch) {
                setLoading(products.length === 0); // Only show loading spinner on initial load
            } else {
                setLoadingMore(true);
            }

            const searchParams = buildSearchParams(isNewSearch);
            const response = await api.get(`/browse/products/search?${searchParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const newProducts = response.data.items || [];

            if (isNewSearch) {
                setProducts(newProducts);
                setPagination(prev => ({
                    ...prev,
                    offset: newProducts.length,
                    hasMore: response.data.has_next || false,
                    total: response.data.total || 0
                }));
            } else {
                setProducts(prev => [...prev, ...newProducts]);
                setPagination(prev => ({
                    ...prev,
                    offset: prev.offset + newProducts.length,
                    hasMore: response.data.has_next || false
                }));
            }

        } catch (error: any) {
            console.error('Error fetching products:', error);
            showAlert(
                'error',
                'error',
                'failed to load products',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleCategoryFilter = (category: string) => {
        setActiveFilters(prev => ({ ...prev, category }));
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleDistrictFilter = (district: string) => {
        setActiveFilters(prev => ({ ...prev, district }));
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleClearFilters = () => {
        setSearchText('');
        setActiveFilters({
            search: '',
            category: '',
            district: ''
        });
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAllDistricts();
        fetchProducts(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && pagination.hasMore) {
            fetchProducts(false);
        }
    };

    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((products.length - 1) / numColumns);

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

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View className="py-4">
                <ActivityIndicator size="small" color="#4CAF50" />
            </View>
        );
    };

    const CategoryFilter = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18 }}
            className="mb-4"
        >
            {categories.map((category) => (
                <TouchableOpacity
                    key={category.value}
                    onPress={() => handleCategoryFilter(category.value)}
                    className={`mr-3 px-4 py-2 rounded-full ${
                        activeFilters.category === category.value
                            ? 'bg-background'
                            : 'bg-gray-100 border border-gray-100'
                    }`}
                    activeOpacity={0.7}
                >
                    <Text className={`text-sm font-medium ${
                        activeFilters.category === category.value ? 'text-black' : 'text-gray-600'
                    }`}>
                        {category.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const DistrictFilter = () => {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 18 }}
                className="mb-4"
            >
                <TouchableOpacity
                    onPress={() => handleDistrictFilter('')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                        activeFilters.district === ''
                            ? 'bg-background'
                            : 'bg-gray-100 border border-gray-100'
                    }`}
                    activeOpacity={0.7}
                >
                    <Text className={`text-sm font-medium ${
                        activeFilters.district === '' ? 'text-black' : 'text-gray-600'
                    }`}>
                        all districts
                    </Text>
                </TouchableOpacity>

                {districts.map((district) => {
                    return (
                        <TouchableOpacity
                            key={district}
                            onPress={() => handleDistrictFilter(district)}
                            className={`mr-3 px-4 py-2 rounded-full ${
                                activeFilters.district === district
                                    ? 'bg-background'
                                    : 'bg-gray-100 border border-gray-100'
                            }`}
                            activeOpacity={0.7}
                        >
                            <Text className={`text-sm font-medium ${
                                activeFilters.district === district ? 'text-black' : 'text-gray-600'
                            }`}>
                                {district.toLowerCase()}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        );
    };

    const EmptyProductsComponent = () => (
        <View className="flex-1 justify-center items-center px-6 py-20">
            <Text className="text-xl font-medium text-black mb-2 text-center">
                no products found
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                {searchText || activeFilters.category || activeFilters.district
                    ? 'try adjusting your search or filters'
                    : 'no products are currently available'
                }
            </Text>
            {(searchText || activeFilters.category || activeFilters.district) && (
                <TouchableOpacity
                    onPress={handleClearFilters}
                    className="bg-action-green px-6 py-3 rounded-xl"
                    activeOpacity={0.7}
                >
                    <Text className="text-white font-medium">
                        clear filters
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="products"
                    showBackButton={true}
                    showCartButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading products...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="products"
                showBackButton={true}
                showCartButton={true}
                showOrdersButton={true}
                showHomeButton={true}
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
                {/* Search Bar */}
                <View className="px-5 pt-6 pb-4">
                    <View className="mb-4">
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                            <Ionicons name="search" size={20} color="#666666" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="search products..."
                                className="flex-1 ml-3 text-base text-black leading-[1.2]"
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {searchText && (
                                <TouchableOpacity
                                    onPress={handleClearFilters}
                                    className="ml-2 p-1"
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="close-circle" size={20} color="#666666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Voice Command Hint */}
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <View className="flex-row items-center">
                            <Ionicons name="mic" size={16} color="#2563eb" />
                            <Text className="text-blue-700 text-sm font-medium ml-2">
                                did you know?
                            </Text>
                        </View>
                        <Text className="text-blue-600 text-xs mt-1">
                            You can use the Voice Command button as an alternative to browse, add to cart or order items.
                        </Text>
                    </View>

                    {/* Results Summary */}
                    <Text className="text-sm text-gray-600">
                        {pagination.total} product{pagination.total !== 1 ? 's' : ''} found
                        {activeFilters.search && ` for "${activeFilters.search}"`}
                        {activeFilters.category && ` in ${activeFilters.category}`}
                        {activeFilters.district && ` from ${activeFilters.district}`}
                    </Text>
                </View>

                {/* Category Filter */}
                <CategoryFilter />

                {/* District Filter */}
                <DistrictFilter />

                {/* Products Grid */}
                <View className="px-5">
                    {products.length === 0 ? (
                        <EmptyProductsComponent />
                    ) : (
                        <FlatList
                            data={products}
                            renderItem={renderProductItem}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={getNumColumns()}
                            key={getNumColumns()}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={renderFooter}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.1}
                        />
                    )}
                </View>
            </ScrollView>

            {/* Voice Command Floating Action Button */}
            <FloatingActionButton
                showVoice={true}
                onResult={handleVoiceResult}
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
    );
}


//////////////////////////////////////


// Updated Header component with notification badge + Voice Input
    import { useContext, useEffect, use } from 'react';
    import { View, Text, TouchableOpacity, Alert } from 'react-native';
    import { Ionicons } from '@expo/vector-icons';
    import { router, useFocusEffect } from 'expo-router';
    import { AuthContext } from '@/context/AuthContext';
    import { useCart } from '@/context/CartContext';
    import { useFarmerOrders } from '@/context/FarmerOrdersContext';
    import { useNotifications } from '@/context/NotificationContext';
    import VoiceInput from '@/components/ui/VoiceInput'; // NEW: Import voice input
    import { useCallback } from 'react';
    import Animated, {
        useSharedValue,
        useAnimatedStyle,
        withSpring,
        withSequence,
        withTiming,
        runOnJS
    } from 'react-native-reanimated';

    interface HeaderProps {
        title: string;
        showBackButton?: boolean;
        showCartButton?: boolean;
        showSettingsButton?: boolean;
        showLogoutButton?: boolean;
        showOrdersButton?: boolean;
        showNotificationButton?: boolean;
        showHomeButton?: boolean;
    }

    export default function Header({
                                       title,
                                       showBackButton = false,
                                       showCartButton = false,
                                       showSettingsButton = false,
                                       showLogoutButton = false,
                                       showOrdersButton = false,
                                       showNotificationButton = false,
                                       showHomeButton = false,
                                   }: HeaderProps) {
        const { logout, user } = useContext(AuthContext);
        const { cartItemCount, isFlashing, refreshCartCount } = useCart();
        const { pendingOrdersCount, refreshPendingOrdersCount } = useFarmerOrders();
        const { unreadCount, refreshNotifications } = useNotifications();

        // Animation values - ONLY for the cart badge
        const badgeScale = useSharedValue(1);
        const badgeBackgroundColor = useSharedValue(0);

        const handleBackPress = () => router.back();
        const handleCartPress = () => router.push('/(auth)/customer/cart');
        const handleSettingsPress = () => router.push('/profile');
        const handleLogout = () => logout();
        const handleNotificationPress = () => router.push('/(auth)/notifications');

        const handleHomePress = () => {
            if (user?.farmer_profile) {
                router.push('/(auth)/farmer/dashboard');
            } else {
                router.push('/(auth)/customer/homepage');
            }// Updated Header component with notification badge + Voice Input REMOVED
            import { useContext, useEffect } from 'react';
            import { View, Text, TouchableOpacity } from 'react-native';
            import { Ionicons } from '@expo/vector-icons';
            import { router, useFocusEffect } from 'expo-router';
            import { AuthContext } from '@/context/AuthContext';
            import { useCart } from '@/context/CartContext';
            import { useFarmerOrders } from '@/context/FarmerOrdersContext';
            import { useNotifications } from '@/context/NotificationContext';
            import { useCallback } from 'react';
            import Animated, {
                useSharedValue,
                useAnimatedStyle,
                withSpring,
                withSequence,
                withTiming,
                runOnJS
            } from 'react-native-reanimated';

            interface HeaderProps {
                title: string;
                showBackButton?: boolean;
                showCartButton?: boolean;
                showSettingsButton?: boolean;
                showLogoutButton?: boolean;
                showOrdersButton?: boolean;
                showNotificationButton?: boolean;
                showHomeButton?: boolean;
            }

            export default function Header({
                                               title,
                                               showBackButton = false,
                                               showCartButton = false,
                                               showSettingsButton = false,
                                               showLogoutButton = false,
                                               showOrdersButton = false,
                                               showNotificationButton = false,
                                               showHomeButton = false,
                                           }: HeaderProps) {
                const { logout, user } = useContext(AuthContext);
                const { cartItemCount, isFlashing, refreshCartCount } = useCart();
                const { pendingOrdersCount, refreshPendingOrdersCount } = useFarmerOrders();
                const { unreadCount, refreshNotifications } = useNotifications();

                // Animation values - ONLY for the cart badge
                const badgeScale = useSharedValue(1);
                const badgeBackgroundColor = useSharedValue(0);

                const handleBackPress = () => router.back();
                const handleCartPress = () => router.push('/(auth)/customer/cart');
                const handleSettingsPress = () => router.push('/profile');
                const handleLogout = () => logout();
                const handleNotificationPress = () => router.push('/(auth)/notifications');

                const handleHomePress = () => {
                    if (user?.farmer_profile) {
                        router.push('/(auth)/farmer/dashboard');
                    } else {
                        router.push('/(auth)/customer/homepage');
                    }
                }

                const handleOrdersPress = () => {
                    if (user?.farmer_profile) {
                        router.push('/(auth)/farmer/orders');
                    } else {
                        router.push('/(auth)/customer/orders');
                    }
                }

                // Refresh counts when screen comes into focus
                useFocusEffect(
                    useCallback(() => {
                        // Only refresh counts when on specific screens that need real-time updates
                        const shouldRefreshFarmerOrders = user?.role === 'farmer' && showOrdersButton &&
                            (title === 'dashboard' || title === 'my orders');

                        const shouldRefreshNotifications = showNotificationButton &&
                            (title === 'notifications' || title === 'dashboard' || title === 'farmlink');

                        if (shouldRefreshFarmerOrders) {
                            refreshPendingOrdersCount();
                        }

                        if (shouldRefreshNotifications) {
                            refreshNotifications();
                        }
                    }, [user?.role, showOrdersButton, showNotificationButton, title]) // Added title dependency
                );

                // Animated styles for cart badge ONLY
                const animatedBadgeStyle = useAnimatedStyle(() => {
                    return {
                        transform: [{ scale: badgeScale.value }],
                        backgroundColor: `rgba(239, 68, 68, ${1 - badgeBackgroundColor.value * 0.5})`,
                    };
                });

                // Trigger flash animation when isFlashing changes
                useEffect(() => {
                    if (isFlashing) {
                        badgeScale.value = withSequence(
                            withSpring(1.3, { damping: 8, stiffness: 200 }),
                            withSpring(1, { damping: 8, stiffness: 200 })
                        );

                        badgeBackgroundColor.value = withSequence(
                            withTiming(1, { duration: 150 }),
                            withTiming(0, { duration: 150 }),
                            withTiming(1, { duration: 150 }),
                            withTiming(0, { duration: 150 })
                        );

                        setTimeout(() => {
                            runOnJS(refreshCartCount)();
                        }, 100);
                    }
                }, [isFlashing]);

                return (
                    <View className="bg-background rounded-bl-[40px] rounded-br-[40px]" style={{ height: '20%' }}>
                        <View className="pl-6 pr-6 justify-end h-full pb-5">
                            <View className="flex-row justify-between items-center">
                                <Text className="text-2xl font-semibold text-black">
                                    {title.toLowerCase()}
                                </Text>
                                <View className="flex-row items-center gap-5">
                                    {showHomeButton && (
                                        <TouchableOpacity
                                            onPress={handleHomePress}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="home-sharp"
                                                size={20}
                                                color="#000000"
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {showNotificationButton && (
                                        <TouchableOpacity
                                            onPress={handleNotificationPress}
                                            activeOpacity={0.7}
                                            className="relative"
                                        >
                                            <Ionicons
                                                name="notifications"
                                                size={20}
                                                color="#000000"
                                            />

                                            {/* Notification Badge */}
                                            {unreadCount > 0 && (
                                                <View
                                                    style={{
                                                        position: 'absolute',
                                                        top: -8,
                                                        right: -8,
                                                        backgroundColor: '#ef4444', // red-500
                                                        borderRadius: 10,
                                                        minWidth: 20,
                                                        height: 20,
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        borderWidth: 2,
                                                        borderColor: '#ffffff',
                                                    }}
                                                >
                                                    <Text
                                                        className="text-white text-xs font-bold"
                                                        style={{
                                                            fontSize: unreadCount > 99 ? 8 : 10,
                                                            lineHeight: unreadCount > 99 ? 10 : 12
                                                        }}
                                                    >
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {showCartButton && (
                                        <TouchableOpacity
                                            onPress={handleCartPress}
                                            activeOpacity={0.7}
                                            className="relative"
                                        >
                                            <Ionicons
                                                name="cart"
                                                size={20}
                                                color="#000000"
                                            />

                                            {cartItemCount > 0 && (
                                                <Animated.View
                                                    style={[
                                                        {
                                                            position: 'absolute',
                                                            top: -8,
                                                            right: -8,
                                                            borderRadius: 10,
                                                            minWidth: 20,
                                                            height: 20,
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            borderWidth: 2,
                                                            borderColor: '#ffffff',
                                                        },
                                                        animatedBadgeStyle
                                                    ]}
                                                >
                                                    <Text
                                                        className="text-white text-xs font-bold"
                                                        style={{
                                                            fontSize: cartItemCount > 99 ? 8 : 10,
                                                            lineHeight: cartItemCount > 99 ? 10 : 12
                                                        }}
                                                    >
                                                        {cartItemCount > 99 ? '99+' : cartItemCount}
                                                    </Text>
                                                </Animated.View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {showOrdersButton && user?.role === 'farmer' && (
                                        <TouchableOpacity
                                            onPress={handleOrdersPress}
                                            activeOpacity={0.7}
                                            className="relative"
                                        >
                                            <Ionicons
                                                name="receipt"
                                                size={20}
                                                color="#000000"
                                            />

                                            {pendingOrdersCount > 0 && (
                                                <View
                                                    style={{
                                                        position: 'absolute',
                                                        top: -8,
                                                        right: -8,
                                                        backgroundColor: '#f59e0b', // amber-500
                                                        borderRadius: 10,
                                                        minWidth: 20,
                                                        height: 20,
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        borderWidth: 2,
                                                        borderColor: '#ffffff',
                                                    }}
                                                >
                                                    <Text
                                                        className="text-white text-xs font-bold"
                                                        style={{
                                                            fontSize: pendingOrdersCount > 99 ? 8 : 10,
                                                            lineHeight: pendingOrdersCount > 99 ? 10 : 12
                                                        }}
                                                    >
                                                        {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {showOrdersButton && user?.role !== 'farmer' && (
                                        <TouchableOpacity
                                            onPress={handleOrdersPress}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="receipt"
                                                size={20}
                                                color="#000000"
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {showSettingsButton && (
                                        <TouchableOpacity
                                            onPress={handleSettingsPress}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="settings"
                                                size={20}
                                                color="#000000"
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {showBackButton && (
                                        <TouchableOpacity
                                            onPress={handleBackPress}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="arrow-back-sharp"
                                                size={20}
                                                color="#000000"
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {showLogoutButton && (
                                        <TouchableOpacity
                                            onPress={handleLogout}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="log-out"
                                                size={20}
                                                color="#000000"
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                );
            }


//////////////////////////////////////


// Updated FloatingActionButton with Voice Command for customers
    import { TouchableOpacity, Alert } from 'react-native';
    import { Ionicons } from '@expo/vector-icons';
    import { useContext } from 'react';
    import { AuthContext } from '@/context/AuthContext';
    import { useRouter } from 'expo-router';
    import VoiceInput from '@/components/ui/VoiceInput';

    interface FloatingActionButtonProps {
        onPress?: () => void;
        icon?: string;
        size?: number;
        backgroundColor?: string;
        iconColor?: string;
        showVoice?: boolean; // NEW: Option to show voice instead of default action
        onResult?: (data: any) => void; // NEW: Voice result handler
        onError?: (error: string) => void; // NEW: Voice error handler
    }

    export default function FloatingActionButton({
                                                     onPress,
                                                     icon = 'add',
                                                     size = 56,
                                                     backgroundColor = '#EAF3D0',
                                                     iconColor = '#000000',
                                                     showVoice = false,
                                                     onResult,
                                                     onError
                                                 }: FloatingActionButtonProps) {
        const { user } = useContext(AuthContext);
        const router = useRouter();

        // Check if should show voice button (only for customers)
        const isCustomer = user?.role === 'individual' || user?.role === 'business';
        const shouldShowVoice = showVoice && isCustomer;

        // Default voice input handlers if not provided
        const handleVoiceResult = onResult || ((data: any) => {
            if (data?.products) {
                // Navigate to products page with search results
                router.push({
                    pathname: '/(auth)/customer/products',
                    params: { searchTerm: data.searchTerm || '' }
                });
            }
        });

        const handleVoiceError = onError || ((error: string) => {
            Alert.alert('Voice Command Error', error);
        });

        if (shouldShowVoice) {
            // Return voice input component styled as floating button
            return (
                <VoiceInput
                    onResult={handleVoiceResult}
                    onError={handleVoiceError}
                    style={{
                        position: 'absolute',
                        bottom: 24,
                        right: 24,
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: '#EAF3D0',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                    }}
                    iconSize={size * 0.4}
                    iconColor="black"
                />
            );
        }

        // Default floating action button (for farmers or when voice is disabled)
        return (
            <TouchableOpacity
                onPress={onPress}
                className="absolute bottom-6 right-6 rounded-full shadow-lg elevation-8"
                style={{
                    width: size,
                    height: size,
                    backgroundColor,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                activeOpacity={0.8}
            >
                <Ionicons
                    name={icon as any}
                    size={size * 0.4}
                    color={iconColor}
                />
            </TouchableOpacity>
        );
    }