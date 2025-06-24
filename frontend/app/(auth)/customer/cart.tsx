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
import { useTranslation } from '@/context/LanguageContext';
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
    const { tCart } = useTranslation();
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
                tCart('updated'),
                tCart('itemQuantityUpdated')
            );
        } catch (error: any) {
            console.error('Error updating item:', error);
            showAlert(
                'error',
                tCart('updateFailed'),
                error.response?.data?.detail || tCart('failedToUpdateQuantity')
            );
        } finally {
            setUpdatingItem(null);
        }
    };

    const removeItem = async (itemId: number) => {
        showAlert(
            'warning',
            tCart('removeItem'),
            tCart('removeItemConfirm'),
            [
                { text: tCart('cancel'), onPress: hideAlert, style: 'cancel' },
                {
                    text: tCart('remove'),
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
                                tCart('removed'),
                                tCart('itemRemovedFromCart')
                            );
                        } catch (error: any) {
                            console.error('Error removing item:', error);
                            showAlert(
                                'error',
                                tCart('removeFailed'),
                                tCart('failedToRemoveItem')
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
                tCart('emptyCart'),
                tCart('addItemsBeforeCheckout')
            );
            return;
        }

        router.push('/(auth)/customer/checkout');
    };

    const handleIngredientsAdded = useCallback(async () => {
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

                    <View className="flex-1">
                        <Text className="text-base font-medium text-black mb-1">
                            {item.product_name.toLowerCase() || tCart('unknownProduct')}
                        </Text>
                    </View>

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
                            rs {formatPrice(item.unit_price_snapshot)} {tCart('perUnit', { unit: item.unit_name || 'unit' })}
                        </Text>
                    </View>

                    <Text className="text-xs font-semibold text-black mr-2">
                        rs {formatPrice(item.total_price)}
                    </Text>

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
            <View className="bg-gray-100 px-4 py-3 flex-row items-center justify-between">
                <View className="flex-1">
                    <Text className="text-lg font-semibold text-black mb-1">
                        {group.farmer_name || tCart('unknownFarmer')}
                    </Text>
                    <View className="flex-row items-center">
                        <Ionicons name="location-outline" size={14} color="#666666" />
                        <Text className="text-sm text-gray-600 ml-1">
                            {group.farmer_district || tCart('unknownDistrict')}
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

            <View>
                {group.items.map(renderCartItem)}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title={tCart('myCart')}
                    showBackButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tCart('loadingCart')}</Text>
                </View>
            </View>
        );
    }

    const isEmpty = !cart || cart.farmer_groups.length === 0;

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={tCart('myCart')}
                showBackButton={true}
                showHomeButton={true}
                showOrdersButton={true}
                showNotificationButton={true}
            />

            {isEmpty ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="basket-outline" size={64} color="#d1d5db" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        {tCart('cartIsEmpty')}
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        {tCart('browseProductsDescription')}
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
                    {user?.role === 'business' && (
                        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <View className="flex-row items-center">
                                <Ionicons name="business-outline" size={20} color="#2563eb" />
                                <Text className="text-blue-700 text-sm font-medium ml-2">
                                    {tCart('businessBulkPricing')}
                                </Text>
                            </View>
                            <Text className="text-blue-600 text-xs mt-1">
                                {tCart('wholesalePrices')}
                            </Text>
                        </View>
                    )}

                    {cart.farmer_groups.map(renderFarmerGroup)}

                    <RecipeSuggestions
                        cartItems={getCartItemsForAI()}
                        customerType={user?.role as 'individual' | 'business'}
                        onIngredientsAdded={handleIngredientsAdded}
                        onAlert={showAlert}
                    />

                    <View className="bg-white rounded-xl p-2 mt-4 mb-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-sm text-gray-600">{tCart('totalAmount')}</Text>
                                <Text className="text-2xl font-bold text-black">
                                    rs {formatPrice(cart.total_amount)}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-sm text-gray-600">
                                    {cart.total_items} {cart.total_items !== 1 ? tCart('items') : tCart('item')}
                                </Text>
                                <Text className="text-sm text-gray-600">
                                    {cart.farmer_groups.length} {cart.farmer_groups.length !== 1 ? tCart('farmers') : tCart('farmer')}
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
                                {processingCheckout ? tCart('processing') : tCart('checkout')}
                            </Text>
                        </TouchableOpacity>
                    </View>
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