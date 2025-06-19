// app/(auth)/customer/order-success.tsx
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Header from '@/components/ui/Header';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

interface FarmerGroup {
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    items: Array<{
        item_name: string;
        unit: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        description?: string;
    }>;
    subtotal: number;
}

interface OrderDetails {
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
    delivery_fee: number;
    final_amount: number;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    delivery_notes?: string;
    farmer_groups: FarmerGroup[];
    payment: {
        method: string;
        status: string;
        completed_at: string;
    };
    created_at: string;
    updated_at: string;
}

export default function OrderSuccessScreen() {
    const router = useRouter();
    const { order_id } = useLocalSearchParams();

    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!order_id) {
            router.replace('/customer/homepage');
            return;
        }

        fetchOrderDetails();
    }, [order_id]);

    const fetchOrderDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get(`/payment/orders/${order_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrder(response.data);
        } catch (error: any) {
            console.error('Error fetching order:', error);
            // If order not found, redirect to orders page
            router.replace('/customer/homepage');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'confirmed':
                return 'text-green-600 bg-green-100';
            case 'processing':
                return 'text-blue-600 bg-blue-100';
            case 'out_for_delivery':
                return 'text-orange-600 bg-orange-100';
            case 'delivered':
                return 'text-green-700 bg-green-200';
            case 'cancelled':
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').toUpperCase();
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="Order Confirmation" showBackButton={false} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">Loading order details...</Text>
                </View>
            </View>
        );
    }

    if (!order) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="Order Confirmation" showBackButton={false} />
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="alert-circle-outline" size={80} color="#ef4444" />
                    <Text className="text-xl font-medium text-black mt-4 mb-2">
                        Order Not Found
                    </Text>
                    <Text className="text-gray-600 text-center mb-8">
                        We couldn&#39;t find the order details
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.replace('/customer/homepage')}
                        className="bg-action-green px-8 py-4 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white font-medium text-lg">
                            View My Orders
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header title="Order Confirmation" showBackButton={false} />

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* Success Header */}
                <View className="items-center py-8 px-6">
                    <View className={`px-4 py-2 mb-4 rounded-full ${getStatusColor(order.status)}`}>
                        <Text className="font-medium">
                            {formatStatus(order.status)}
                        </Text>
                    </View>
                    <Text className="text-gray-600 text-center">
                        Thank you for your purchase. Your order has been successfully placed.
                    </Text>
                </View>

                <View className="px-5">
                    {/* Order Summary */}
                    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                        <Text className="text-lg font-semibold text-black mb-4">order summary</Text>

                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-gray-600">order number</Text>
                            <Text className="font-medium text-black">{order.order_number}</Text>
                        </View>

                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-gray-600">order date</Text>
                            <Text className="font-medium text-black">
                                {formatDateTime(order.created_at)}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-gray-600">payment status</Text>
                            <Text className="font-medium text-green-600 capitalize">
                                {order.payment.status.toLowerCase()}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-gray-600">total paid</Text>
                            <Text className="text-lg font-semibold text-black">
                                rs {order.final_amount.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Delivery Information */}
                    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                        <Text className="text-lg font-semibold text-black mb-4">delivery information</Text>

                        <View className="mb-4">
                            <Text className="text-sm font-medium text-gray-700 mb-2">delivery to</Text>
                            <Text className="text-black font-semibold mb-1">{order.customer_name}</Text>
                            <Text className="text-gray-600">{order.customer_phone}</Text>
                        </View>

                        <View className="mb-3">
                            <Text className="text-sm font-medium text-gray-700 mb-2">delivery address</Text>
                            <Text className="text-black font-semibold">{order.delivery_address}</Text>
                        </View>

                        {order.delivery_notes && (
                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Delivery Notes</Text>
                                <Text className="text-gray-600">{order.delivery_notes}</Text>
                            </View>
                        )}
                    </View>

                    {/* Items by Farmer */}
                    <Text className="text-xl font-semibold text-black mb-4">your order</Text>

                    {order.farmer_groups.map((group) => (
                        <View key={group.farmer_id} className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                <View>
                                    <Text className="text-lg font-medium text-black">
                                        {group.farmer_name}
                                    </Text>
                                    <View className="flex-row items-center mt-1">
                                        <Ionicons name="location-outline" size={14} color="#666666" />
                                        <Text className="text-sm text-gray-600 ml-1">
                                            {group.farmer_district}
                                        </Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="text-sm text-gray-600">subtotal</Text>
                                    <Text className="text-lg font-semibold text-black">
                                        rs {group.subtotal.toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {group.items.map((item, index) => (
                                <View key={index} className="flex-row justify-between items-start py-2">
                                    <View className="flex-1">
                                        <Text className="font-medium text-black mb-1">
                                            {item.item_name.toLowerCase()}
                                        </Text>
                                        <Text className="text-sm text-gray-600">
                                            {item.quantity} {item.unit} × rs {item.unit_price.toFixed(2)}
                                        </Text>
                                        {item.description && (
                                            <Text className="text-xs text-gray-500 mt-1">
                                                {item.description}
                                            </Text>
                                        )}
                                    </View>
                                    <Text className="font-medium text-black ml-4">
                                        rs {item.total_price.toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ))}

                    {/* Payment Breakdown */}
                    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                        <Text className="text-lg font-medium text-black mb-4">payment breakdown</Text>

                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-gray-600">subtotal</Text>
                            <Text className="font-medium">rs {order.total_amount.toFixed(2)}</Text>
                        </View>

                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-gray-600">delivery fee</Text>
                            <Text className="font-medium">rs {order.delivery_fee.toFixed(2)}</Text>
                        </View>

                        <View className="flex-row justify-between items-center py-3 border-t border-gray-200">
                            <Text className="text-lg font-semibold text-black">total paid</Text>
                            <Text className="text-xl font-bold text-black">
                                rs {order.final_amount.toFixed(2)}
                            </Text>
                        </View>

                        <View className="flex-row items-center mt-3 p-3 bg-green-50 rounded-lg">
                            <Ionicons name="card-outline" size={20} color="#4CAF50" />
                            <Text className="text-sm text-green-700 ml-2">
                                paid via {order.payment.method.replace('stripe_', '').replace('_', ' ')}
                            </Text>
                        </View>
                    </View>

                    {/* What's Next */}
                    <View className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                        <Text className="text-lg font-medium text-blue-900 mb-3">what&#39;s next?</Text>

                        <View className="flex-row items-start mb-3">
                            <View className="w-6 h-6 bg-blue-200 rounded-full items-center justify-center mr-3 mt-0.5">
                                <Text className="text-xs font-bold text-blue-600">1</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-medium text-blue-900 mb-1">order confirmation</Text>
                                <Text className="text-sm text-blue-700">
                                    Farmers will receive your order and start preparing your items
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-start mb-3">
                            <View className="w-6 h-6 bg-blue-200 rounded-full items-center justify-center mr-3 mt-0.5">
                                <Text className="text-xs font-bold text-blue-600">2</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-medium text-blue-900 mb-1">preparation</Text>
                                <Text className="text-sm text-blue-700">
                                    Your fresh produce will be carefully prepared for delivery
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-start">
                            <View className="w-6 h-6 bg-blue-200 rounded-full items-center justify-center mr-3 mt-0.5">
                                <Text className="text-xs font-bold text-blue-600">3</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-medium text-blue-900 mb-1">delivery</Text>
                                <Text className="text-sm text-blue-700">
                                    Your order will be delivered to your specified address
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Buttons */}
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-10 pt-5 pb-10">
                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => router.push('/customer/homepage')}
                        className="flex-1 bg-gray-100 py-4 px-6 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-center font-medium text-black text-sm">
                            home
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/customer/orders')}
                        className="flex-1 bg-background py-4 px-6 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-center font-medium text-black text-sm">
                            orders
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}