import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import CartFarmerGroup from '@/components/customer/CartFarmerGroup';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

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
    id: number;
    farmer_groups: FarmerGroup[];
    total_amount: number;
    total_items: number;
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
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());
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
        fetchCart();
    }, [user]);

    const fetchCart = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCart(response.data);
        } catch (error: any) {
            console.error('Error fetching cart:', error);
            showAlert(
                'error',
                'error',
                'failed to load cart',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCart();
    };

    const handleUpdateQuantity = async (itemId: number, newQuantity: number) => {
        setUpdatingItems(prev => new Set([...prev, itemId]));

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.put(`/orders/cart/items/${itemId}`, {
                quantity: newQuantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state
            if (cart) {
                const updatedCart = { ...cart };
                updatedCart.farmer_groups = updatedCart.farmer_groups.map(group => ({
                    ...group,
                    items: group.items.map(item => {
                        if (item.id === itemId) {
                            const updatedItem = { ...item, quantity: newQuantity };
                            updatedItem.total_price = updatedItem.unit_price_snapshot * newQuantity;
                            return updatedItem;
                        }
                        return item;
                    })
                }));

                // Recalculate totals
                updatedCart.total_amount = updatedCart.farmer_groups.reduce(
                    (total, group) => total + group.items.reduce((groupTotal, item) => groupTotal + item.total_price, 0),
                    0
                );

                // Update subtotals
                updatedCart.farmer_groups = updatedCart.farmer_groups.map(group => ({
                    ...group,
                    subtotal: group.items.reduce((total, item) => total + item.total_price, 0)
                }));

                setCart(updatedCart);
            }

        } catch (error: any) {
            console.error('Error updating quantity:', error);
            showAlert(
                'error',
                'error',
                error.response?.data?.detail || 'failed to update quantity',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setUpdatingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
        }
    };

    const handleRemoveItem = async (itemId: number) => {
        Alert.alert(
            'Remove Item',
            'Are you sure you want to remove this item from your cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) return;

                            await api.delete(`/orders/cart/items/${itemId}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            // Refresh cart
                            fetchCart();

                        } catch (error: any) {
                            console.error('Error removing item:', error);
                            showAlert(
                                'error',
                                'error',
                                'failed to remove item',
                                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
                            );
                        }
                    }
                }
            ]
        );
    };

    const handleCheckoutFarmer = (farmerGroup: FarmerGroup) => {
        router.push({
            pathname: '/customer/checkout',
            params: { farmerId: farmerGroup.farmer_id }
        });
    };

    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items from your cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) return;

                            await api.delete('/orders/cart', {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            fetchCart();

                        } catch (error: any) {
                            console.error('Error clearing cart:', error);
                            showAlert(
                                'error',
                                'error',
                                'failed to clear cart',
                                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
                            );
                        }
                    }
                }
            ]
        );
    };

    const EmptyCartComponent = () => (
        <View className="flex-1 justify-center items-center px-6">
            <Text className="text-6xl mb-4">🛒</Text>
            <Text className="text-xl font-medium text-black mb-2 text-center">
                your cart is empty
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                start shopping to add fresh produce from local farmers
            </Text>
            <TouchableOpacity
                onPress={() => router.push('/customer/products')}
                className="bg-action-green px-6 py-3 rounded-xl"
                activeOpacity={0.7}
            >
                <Text className="text-white font-medium">
                    browse products
                </Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="cart"
                    showBackButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading cart...</Text>
                </View>
            </View>
        );
    }

    const hasItems = cart && cart.farmer_groups.length > 0;

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="cart"
                showBackButton={true}
            />

            {!hasItems ? (
                <EmptyCartComponent />
            ) : (
                <>
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
                        contentContainerStyle={{ paddingBottom: 120 }}
                    >
                        {/* Cart Header */}
                        <View className="px-6 pt-6 pb-4">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-xl font-medium text-black">
                                    your cart
                                </Text>
                                <TouchableOpacity
                                    onPress={handleClearCart}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-sm text-red-600 font-medium">
                                        clear all
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text className="text-base text-gray-600">
                                {cart?.total_items} item{cart?.total_items !== 1 ? 's' : ''} from {cart?.farmer_groups.length} farmer{cart?.farmer_groups.length !== 1 ? 's' : ''}
                            </Text>
                        </View>

                        {/* Farmer Groups */}
                        {cart?.farmer_groups.map((farmerGroup, index) => (
                            <View key={farmerGroup.farmer_id} className="mb-6">
                                <CartFarmerGroup
                                    farmerGroup={farmerGroup}
                                    onUpdateQuantity={handleUpdateQuantity}
                                    onRemoveItem={handleRemoveItem}
                                    onCheckout={() => handleCheckoutFarmer(farmerGroup)}
                                    updatingItems={updatingItems}
                                />
                            </View>
                        ))}

                        {/* Important Note */}
                        <View className="mx-6 p-4 bg-light-100 rounded-xl">
                            <View className="flex-row items-start">
                                <Ionicons name="information-circle" size={20} color="#4CAF50" />
                                <Text className="text-sm text-gray-700 ml-2 flex-1">
                                    orders are processed separately for each farmer. you&#39;ll need to checkout individually for each farmer's products.
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Cart Summary Footer */}
                    <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-gray-200 p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-medium text-black">
                                total amount
                            </Text>
                            <Text className="text-xl font-semibold text-action-green">
                                rs {cart?.total_amount.toFixed(2)}
                            </Text>
                        </View>
                        <Text className="text-xs text-gray-600 text-center">
                            checkout with individual farmers to place orders
                        </Text>
                    </View>
                </>
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