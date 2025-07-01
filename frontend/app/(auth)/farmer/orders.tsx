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
import { useProductTranslations } from '@/utils/translations'; // Import our translation utility
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { getProductBackgroundColor } from '@/utils/products';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/apiService';

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

interface FarmerPayment {
    gross_amount: number;
    platform_fee: number;
    net_amount: number;
    platform_fee_percentage: number;
}

interface Order {
    id: number;
    order_number: string;
    status: OrderStatus;
    final_amount: number;
    item_count: number;
    created_at: string;
    farmer_payment?: FarmerPayment;
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
    farmer_payment?: FarmerPayment;
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
    const { t, tOrders, tCommon } = useTranslation();
    const { translateProduct, translateUnit } = useProductTranslations(); // Use our translation utilities
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

    // Helper function to convert formatted product name back to backend format for translation lookup
    const getBackendProductName = (formattedName: string): string => {
        // Convert "Green Beans" back to "green_beans" for translation lookup
        return formattedName.toLowerCase().replace(/\s+/g, '_');
    };

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

            const sortedOrders = response.data.sort((a: Order, b: Order) => {
                if (a.status === 'delivered' && b.status !== 'delivered') return 1;
                if (a.status !== 'delivered' && b.status === 'delivered') return -1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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

            const orderResponse = await api.get(`/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const orderFromList = orders.find(order => order.id === orderId);

            setOrderDetails(prev => ({
                ...prev,
                [orderId]: {
                    ...orderResponse.data,
                    farmer_payment: orderFromList?.farmer_payment || orderResponse.data.farmer_payment
                }
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

    const updateFarmerStatus = async (orderId: number, newStatus: OrderStatus) => {
        showAlert(
            'warning',
            tOrders('updateOrderStatus'),
            tOrders('changeStatusConfirm', { status: getStatusText(newStatus) }),
            [
                { text: tCommon('cancel'), style: 'cancel', onPress: hideAlert },
                {
                    text: tOrders('confirm'),
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

            await api.put(`/orders/${orderId}/farmer-status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` }}
            );

            // Update the order status in the list
            setOrders(prev => prev.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            ));

            // Update order details if loaded
            if (orderDetails[orderId]) {
                setOrderDetails(prev => ({
                    ...prev,
                    [orderId]: {
                        ...prev[orderId],
                        status: newStatus,
                        delivered_at: newStatus === 'delivered' ? new Date().toISOString() : prev[orderId].delivered_at
                    }
                }));
            }

            showAlert(
                'success',
                tOrders('statusUpdated'),
                tOrders('statusChanged', { status: getStatusText(newStatus) }),
                [{ text: tCommon('ok'), style: 'cancel', onPress: hideAlert }]
            );

        } catch (error: unknown) {
            console.error('Error updating farmer status:', error);

            let errorMessage = tOrders('failedToUpdate');

            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };
                if (axiosError.response?.status === 403) {
                    errorMessage = tOrders('noPermission');
                } else if (axiosError.response?.data?.detail) {
                    errorMessage = axiosError.response.data.detail;
                }
            }

            showAlert(
                'error',
                tOrders('updateFailed'),
                errorMessage,
                [{ text: tCommon('ok'), style: 'cancel', onPress: hideAlert }]
            );
        } finally {
            setUpdatingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
            hideAlert();
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

    const getAvailableStatusOptions = (currentStatus: OrderStatus): OrderStatus[] => {
        switch (currentStatus) {
            case 'confirmed':
                return ['processing', 'out_for_delivery', 'delivered', 'cancelled'];
            case 'processing':
                return ['out_for_delivery', 'delivered', 'cancelled'];
            case 'out_for_delivery':
                return ['delivered', 'cancelled'];
            case 'delivered':
                return [];
            case 'cancelled':
                return [];
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
                onPress={() => updateFarmerStatus(orderId, status)}
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
        // Get the backend product name for image and background color
        const backendProductName = getBackendProductName(item.item_name || '');
        const productImage = getProductImage(backendProductName);

        // Get translated names
        const translatedProductName = translateProduct(backendProductName);
        const translatedUnitName = translateUnit(item.unit, item.quantity);

        return (
            <View key={item.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0">
                <View
                    className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: getProductBackgroundColor(backendProductName) }}
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
                        {translatedProductName || tOrders('unknownProduct')}
                    </Text>
                    <Text className="text-xs text-gray-600">
                        {item.quantity} {translatedUnitName} × {translateUnit('rs')} {formatPrice(item.unit_price)}
                    </Text>
                </View>

                <Text className="text-sm font-semibold text-black">
                    {translateUnit('rs')} {formatPrice(item.total_price)}
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
                                {translateUnit('rs')} {formatPrice(order.farmer_payment?.net_amount || order.final_amount)}
                            </Text>
                        </View>
                    </View>

                    <Text className="text-sm text-gray-600">
                        {order.item_count} {order.item_count === 1 ? tOrders('item') : tOrders('items')}
                    </Text>
                </TouchableOpacity>

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
                                <Text className="text-gray-600 mt-2 text-sm">{tOrders('loadingOrderDetails')}</Text>
                            </View>
                        ) : details ? (
                            <View className="p-4">
                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">{tOrders('customerInformation')}</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        <Text className="text-sm font-medium text-black mb-1">{details.customer_name}</Text>
                                        <Text className="text-sm text-gray-600 mb-1">{details.customer_phone}</Text>
                                        <Text className="text-sm text-gray-600">{details.customer_email}</Text>
                                    </View>
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-2">{tOrders('deliveryAddress')}</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        <Text className="text-sm text-gray-600">{details.delivery_address}</Text>
                                        {details.delivery_notes && (
                                            <Text className="text-sm text-gray-500 mt-1">
                                                {tOrders('note')}: {details.delivery_notes}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                <View className="mb-4">
                                    <Text className="text-sm font-medium text-black mb-3">{tOrders('orderItems')}</Text>
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        {details.items.map(renderOrderItem)}
                                    </View>
                                </View>

                                {getAvailableStatusOptions(details.status).length > 0 && (
                                    <View className="mb-4">
                                        <Text className="text-sm font-medium text-black mb-3">
                                            {tOrders('changeOrderStatus')}
                                            {isUpdating && <Text className="text-gray-500"> ({tOrders('updating')})</Text>}
                                        </Text>
                                        <View className="flex-row flex-wrap">
                                            {getAvailableStatusOptions(details.status).map(status =>
                                                renderStatusButton(order.id, status, false)
                                            )}
                                        </View>
                                    </View>
                                )}

                                {details.farmer_payment && (
                                    <View className="bg-gray-50 rounded-lg p-3">
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-sm font-medium text-black">{tOrders('orderTotal')}</Text>
                                            <Text className="text-sm font-medium text-black">{translateUnit('rs')} {formatPrice(details.farmer_payment.gross_amount)}</Text>
                                        </View>
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-sm text-gray-600">
                                                {tOrders('platformFee')} ({details.farmer_payment.platform_fee_percentage}%)
                                            </Text>
                                            <Text className="text-sm text-red-600">- {translateUnit('rs')} {formatPrice(details.farmer_payment.platform_fee)}</Text>
                                        </View>
                                        <View className="flex-row justify-between items-center pt-2 border-t border-gray-300">
                                            <Text className="text-base font-semibold text-black">{tOrders('yourEarnings')}</Text>
                                            <Text className="text-base font-bold text-green-600">{translateUnit('rs')} {formatPrice(details.farmer_payment.net_amount)}</Text>
                                        </View>
                                    </View>
                                )}
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
            />

            {orders.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        {tOrders('noOrdersYet')}
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        {tOrders('customerOrdersAppear')}
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