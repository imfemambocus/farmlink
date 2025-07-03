import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Platform, Dimensions
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useTranslation } from '@/context/LanguageContext';
import { useProductTranslations } from '@/utils/productTranslations';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/apiService';
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
    const { tCheckout, tOrders } = useTranslation();
    const { translateProduct, translateUnit } = useProductTranslations();
    const { confirmPayment, createPaymentMethod, initPaymentSheet, presentPaymentSheet } = useStripe();

    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentMethodType, setPaymentMethodType] = useState<'card' | 'payment_sheet'>('card');
    const [paymentSheetEnabled, setPaymentSheetEnabled] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
        full_name: '',
        phone: '',
        email: user?.email || '',
        address: '',
        notes: ''
    });

    const [cardComplete, setCardComplete] = useState(false);
    const [errors, setErrors] = useState<{[key: string]: string}>({});

    const getBackendProductName = (formattedName: string): string => {
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
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

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
                total_amount: Number(cartData.total_amount) + 75 || 0, // Hardcoded delivery fee 75
                total_items: Number(cartData.total_items) || 0
            };

            if (!processedCart.farmer_groups || processedCart.farmer_groups.length === 0) {
                showAlert(
                    'warning',
                    tCheckout('emptyCart'),
                    tCheckout('cartIsEmpty'),
                    [{
                        text: 'OK',
                        style: 'default',
                        onPress: () => {
                            hideAlert();
                            router.back();
                        }
                    }]
                );
                return;
            }

            setCart(processedCart);
        } catch (error: unknown) {
            console.error('Error fetching cart:', error);
            showAlert(
                'error',
                tCheckout('error'),
                tCheckout('failedToLoadCart'),
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: () => {
                        hideAlert();
                        router.back();
                    }
                }]
            );
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: {[key: string]: string} = {};

        if (!deliveryInfo.full_name.trim()) {
            newErrors.full_name = tCheckout('fullNameRequired');
        }
        if (!deliveryInfo.phone.trim()) {
            newErrors.phone = tCheckout('phoneRequired');
        }
        if (!deliveryInfo.address.trim()) {
            newErrors.address = tCheckout('addressRequired');
        }
        if (paymentMethodType === 'card' && !cardComplete) {
            newErrors.card = tCheckout('validCardRequired');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const createPaymentIntent = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            const payload = {
                amount: Math.round(cart!.total_amount * 100),
                currency: 'mur',
                cart_id: cart!.id,
                delivery_info: deliveryInfo
            };

            const response = await api.post('/payment/create-payment-intent', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            return response.data.client_secret;
        } catch (error: unknown) {
            console.error('Error creating payment intent:', error);

            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { detail?: string } } };
                console.error('Response data:', axiosError.response?.data);
            }

            const errorMessage = error && typeof error === 'object' && 'response' in error
                ? (error as any).response?.data?.detail || tCheckout('failedCreatePayment')
                : tCheckout('failedCreatePayment');

            throw new Error(errorMessage);
        }
    };

    const initializePaymentSheet = async () => {
        try {
            const clientSecret = await createPaymentIntent();

            const { error } = await initPaymentSheet({
                merchantDisplayName: 'FarmLink',
                paymentIntentClientSecret: clientSecret,
                customFlow: false,
                style: 'alwaysDark',
                googlePay: {
                    merchantCountryCode: 'MU',
                    testEnv: true,
                    currencyCode: 'MUR',
                },
                applePay: {
                    merchantCountryCode: 'MU',
                    cartItems: cart!.farmer_groups.flatMap(group =>
                        group.items.map(item => ({
                            label: item.product_name,
                            amount: (item.total_price * 100).toString(),
                            paymentType: 'Immediate' as const,
                        }))
                    ),
                },
                allowsDelayedPaymentMethods: true,
                returnURL: 'your-app://stripe-redirect',
            });

            if (!error) {
                setPaymentSheetEnabled(true);
            } else {
                console.error('Payment sheet initialization error:', error);
                showAlert(
                    'error',
                    tCheckout('error'),
                    tCheckout('failedInitializePayment'),
                    [{
                        text: 'OK',
                        style: 'default',
                        onPress: hideAlert
                    }]
                );
            }
        } catch (error: unknown) {
            console.error('Payment sheet initialization error:', error);
            showAlert(
                'error',
                tCheckout('error'),
                tCheckout('failedInitializePayment'),
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: hideAlert
                }]
            );
        }
    };

    const processCardPayment = async () => {
        if (!validateForm()) return;

        setProcessing(true);

        try {
            const clientSecret = await createPaymentIntent();

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

            const paymentResult = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
                paymentMethodData: {
                    paymentMethodId: paymentMethod!.id,
                },
            });

            if (paymentResult.error) {
                throw new Error(paymentResult.error.message);
            }

            await confirmPaymentAndCreateOrder(paymentResult.paymentIntent!.id);

        } catch (error: unknown) {
            console.error('Payment error:', error);
            const errorMessage = error && typeof error === 'object' && 'message' in error
                ? (error.message as string)
                : tCheckout('paymentError');

            showAlert(
                'error',
                tCheckout('paymentFailed'),
                errorMessage,
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: hideAlert
                }]
            );
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

            await refreshCartCount();

            router.push({
                pathname: '/(auth)/customer/payment/order-success',
                params: {
                    order_id: response.data.order_id,
                    order_number: response.data.order_number
                }
            });

        } catch (error: unknown) {
            console.error('Error confirming payment and creating order:', error);
            showAlert(
                'error',
                tCheckout('orderError'),
                tCheckout('orderCreationFailed'),
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: hideAlert
                }]
            );
        }
    };

    const processPaymentSheetPayment = async () => {
        if (!validateForm()) return;

        setProcessing(true);

        try {
            if (!paymentSheetEnabled) {
                await initializePaymentSheet();
            }

            const { error } = await presentPaymentSheet();

            if (error) {
                if (error.code === 'Canceled') {
                    return;
                }
                throw new Error(error.message);
            }

            await refreshCartCount();
            router.push({
                pathname: '/(auth)/customer/payment/order-success',
                params: {
                    payment_method: 'payment_sheet',
                    amount: cart?.total_amount?.toString() || '0'
                }
            });

        } catch (error: unknown) {
            console.error('Payment error:', error);
            const errorMessage = error && typeof error === 'object' && 'message' in error
                ? (error.message as string)
                : tCheckout('paymentError');

            showAlert(
                'error',
                tCheckout('paymentFailed'),
                errorMessage,
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: hideAlert
                }]
            );
        } finally {
            setProcessing(false);
        }
    };

    const renderDeliveryForm = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-xl font-semibold text-black mb-4">{tCheckout('deliveryInformation')}</Text>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('fullName')} {tCheckout('required')}</Text>
                <TextInput
                    value={deliveryInfo.full_name}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, full_name: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base leading-[1.2]"
                    placeholder={tCheckout('enterFullName')}
                    placeholderTextColor="#CCCCCC"
                />
                {errors.full_name && <Text className="text-red-500 text-xs mt-1">{errors.full_name}</Text>}
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('phoneNumber')} {tCheckout('required')}</Text>
                <TextInput
                    value={deliveryInfo.phone}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, phone: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base leading-[1.2]"
                    placeholder={tCheckout('enterPhoneNumber')}
                    placeholderTextColor="#CCCCCC"
                    keyboardType="phone-pad"
                />
                {errors.phone && <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>}
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('emailAddress')}</Text>
                <TextInput
                    value={deliveryInfo.email}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, email: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base leading-[1.2]"
                    placeholder={tCheckout('enterEmailAddress')}
                    placeholderTextColor="#CCCCCC"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>

            <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('deliveryAddress')} {tCheckout('required')}</Text>
                <TextInput
                    value={deliveryInfo.address}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, address: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base leading-[1.2]"
                    placeholder={tCheckout('enterCompleteAddress')}
                    placeholderTextColor="#CCCCCC"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
                {errors.address && <Text className="text-red-500 text-xs mt-1">{errors.address}</Text>}
            </View>

            <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('deliveryNotes')}</Text>
                <TextInput
                    value={deliveryInfo.notes}
                    onChangeText={(text) => setDeliveryInfo(prev => ({ ...prev, notes: text }))}
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base leading-[1.2]"
                    placeholder={tCheckout('specialInstructions')}
                    placeholderTextColor="#CCCCCC"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                />
            </View>
        </View>
    );

    const renderPaymentMethods = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-xl font-semibold text-black mb-4">{tCheckout('paymentMethod')}</Text>

            <View className="mb-4">
                <TouchableOpacity
                    onPress={() => setPaymentMethodType('card')}
                    className={`flex-row items-center p-3 rounded-lg ${paymentMethodType === 'card' ? 'bg-background' : 'bg-gray-100'}`}
                    activeOpacity={0.7}
                >
                    <Ionicons name="card-outline" size={20} color="#333" />
                    <Text className="ml-2 text-base font-medium">{tCheckout('creditDebitCard')}</Text>
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
                        {Platform.OS === 'ios' ? tCheckout('applePay') : tCheckout('googlePay')}
                    </Text>
                </TouchableOpacity>
            </View>

            {paymentMethodType === 'card' && (
                <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">{tCheckout('cardDetails')} {tCheckout('required')}</Text>
                    <CardField
                        postalCodeEnabled={false}
                        placeholders={{
                            number: '4242 4242 4242 4242',
                        }}
                        cardStyle={{
                            backgroundColor: '#000000',
                            textColor: '#FFFFFF',
                            borderRadius: 8,
                            placeholderColor: '#323640',
                            borderWidth: 1,
                            borderColor: '#000000',
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
                        {tCheckout('initializingPayment')}
                    </Text>
                </View>
            )}
        </View>
    );

    const formatPrice = (price: number | string | undefined): string => {
        const numPrice = Number(price) || 0;
        return numPrice.toFixed(2);
    };

    const renderOrderSummary = () => (
        <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-semibold text-black">{tCheckout('orderSummary')}</Text>
                <View className="items-end">
                    <Text className="text-sm text-gray-400">{cart?.total_items} {tCheckout('items')}</Text>
                    <Text className="text-sm text-gray-400">
                        {cart?.farmer_groups.length} {cart?.farmer_groups.length !== 1 ? tCheckout('farmers') : tCheckout('farmer')}
                    </Text>
                </View>
            </View>

            {cart?.farmer_groups.map((group) => (
                <View key={group.farmer_id} className="mb-4 pb-4 border-b border-gray-100 last:border-b-0">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="font-medium text-black">{group.farmer_name || tCheckout('unknownFarmer')}</Text>
                        <Text className="text-sm text-gray-600">{group.farmer_district || tCheckout('unknownDistrict')}</Text>
                    </View>

                    {group.items?.map((item, index) => {
                        // Get translated names
                        const backendProductName = getBackendProductName(item.product_name || '');
                        const translatedProductName = translateProduct(backendProductName);
                        const translatedUnitName = translateUnit(item.unit_name, item.quantity);

                        return (
                            <View key={index} className="flex-row justify-between items-center py-1">
                                <Text className="text-sm text-gray-600 flex-1">
                                    {item.quantity || 0} {translatedUnitName || translateUnit('unit')} {translatedProductName || tCheckout('unknownProduct')}
                                </Text>
                                <Text className="text-sm font-medium">{translateUnit('rs')} {formatPrice(item.total_price)}</Text>
                            </View>
                        );
                    }) || []}

                    <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
                        <Text className="font-medium text-black">{tCheckout('subtotal')}</Text>
                        <Text className="font-medium text-black">{translateUnit('rs')} {formatPrice(group.subtotal)}</Text>
                    </View>
                </View>
            ))}

            <View className="flex-row justify-between items-center py-2 border-t border-gray-200">
                <Text className="font-medium text-black">{tOrders('deliveryFee')}</Text>
                <Text className="font-medium text-black">{translateUnit('rs')} 75</Text>
            </View>

            <View className="flex-row justify-between items-center pt-4 border-t border-gray-200">
                <Text className="text-lg font-semibold text-black">{tCheckout('totalAmount')}</Text>
                <Text className="text-xl font-bold text-black">{translateUnit('rs')} {formatPrice(cart?.total_amount)}</Text>
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
                <View className="absolute top-0 left-0 right-0 z-10">
                    <Header title={tCheckout('checkoutTitle')} showBackButton={true} />
                </View>
                <View
                    className="flex-1 justify-center items-center"
                    style={{ paddingTop: Dimensions.get('window').height * 0.2 }}
                >
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tCheckout('loadingCheckout')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <View className="absolute top-0 left-0 right-0 z-10">
                <Header title={tCheckout('checkoutTitle')} showBackButton={true} />
            </View>

            <KeyboardAwareScrollView
                className="flex-1 px-2 pt-3"
                showsVerticalScrollIndicator={false}
                enableOnAndroid={true}
                enableAutomaticScroll={false}
                extraScrollHeight={0}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={10}
                enableResetScrollToCoords={false}
                keyboardOpeningTime={250}
                contentContainerStyle={{
                    paddingTop: Dimensions.get('window').height * 0.2,
                    paddingBottom: 275,
                }}
            >
                {renderOrderSummary()}
                {renderDeliveryForm()}
                {renderPaymentMethods()}

                <View className="mb-8 px-5">
                    <TouchableOpacity
                        onPress={handlePayment}
                        className="bg-background py-4 px-6 rounded-xl"
                        activeOpacity={0.7}
                        disabled={processing || (paymentMethodType === 'payment_sheet' && !paymentSheetEnabled)}
                    >
                        <Text className="text-center font-medium text-black text-lg">
                            {processing ? tCheckout('processing') : tCheckout('payNow')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>

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