// app/(auth)/customer/checkout.tsx
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import Header from '@/components/ui/Header';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { StripeProvider, useStripe, CardField } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

interface FarmerGroup {
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    items: Array<{
        id: number;
        product_name: string;
        unit_name: string;
        quantity: number;
        unit_price_snapshot: number;
        total_price: number;
    }>;
    subtotal: number;
}

interface Cart {
    id: number;
    farmer_groups: FarmerGroup[];
    total_amount: number;
    total_items: number;
}

interface DeliveryInfo {
    full_name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
}

// Main checkout component wrapped with Stripe provider
export default function CheckoutScreenWrapper() {
    return (
        <StripeProvider
            publishableKey={Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier={Constants.expoConfig?.extra?.MERCHANT_IDENTIFIER}
        >
            <CheckoutScreen />
        </StripeProvider>
    );
}

function CheckoutScreen() {
    const { user } = useContext(AuthContext);
    const { refreshCartCount } = useCart();
    const router = useRouter();
    const { confirmPayment, createPaymentMethod, initPaymentSheet, presentPaymentSheet } = useStripe();

    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentMethodType, setPaymentMethodType] = useState<'card' | 'payment_sheet'>('card');
    const [paymentSheetEnabled, setPaymentSheetEnabled] = useState(false);

    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
        full_name: '',
        phone: '',
        email: user?.email || '',
        address: '',
        notes: ''
    });

    const [cardComplete, setCardComplete] = useState(false);
    const [errors, setErrors] = useState<{[key: string]: string}>({});

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

        // Pre-fill user info with null checks
        if (user.individual_profile) {
            setDeliveryInfo(prev => ({
                ...prev,
                full_name: `${user.individual_profile?.first_name || ''} ${user.individual_profile?.last_name || ''}`.trim(),
                phone: user.individual_profile?.phone_number || '',
                address: `${user.individual_profile?.street || ''}, ${user.individual_profile?.city_town || ''}, ${user.individual_profile?.post_code || ''}`.replace(/^, |, $|, , /g, '').trim()
            }));
        } else if (user.business_profile) {
            setDeliveryInfo(prev => ({
                ...prev,
                full_name: user.business_profile?.contact_name || '',
                phone: user.business_profile?.phone_number || '',
                address: `${user.business_profile?.street || ''}, ${user.business_profile?.city_town || ''}, ${user.business_profile?.post_code || ''}`.replace(/^, |, $|, , /g, '').trim()
            }));
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

            // Process cart data with proper number conversion
            const cartData = response.data;
            const processedCart: Cart = {
                id: cartData.id || null,
                farmer_groups: (cartData.farmer_groups || []).map((group: any) => ({
                    ...group,
                    subtotal: Number(group.subtotal) || 0,
                    items: (group.items || []).map((item: any) => ({
                        ...item,
                        quantity: Number(item.quantity) || 0,
                        unit_price_snapshot: Number(item.unit_price_snapshot) || 0,
                        total_price: Number(item.total_price) || 0
                    }))
                })),
                total_amount: Number(cartData.total_amount) || 0,
                total_items: Number(cartData.total_items) || 0
            };

            if (!processedCart.farmer_groups || processedCart.farmer_groups.length === 0) {
                Alert.alert('Empty Cart', 'Your cart is empty', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
                return;
            }

            setCart(processedCart);
        } catch (error: any) {
            console.error('Error fetching cart:', error);
            Alert.alert('Error', 'Failed to load cart');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: {[key: string]: string} = {};

        if (!deliveryInfo.full_name.trim()) {
            newErrors.full_name = 'Full name is required';
        }
        if (!deliveryInfo.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        }
        if (!deliveryInfo.address.trim()) {
            newErrors.address = 'Delivery address is required';
        }
        if (paymentMethodType === 'card' && !cardComplete) {
            newErrors.card = 'Please enter valid card details';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const createPaymentIntent = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await api.post('/payment/create-payment-intent', {
                amount: Math.round(cart!.total_amount * 100), // Convert to cents
                currency: 'lkr',
                cart_id: cart!.id,
                delivery_info: deliveryInfo
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            return response.data.client_secret;
        } catch (error: any) {
            console.error('Error creating payment intent:', error);
            throw new Error('Failed to create payment intent');
        }
    };

    const initializePaymentSheet = async () => {
        try {
            const clientSecret = await createPaymentIntent();

            const { error } = await initPaymentSheet({
                merchantDisplayName: 'FarmLink',
                paymentIntentClientSecret: clientSecret,
                customFlow: false,
                style: 'alwaysDark', // or 'alwaysLight' or 'automatic'
                googlePay: {
                    merchantCountryCode: 'LK',
                    testEnv: true, // Set to false in production
                    currencyCode: 'LKR',
                },
                applePay: {
                    merchantCountryCode: 'LK',
                    cartItems: cart!.farmer_groups.flatMap(group =>
                        group.items.map(item => ({
                            label: item.product_name,
                            amount: (item.total_price * 100).toString(),
                            paymentType: 'Immediate' as const,
                        }))
                    ),
                },
                allowsDelayedPaymentMethods: true,
                returnURL: 'your-app://stripe-redirect', // Replace with your app's URL scheme
            });

            if (!error) {
                setPaymentSheetEnabled(true);
            } else {
                console.error('Payment sheet initialization error:', error);
                Alert.alert('Error', 'Failed to initialize payment options');
            }
        } catch (error: any) {
            console.error('Payment sheet initialization error:', error);
            Alert.alert('Error', 'Failed to initialize payment options');
        }
    };

    const processCardPayment = async () => {
        if (!validateForm()) return;

        setProcessing(true);

        try {
            const clientSecret = await createPaymentIntent();

            // Create payment method from card
            const { error: pmError, paymentMethod } = await createPaymentMethod({
                paymentMethodType: 'Card',
                paymentMethodData: {
                    billingDetails: {
                        name: deliveryInfo.full_name,
                        email: deliveryInfo.email,
                        phone: deliveryInfo.phone,
                    },
                },
            });

            if (pmError) {
                throw new Error(pmError.message);
            }

            // Confirm payment
            const paymentResult = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
                paymentMethodData: {
                    paymentMethodId: paymentMethod!.id,
                },
            });

            if (paymentResult.error) {
                throw new Error(paymentResult.error.message);
            }

            // Payment successful - confirm with backend and create order
            await confirmPaymentAndCreateOrder(paymentResult.paymentIntent!.id);

        } catch (error: any) {
            console.error('Payment error:', error);
            Alert.alert('Payment Failed', error.message || 'Payment could not be processed');
        } finally {
            setProcessing(false);
        }
    };

    const confirmPaymentAndCreateOrder = async (paymentIntentId: string) => {
        try {
            const token = await AsyncStorage.getItem('token');

            const response = await api.post('/payment/confirm-payment', {
                payment_intent_id: paymentIntentId,
                delivery_info: deliveryInfo,
                payment_method_type: paymentMethodType === 'card' ? 'stripe_card' : 'stripe_payment_sheet'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh cart count after successful order creation
            await refreshCartCount();

            // Navigate to success screen
            router.push({
                pathname: '/(auth)/customer/payment/order-success',
                params: {
                    order_id: response.data.order_id,
                    order_number: response.data.order_number
                }
            });

        } catch (error: any) {
            console.error('Error confirming payment and creating order:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            Alert.alert('Order Error', 'Payment was successful but order creation failed. Please contact support.');
        }
    };

    const processPaymentSheetPayment = async () => {
        if (!validateForm()) return;

        setProcessing(true);

        try {
            // Initialize payment sheet if not already done
            if (!paymentSheetEnabled) {
                await initializePaymentSheet();
            }

            const { error } = await presentPaymentSheet();

            if (error) {
                if (error.code === 'Canceled') {
                    // User canceled the payment
                    return;
                }
                throw new Error(error.message);
            }

            // Payment successful - we need to get the payment intent ID
            // For Payment Sheet, we'll need to implement a different flow
            // For now, let's use a simplified approach

            // Navigate to success (in production, use webhooks to handle this)
            await refreshCartCount();
            router.push({
                pathname: '/(auth)/customer/payment/order-success',
                params: {
                    payment_method: 'payment_sheet',
                    amount: cart?.total_amount?.toString() || '0'
                }
            });

        } catch (error: any) {
            console.error('Payment error:', error);
            Alert.alert('Payment Failed', error.message || 'Payment could not be processed');
        } finally {
            setProcessing(false);
        }
    };

    const createOrders = async () => {
        // Note: This function should be called automatically by Stripe webhooks
        // or by using the confirm-payment endpoint instead of create-from-cart

        // For now, we'll navigate to success since payment was successful
        // In production, you'd want to verify the order was created via webhooks

        router.push({
            pathname: '/(auth)/customer/payment/order-success',
            params: {
                payment_intent_id: 'success', // You can pass the payment intent ID here
                amount: cart?.total_amount?.toString() || '0'
            }
        });
    };

    const renderDeliveryForm = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-xl font-semibold text-black mb-4">delivery information</Text>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">full name *</Text>
                <TextInput
                    value={deliveryInfo.full_name}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, full_name: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base"
                    placeholder="Enter your full name"
                />
                {errors.full_name && <Text className="text-red-500 text-xs mt-1">{errors.full_name}</Text>}
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">phone number *</Text>
                <TextInput
                    value={deliveryInfo.phone}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, phone: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base"
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                />
                {errors.phone && <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>}
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">email address</Text>
                <TextInput
                    value={deliveryInfo.email}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, email: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base"
                    placeholder="Enter email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">delivery address *</Text>
                <TextInput
                    value={deliveryInfo.address}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, address: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base"
                    placeholder="Enter complete delivery address"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
                {errors.address && <Text className="text-red-500 text-xs mt-1">{errors.address}</Text>}
            </View>

            <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">delivery notes (optional)</Text>
                <TextInput
                    value={deliveryInfo.notes}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, notes: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base"
                    placeholder="Any special delivery instructions..."
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                />
            </View>
        </View>
    );

    const renderPaymentMethods = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-xl font-semibold text-black mb-4">payment method</Text>

            {/* Payment Method Selection */}
            <View className="mb-4">
                <TouchableOpacity
                    onPress={() => setPaymentMethodType('card')}
                    className={`flex-row items-center p-3 rounded-lg ${paymentMethodType === 'card' ? 'bg-background' : 'bg-gray-100'}`}
                    activeOpacity={0.7}
                >
                    <Ionicons name="card-outline" size={20} color="#333" />
                    <Text className="ml-2 text-base font-medium">credit/debit card</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setPaymentMethodType('payment_sheet');
                        if (!paymentSheetEnabled) {
                            initializePaymentSheet();
                        }
                    }}
                    className={`flex-row items-center p-3 rounded-lg mt-3 ${paymentMethodType === 'payment_sheet' ? 'bg-background' : 'bg-gray-100'}`}
                    activeOpacity={0.7}
                >
                    <Ionicons name="wallet-outline" size={20} color="#333" />
                    <Text className="ml-2 text-base font-medium">
                        {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Card Input for card payments */}
            {paymentMethodType === 'card' && (
                <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">card details *</Text>
                    <CardField
                        postalCodeEnabled={false}
                        placeholders={{
                            number: '4242 4242 4242 4242',
                        }}
                        cardStyle={{
                            backgroundColor: '#FFFFFF',
                            textColor: '#000000',
                        }}
                        style={{
                            width: '100%',
                            height: 50,
                            marginVertical: 8,
                        }}
                        onCardChange={(cardDetails: any) => {
                            setCardComplete(cardDetails.complete);
                        }}
                    />
                    {errors.card && <Text className="text-red-500 text-xs mt-1">{errors.card}</Text>}
                </View>
            )}

            {paymentMethodType === 'payment_sheet' && !paymentSheetEnabled && (
                <View className="p-3 bg-gray-50 rounded-lg">
                    <Text className="text-sm text-gray-600 text-center">
                        initializing payment options...
                    </Text>
                </View>
            )}
        </View>
    );

    // Helper function to safely format prices
    const formatPrice = (price: number | string | undefined): string => {
        const numPrice = Number(price) || 0;
        return numPrice.toFixed(2);
    };

    const renderOrderSummary = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-semibold text-black">order summary</Text>
                <View className="items-end">
                    <Text className="text-sm text-gray-400">{cart?.total_items} items</Text>
                    <Text className="text-sm text-gray-400">
                        {cart?.farmer_groups.length} farmer{cart?.farmer_groups.length !== 1 ? 's' : ''}
                    </Text>
                </View>
            </View>

            {cart?.farmer_groups.map((group) => (
                <View key={group.farmer_id} className="mb-4 pb-4 border-b border-gray-100 last:border-b-0">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="font-medium text-black">{group.farmer_name || 'unknown farmer'}</Text>
                        <Text className="text-sm text-gray-600">{group.farmer_district || 'unknown district'}</Text>
                    </View>

                    {group.items?.map((item, index) => (
                        <View key={index} className="flex-row justify-between items-center py-1">
                            <Text className="text-sm text-gray-600 flex-1">
                                {item.quantity || 0} {item.unit_name || 'unit'} {item.product_name.toLowerCase() || 'unknown product'}
                            </Text>
                            <Text className="text-sm font-medium">rs {formatPrice(item.total_price)}</Text>
                        </View>
                    )) || []}

                    <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
                        <Text className="font-medium text-black">subtotal</Text>
                        <Text className="font-medium text-black">rs {formatPrice(group.subtotal)}</Text>
                    </View>
                </View>
            ))}

            <View className="flex-row justify-between items-center pt-4 border-t border-gray-200">
                <Text className="text-lg font-semibold text-black">total amount</Text>
                <Text className="text-xl font-bold text-action-green">rs {formatPrice(cart?.total_amount)}</Text>
            </View>
        </View>
    );

    const handlePayment = () => {
        if (paymentMethodType === 'card') {
            processCardPayment();
        } else {
            processPaymentSheetPayment();
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="Checkout" showBackButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">Loading checkout...</Text>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-surface"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Header title="Checkout" showBackButton={true} />

            <ScrollView
                className="flex-1 px-2 pt-3"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {renderOrderSummary()}
                {renderDeliveryForm()}
                {renderPaymentMethods()}

                {/* Payment Button */}
                <View className="mb-8 px-5">
                    <TouchableOpacity
                        onPress={handlePayment}
                        className="bg-background py-4 px-6 rounded-xl"
                        activeOpacity={0.7}
                        disabled={processing || (paymentMethodType === 'payment_sheet' && !paymentSheetEnabled)}
                    >
                        <Text className="text-center font-medium text-black text-lg">
                            {processing ? 'processing...' : 'pay now'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}