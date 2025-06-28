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
import { useTranslation } from '@/context/LanguageContext';
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
    status: OrderStatus; // Overall order status
    final_amount: number;
    farmer_count?: number;
    item_count: number;
    created_at: string;
    items?: OrderItem[];
}

interface OrderDetails {
    id: number;
    order_number: string;
    status: OrderStatus; // Overall order status
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
    delivered_at?: string;
}

interface FarmerStatuses {
    [farmerId: number]: FarmerStatus;
}

export default function OrdersScreen() {
    const { user } = useContext(AuthContext);
    const router = useRouter();
    const { t, tOrders } = useTranslation();
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

            const orderResponse = await api.get(`/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrderDetails(prev => ({
                ...prev,
                [orderId]: orderResponse.data
            }));

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
            Animated.timing(animationValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                newExpanded.delete(orderId);
                setExpandedOrders(new Set(newExpanded));
            });
        } else {
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
                return '#3b82f6';
            case 'processing':
                return '#f59e0b';
            case 'out_for_delivery':
                return '#8b5cf6';
            case 'delivered':
                return '#10b981';
            case 'cancelled':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    const getStatusText = (status: OrderStatus): string => {
        return tOrders(status);
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

                <View className="flex-1">
                    <Text className="text-sm font-medium text-black">
                        {item.item_name || tOrders('unknownProduct')}
                    </Text>
                    <Text className="text-xs text-gray-600">
                        {item.quantity} {item.unit} × rs {formatPrice(item.unit_price)}
                    </Text>
                </View>

                <Text className="text-sm font-semibold text-black">
                    rs {formatPrice(item.total_price)}
                </Text>
            </View>
        );
    };

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
                farmer_name: farmerStatus?.farmer_name || tOrders('unknownFarmer'),
                farmer_district: farmerStatus?.farmer_district || tOrders('unknownDistrict'),
                status: farmerStatus?.status || 'confirmed',
                delivered_at: farmerStatus?.delivered_at
            };
        });
    };

    const getOrderType = (order: Order) => {
        const details = orderDetails[order.id];
        if (!details) return { isMultiFarmer: false, farmerCount: order.farmer_count || 1 };

        const farmerIds = new Set(details.items.map(item => item.farmer_id));
        return {
            isMultiFarmer: farmerIds.size > 1,
            farmerCount: farmerIds.size
        };
    };

    const renderOrder = (order: Order) => {
        const isExpanded = expandedOrders.has(order.id);
        const details = orderDetails[order.id];
        const isLoadingDetails = loadingOrderDetails.has(order.id);
        const animationValue = getAnimationValue(order.id);
        const { isMultiFarmer, farmerCount } = getOrderType(order);

        return (
            <View key={order.id} className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-200">
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
                            {farmerCount > 1 ? (
                                <View className="px-3 py-1 rounded-full mb-1 bg-gray-100">
                                    <View className="flex-row items-center">
                                        <Text className="text-xs font-medium text-gray-500 mr-1">
                                            {tOrders('expand')}
                                        </Text>
                                        <Ionicons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={12}
                                            color="#6b7280"
                                        />
                                    </View>
                                </View>
                            ) : (
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
                            )}

                            <Text className="text-lg font-bold text-black">
                                rs {formatPrice(order.final_amount)}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-600">
                            {order.item_count} {order.item_count !== 1 ? tOrders('items') : tOrders('item')}
                        </Text>
                        <Text className="text-sm text-gray-600">
                            {farmerCount} {farmerCount !== 1 ? tOrders('farmers') : tOrders('farmer')}
                        </Text>
                    </View>
                </TouchableOpacity>

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
                                <Text className="text-gray-600 mt-2 text-sm">{tOrders('loadingOrderDetails')}</Text>
                            </View>
                        ) : details ? (
                            <View className="p-4">
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">{tOrders('deliveryAddress')}</Text>
                                    <Text className="text-sm text-gray-600">{details.delivery_address}</Text>
                                    {details.delivery_notes && (
                                        <Text className="text-sm text-gray-500 mt-1">
                                            {tOrders('note')}: {details.delivery_notes}
                                        </Text>
                                    )}
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-3">
                                        {isMultiFarmer ? tOrders('orderItemsByFarmer') : tOrders('orderItems')}
                                    </Text>

                                    {groupItemsByFarmer(details.items, order.id).map((farmerGroup, index) => (
                                        <View key={farmerGroup.farmer_id} className="mb-4 last:mb-0">
                                            <View className="bg-gray-50 rounded-lg p-3 mb-2">
                                                <View className="flex-row items-center justify-between mb-2">
                                                    <View className="flex-1">
                                                        <Text className="text-sm font-medium text-black">
                                                            {farmerGroup.farmer_name}
                                                        </Text>
                                                        <View className="flex-row items-center mt-1">
                                                            <Ionicons name="location-outline" size={12} color="#666666" />
                                                            <Text className="text-xs text-gray-600 ml-1">
                                                                {farmerGroup.farmer_district}
                                                            </Text>
                                                        </View>
                                                    </View>

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
                                                        {farmerGroup.delivered_at && (
                                                            <Text className="text-xs text-green-600 mt-1">
                                                                {tOrders('deliveredAt')}: {formatDate(farmerGroup.delivered_at)}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>

                                            <View className="bg-white border border-gray-100 rounded-lg p-3">
                                                {farmerGroup.items.map(renderOrderItem)}
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                <View className="bg-gray-50 rounded-lg p-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">{tOrders('subtotal')}</Text>
                                        <Text className="text-sm text-black">rs {formatPrice(details.total_amount)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-gray-600">{tOrders('deliveryFee')}</Text>
                                        <Text className="text-sm text-black">rs {formatPrice(details.delivery_fee)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-200">
                                        <Text className="text-base font-semibold text-black">{tOrders('total')}</Text>
                                        <Text className="text-base font-bold text-black">rs {formatPrice(details.final_amount)}</Text>
                                    </View>
                                    {details.delivered_at && (
                                        <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-200">
                                            <Text className="text-sm text-green-600">{tOrders('orderDeliveredAt')}</Text>
                                            <Text className="text-sm text-green-600">{formatDate(details.delivered_at)}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View className="p-4">
                                <Text className="text-gray-500 text-sm text-center">{tOrders('failedToLoadDetails')}</Text>
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
                    title={tOrders('myOrders')}
                    showBackButton={true}
                    showNotificationButton={true}
                    showHomeButton={true}
                    showCartButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tOrders('loadingOrders')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={tOrders('myOrders')}
                showBackButton={true}
                showNotificationButton={true}
                showHomeButton={true}
                showCartButton={true}
            />

            {orders.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
                    <Text className="text-lg font-medium text-black mt-4 mb-2">
                        {tOrders('noOrdersYet')}
                    </Text>
                    <Text className="text-gray-600 text-center mb-8 text-sm">
                        {tOrders('firstOrderAppear')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/(auth)/customer/products')}
                        className="bg-background px-8 py-4 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-black font-medium text-sm">
                            {tOrders('browseProducts')}
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