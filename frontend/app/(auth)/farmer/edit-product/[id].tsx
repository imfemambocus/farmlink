import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Pressable,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/context/LanguageContext';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProductImage } from '@/constants/images';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface UnitPrice {
    id: number;
    unit: string;
    customer_type: 'individual' | 'business';
    price_per_unit: number;
    quantity_available: number;
    minimum_order: number;
}

interface Product {
    id: number;
    item: string;
    description?: string;
    is_active: boolean;
    unit_prices: UnitPrice[];
    created_at: string;
    updated_at: string;
}

interface UnitPricingForm {
    unit: string;
    individual: {
        id?: number;
        price_per_unit: string;
        quantity_available: string;
        minimum_order: string;
        isNew?: boolean;
    };
    business: {
        id?: number;
        price_per_unit: string;
        quantity_available: string;
        minimum_order: string;
        isNew?: boolean;
    };
}

interface FormErrors {
    [key: string]: string;
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

const UNITS = ['kg', 'bunch', 'piece', 'dozen', 'basket'];

export default function EditProduct() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t, tProducts, tCommon } = useTranslation();

    const [product, setProduct] = useState<Product | null>(null);
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [unitPricings, setUnitPricings] = useState<UnitPricingForm[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    useEffect(() => {
        if (id) {
            fetchProduct();
        }
    }, [id]);

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

    const fetchProduct = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/products/my', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const farmerProducts = response.data;
            const productData = farmerProducts.find((p: Product) => p.id === parseInt(id));

            if (!productData) {
                showAlert(
                    'error',
                    tProducts('productNotFound'),
                    tProducts('noPermissionEdit'),
                    [{ text: tCommon('ok'), onPress: () => router.back() }]
                );
                return;
            }

            setProduct(productData);
            setDescription(productData.description || '');
            setIsActive(productData.is_active);

            const unitPricingMap: { [unit: string]: UnitPricingForm } = {};

            productData.unit_prices.forEach((up: UnitPrice) => {
                if (!unitPricingMap[up.unit]) {
                    unitPricingMap[up.unit] = {
                        unit: up.unit,
                        individual: {
                            price_per_unit: '',
                            quantity_available: '',
                            minimum_order: '1',
                            isNew: true
                        },
                        business: {
                            price_per_unit: '',
                            quantity_available: '',
                            minimum_order: '25',
                            isNew: true
                        }
                    };
                }

                if (up.customer_type === 'individual') {
                    unitPricingMap[up.unit].individual = {
                        id: up.id,
                        price_per_unit: up.price_per_unit.toString(),
                        quantity_available: up.quantity_available.toString(),
                        minimum_order: up.minimum_order.toString(),
                        isNew: false
                    };
                } else if (up.customer_type === 'business') {
                    unitPricingMap[up.unit].business = {
                        id: up.id,
                        price_per_unit: up.price_per_unit.toString(),
                        quantity_available: up.quantity_available.toString(),
                        minimum_order: up.minimum_order.toString(),
                        isNew: false
                    };
                }
            });

            setUnitPricings(Object.values(unitPricingMap));

        } catch (error: any) {
            console.error('Error fetching product:', error);
            showAlert(
                'error',
                tProducts('loadingFailed'),
                tProducts('failedToLoadItems'),
                [{ text: tCommon('ok'), onPress: () => router.back() }]
            );
        } finally {
            setLoadingProduct(false);
        }
    };

    const formatItemName = (item: string) => {
        return item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toLowerCase());
    };

    const getProductBackgroundColor = (item: string) => {
        const colorMap: { [key: string]: string } = {
            'tomato': '#ffebee',
            'potato': '#f3e5ab',
            'carrot': '#ffecce',
            'banana': '#fff9c4',
            'apple': '#ffebee',
            'orange': '#fff3e0',
            'mango': '#fff9c4',
            'pineapple': '#fff9c4',
            'papaya': '#fff3e0',
            'guava': '#f1f8e9',
            'lychee': '#fce4ec',
            'coconut': '#f5f5f5',
            'lemon': '#fffde7',
            'lime': '#f1f8e9',
            'watermelon': '#ffebee',
            'melon': '#f1f8e9',
            'grapes': '#f3e5f5',
            'strawberry': '#ffebee',
            'onion': '#f5f5f5',
            'cabbage': '#f1f8e9',
            'lettuce': '#f1f8e9',
            'spinach': '#e8f5e8',
            'broccoli': '#e8f5e8',
            'cauliflower': '#f5f5f5',
            'bell_pepper': '#f1f8e9',
            'chili': '#ffebee',
            'cucumber': '#e8f5e8',
            'eggplant': '#f3e5f5',
            'okra': '#e8f5e8',
            'green_beans': '#e8f5e8',
            'pumpkin': '#fff3e0',
            'beetroot': '#fce4ec',
            'radish': '#ffebee',
            'ginger': '#fff3e0',
            'garlic': '#f5f5f5'
        };
        return colorMap[item] || '#f5f5f5';
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        const validUnitPricings = unitPricings.filter(up =>
            (up.individual.price_per_unit.trim() !== '' && up.individual.quantity_available.trim() !== '') &&
            (up.business.price_per_unit.trim() !== '' && up.business.quantity_available.trim() !== '')
        );

        if (validUnitPricings.length === 0) {
            newErrors.unitPricings = tProducts('atLeastOnePricing');
        }

        unitPricings.forEach((unitPricing, index) => {
            if (!unitPricing.individual.price_per_unit.trim()) {
                newErrors[`individual_price_${index}`] = tProducts('individualPriceRequired');
            } else if (isNaN(Number(unitPricing.individual.price_per_unit)) || Number(unitPricing.individual.price_per_unit) <= 0) {
                newErrors[`individual_price_${index}`] = tProducts('enterValidPrice');
            }

            if (!unitPricing.individual.quantity_available.trim()) {
                newErrors[`individual_quantity_${index}`] = tProducts('individualQuantityRequired');
            } else if (isNaN(Number(unitPricing.individual.quantity_available)) || Number(unitPricing.individual.quantity_available) <= 0) {
                newErrors[`individual_quantity_${index}`] = tProducts('enterValidQuantity');
            }

            if (!unitPricing.individual.minimum_order.trim()) {
                newErrors[`individual_minimum_${index}`] = tProducts('individualMinimumRequired');
            } else if (isNaN(Number(unitPricing.individual.minimum_order)) || Number(unitPricing.individual.minimum_order) <= 0) {
                newErrors[`individual_minimum_${index}`] = tProducts('enterValidMinimum');
            }

            if (!unitPricing.business.price_per_unit.trim()) {
                newErrors[`business_price_${index}`] = tProducts('businessPriceRequired');
            } else if (isNaN(Number(unitPricing.business.price_per_unit)) || Number(unitPricing.business.price_per_unit) <= 0) {
                newErrors[`business_price_${index}`] = tProducts('enterValidPrice');
            }

            if (!unitPricing.business.quantity_available.trim()) {
                newErrors[`business_quantity_${index}`] = tProducts('businessQuantityRequired');
            } else if (isNaN(Number(unitPricing.business.quantity_available)) || Number(unitPricing.business.quantity_available) <= 0) {
                newErrors[`business_quantity_${index}`] = tProducts('enterValidQuantity');
            }

            if (!unitPricing.business.minimum_order.trim()) {
                newErrors[`business_minimum_${index}`] = tProducts('businessMinimumRequired');
            } else if (isNaN(Number(unitPricing.business.minimum_order)) || Number(unitPricing.business.minimum_order) <= 0) {
                newErrors[`business_minimum_${index}`] = tProducts('enterValidMinimum');
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const addUnitPricing = () => {
        setUnitPricings([...unitPricings, {
            unit: 'kg',
            individual: {
                price_per_unit: '',
                quantity_available: '',
                minimum_order: '1',
                isNew: true
            },
            business: {
                price_per_unit: '',
                quantity_available: '',
                minimum_order: '25',
                isNew: true
            }
        }]);
    };

    const removeUnitPricing = async (index: number) => {
        const unitPricing = unitPricings[index];

        if (unitPricings.length === 1) {
            showAlert(
                'error',
                tProducts('cannotRemove'),
                tProducts('mustHaveOnePricing'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                if (!unitPricing.individual.isNew && unitPricing.individual.id) {
                    await api.delete(`/products/unit-prices/${unitPricing.individual.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }

                if (!unitPricing.business.isNew && unitPricing.business.id) {
                    await api.delete(`/products/unit-prices/${unitPricing.business.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }
        } catch (error: any) {
            console.error('Error deleting unit pricing:', error);
            showAlert(
                'error',
                tProducts('deleteFailed'),
                tProducts('failedDeleteProduct'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
            return;
        }

        const newUnitPricings = unitPricings.filter((_, i) => i !== index);
        setUnitPricings(newUnitPricings);
    };

    const updateUnitPricing = (index: number, customerType: 'individual' | 'business', field: string, value: string) => {
        const newUnitPricings = [...unitPricings];
        if (field === 'unit') {
            newUnitPricings[index].unit = value;
        } else {
            (newUnitPricings[index][customerType] as any)[field] = value;
        }
        setUnitPricings(newUnitPricings);

        const errorKey = `${customerType}_${field}_${index}`;
        if (errors[errorKey]) {
            setErrors({ ...errors, [errorKey]: '' });
        }
    };

    const handleSubmit = async () => {
        if (!validateForm() || !product) {
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            await api.put(`/products/${product.id}`, {
                description: description.trim() || undefined,
                is_active: isActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            for (const unitPricing of unitPricings) {
                const individualData = {
                    unit: unitPricing.unit,
                    customer_type: 'individual',
                    price_per_unit: parseFloat(unitPricing.individual.price_per_unit),
                    quantity_available: parseFloat(unitPricing.individual.quantity_available),
                    minimum_order: parseFloat(unitPricing.individual.minimum_order)
                };

                if (unitPricing.individual.isNew) {
                    await api.post(`/products/${product.id}/unit-prices`, individualData, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } else if (unitPricing.individual.id) {
                    await api.put(`/products/unit-prices/${unitPricing.individual.id}`, {
                        price_per_unit: individualData.price_per_unit,
                        quantity_available: individualData.quantity_available,
                        minimum_order: individualData.minimum_order
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }

                const businessData = {
                    unit: unitPricing.unit,
                    customer_type: 'business',
                    price_per_unit: parseFloat(unitPricing.business.price_per_unit),
                    quantity_available: parseFloat(unitPricing.business.quantity_available),
                    minimum_order: parseFloat(unitPricing.business.minimum_order)
                };

                if (unitPricing.business.isNew) {
                    await api.post(`/products/${product.id}/unit-prices`, businessData, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } else if (unitPricing.business.id) {
                    await api.put(`/products/unit-prices/${unitPricing.business.id}`, {
                        price_per_unit: businessData.price_per_unit,
                        quantity_available: businessData.quantity_available,
                        minimum_order: businessData.minimum_order
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }

            showAlert(
                'success',
                tCommon('success'),
                tProducts('productUpdated'),
                [{ text: tCommon('ok'), onPress: () => router.replace('/farmer/dashboard') }]
            );

        } catch (error: any) {
            console.error('Error updating product:', error);
            showAlert(
                'error',
                tProducts('updateFailed'),
                error.response?.data?.detail || tProducts('failedUpdateProduct'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        showAlert(
            'warning',
            tProducts('deleteProduct'),
            tProducts('deleteConfirm'),
            [
                { text: tCommon('cancel'), onPress: () => {}, style: 'cancel' },
                { text: tCommon('delete'), onPress: confirmDelete, style: 'destructive' }
            ]
        );
    };

    const confirmDelete = async () => {
        if (!product) return;

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            await api.delete(`/products/${product.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert(
                'success',
                tProducts('deleted'),
                tProducts('productDeleted'),
                [{ text: tCommon('ok'), onPress: () => router.replace('/farmer/dashboard') }]
            );

        } catch (error: any) {
            console.error('Error deleting product:', error);
            showAlert(
                'error',
                tProducts('deleteFailed'),
                error.response?.data?.detail || tProducts('failedDeleteProduct'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
        }
    };

    if (loadingProduct) {
        return (
            <View className="flex-1">
                <Header title={tProducts('editProduct')} showBackButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tProducts('loadingProduct')}</Text>
                </View>
            </View>
        );
    }

    if (!product) {
        return (
            <View className="flex-1">
                <Header title={tProducts('editProduct')} showBackButton={true} />
                <View className="flex-1 justify-center items-center bg-white px-6">
                    <Text className="text-lg font-medium text-black mb-2">{tProducts('productNotFound')}</Text>
                    <Text className="text-gray-600 text-center">
                        {tProducts('productNotFoundDesc')}
                    </Text>
                </View>
            </View>
        );
    }

    const productImage = getProductImage(product.item);

    return (
        <View className="flex-1 bg-surface">
            <Header title={tProducts('editProduct')} showBackButton={true} />

            <KeyboardAwareScrollView
                className="flex-1 bg-white px-6 pt-6"
                showsVerticalScrollIndicator={false}
                enableOnAndroid={true}
                enableAutomaticScroll={true}
                extraScrollHeight={150}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={10}
                enableResetScrollToCoords={false}
                keyboardOpeningTime={250}
            >
                <View className="flex-row items-center mb-6 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    <View
                        className="w-20 h-20 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: getProductBackgroundColor(product.item) }}
                    >
                        {imageError ? (
                            <Text className="text-xs text-gray-500 text-center px-1">
                                {tProducts('imageFailed')}
                            </Text>
                        ) : (
                            <Image
                                source={productImage}
                                style={{
                                    width: '70%',
                                    height: '70%',
                                    resizeMode: 'contain',
                                }}
                                onError={() => setImageError(true)}
                            />
                        )}
                    </View>

                    <View className="flex-1">
                        <Text className="text-lg font-medium text-black mb-1">
                            {formatItemName(product.item)}
                        </Text>
                        <Text className="text-sm text-gray-600 mb-2">
                            {tProducts('created')}: {new Date(product.created_at).toLocaleDateString()}
                        </Text>
                        <View className={`px-3 py-1 rounded-full self-start ${
                            product.is_active ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                            <Text className={`text-xs font-medium ${
                                product.is_active ? 'text-green-700' : 'text-gray-600'
                            }`}>
                                {product.is_active ? tProducts('listed') : tProducts('unlisted')}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        {tProducts('productStatus')}
                    </Text>
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={() => setIsActive(true)}
                            className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl ${
                                isActive
                                    ? 'bg-background'
                                    : 'bg-gray-50'
                            }`}
                        >
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color={isActive ? '#000000' : '#666666'}
                            />
                            <Text className={`font-medium ml-2 text-sm ${
                                isActive ? 'text-black' : 'text-gray-600'
                            }`}>
                                {tProducts('listed')}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setIsActive(false)}
                            className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl border ${
                                !isActive
                                    ? 'border-gray-600 bg-gray-100'
                                    : 'border-gray-300 bg-gray-50'
                            }`}
                        >
                            <Ionicons
                                name="pause-circle-outline"
                                size={18}
                                color={!isActive ? '#666666' : '#CCCCCC'}
                            />
                            <Text className={`font-medium ml-2 text-sm ${
                                !isActive ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                                {tProducts('unlisted')}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        {tProducts('description')}
                    </Text>
                    <TextInput
                        className="border leading-[1.2] rounded-xl px-4 py-3 text-base bg-gray-50 border-gray-200 text-black"
                        placeholder={tProducts('organicExample')}
                        placeholderTextColor="#666666"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>

                <View className="mb-3">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-base font-medium text-black">
                            {tProducts('pricingStock')}
                        </Text>
                        <TouchableOpacity
                            onPress={addUnitPricing}
                            className="flex-row items-center px-3 py-2 bg-green-50 rounded-lg"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add" size={16} color="#10B981" />
                            <Text className="text-sm font-medium text-green-700 ml-1">
                                {tProducts('addUnit')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {unitPricings.map((unitPricing, index) => (
                        <View key={`${unitPricing.unit}-${index}`} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-sm font-medium text-black">
                                    {tProducts('unit')} {index + 1}
                                </Text>
                                {unitPricings.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => removeUnitPricing(index)}
                                        className="p-1"
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#F44336" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View className="mb-4">
                                <Text className="text-sm font-medium mb-2 text-black">{tProducts('unit')}</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {UNITS.map((unit) => (
                                        <Pressable
                                            key={unit}
                                            onPress={() => updateUnitPricing(index, 'individual', 'unit', unit)}
                                            className={`px-3 py-2 rounded-lg border ${
                                                unitPricing.unit === unit
                                                    ? 'border-background bg-background'
                                                    : 'border-gray-300 bg-white'
                                            }`}
                                        >
                                            <Text className={`text-sm font-medium ${
                                                unitPricing.unit === unit ? 'text-black' : 'text-gray-600'
                                            }`}>
                                                {t(`units.${unit}`)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                                <View className="flex-row items-center mb-3">
                                    <Ionicons name="person" size={16} color="#10B981" />
                                    <Text className="text-sm font-medium text-green-700 ml-2">
                                        {tProducts('individualPricing')}
                                    </Text>
                                </View>

                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('price')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`individual_price_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="0.00"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.individual.price_per_unit}
                                            onChangeText={(value) => updateUnitPricing(index, 'individual', 'price_per_unit', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`individual_price_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`individual_price_${index}`]}
                                            </Text>
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('quantity')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`individual_quantity_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="0"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.individual.quantity_available}
                                            onChangeText={(value) => updateUnitPricing(index, 'individual', 'quantity_available', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`individual_quantity_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`individual_quantity_${index}`]}
                                            </Text>
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('minOrder')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`individual_minimum_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="1"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.individual.minimum_order}
                                            onChangeText={(value) => updateUnitPricing(index, 'individual', 'minimum_order', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`individual_minimum_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`individual_minimum_${index}`]}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View className="p-3 bg-white rounded-lg border border-blue-200">
                                <View className="flex-row items-center mb-3">
                                    <Ionicons name="business" size={16} color="#3B82F6" />
                                    <Text className="text-sm font-medium text-blue-700 ml-2">
                                        {tProducts('businessPricing')}
                                    </Text>
                                </View>

                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('price')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`business_price_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="0.00"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.business.price_per_unit}
                                            onChangeText={(value) => updateUnitPricing(index, 'business', 'price_per_unit', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`business_price_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`business_price_${index}`]}
                                            </Text>
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('quantity')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`business_quantity_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="0"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.business.quantity_available}
                                            onChangeText={(value) => updateUnitPricing(index, 'business', 'quantity_available', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`business_quantity_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`business_quantity_${index}`]}
                                            </Text>
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <Text className="text-xs font-medium mb-1 text-black">
                                            {tProducts('minOrder')}
                                        </Text>
                                        <TextInput
                                            className={`border leading-[1.2] rounded-lg px-3 py-2 text-sm bg-white ${
                                                errors[`business_minimum_${index}`] ? 'border-red-500' : 'border-gray-200'
                                            }`}
                                            placeholder="25"
                                            placeholderTextColor="#666666"
                                            value={unitPricing.business.minimum_order}
                                            onChangeText={(value) => updateUnitPricing(index, 'business', 'minimum_order', value)}
                                            keyboardType="numeric"
                                        />
                                        {errors[`business_minimum_${index}`] && (
                                            <Text className="text-red-500 text-xs mt-1">
                                                {errors[`business_minimum_${index}`]}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    {errors.unitPricings && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                            {errors.unitPricings}
                        </Text>
                    )}
                </View>

                <View className="mb-12 flex-row gap-6 justify-center">
                    <TouchableOpacity
                        className="flex-1 items-center justify-center py-4"
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator size="large" color="#000000" />
                        ) : (
                            <Ionicons name="checkmark-circle" size={32} color="#000000" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-1 items-center justify-center py-4"
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash" size={32} color="#000000" />
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