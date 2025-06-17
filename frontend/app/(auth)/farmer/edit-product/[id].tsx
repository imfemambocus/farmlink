import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Pressable,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProductImage } from '@/constants/images';

interface UnitPrice {
    id: number;
    unit: string;
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

interface UnitPriceForm {
    id?: number;
    unit: string;
    price_per_unit: string;
    quantity_available: string;
    minimum_order: string;
    isNew?: boolean;
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

    const [product, setProduct] = useState<Product | null>(null);
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [unitPrices, setUnitPrices] = useState<UnitPriceForm[]>([]);
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
                    'Product Not Found',
                    'Product not found or you do not have permission to edit it.',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
                return;
            }

            setProduct(productData);
            setDescription(productData.description || '');
            setIsActive(productData.is_active);

            const formUnitPrices = productData.unit_prices.map((up: UnitPrice) => ({
                id: up.id,
                unit: up.unit,
                price_per_unit: up.price_per_unit.toString(),
                quantity_available: up.quantity_available.toString(),
                minimum_order: up.minimum_order.toString(),
                isNew: false
            }));

            setUnitPrices(formUnitPrices);

        } catch (error: any) {
            console.error('Error fetching product:', error);
            showAlert(
                'error',
                'Loading Failed',
                'Failed to load product details. Please try again.',
                [{ text: 'OK', onPress: () => router.back() }]
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

        const validUnitPrices = unitPrices.filter(up =>
            up.price_per_unit.trim() !== '' &&
            up.quantity_available.trim() !== ''
        );

        if (validUnitPrices.length === 0) {
            newErrors.unitPrices = 'at least one unit price is required';
        }

        validUnitPrices.forEach((unitPrice, index) => {
            if (!unitPrice.price_per_unit.trim()) {
                newErrors[`price_${index}`] = 'price is required';
            } else if (isNaN(Number(unitPrice.price_per_unit)) || Number(unitPrice.price_per_unit) <= 0) {
                newErrors[`price_${index}`] = 'please enter a valid price';
            }

            if (!unitPrice.quantity_available.trim()) {
                newErrors[`quantity_${index}`] = 'quantity is required';
            } else if (isNaN(Number(unitPrice.quantity_available)) || Number(unitPrice.quantity_available) <= 0) {
                newErrors[`quantity_${index}`] = 'please enter a valid quantity';
            }

            if (!unitPrice.minimum_order.trim()) {
                newErrors[`minimum_${index}`] = 'minimum order is required';
            } else if (isNaN(Number(unitPrice.minimum_order)) || Number(unitPrice.minimum_order) <= 0) {
                newErrors[`minimum_${index}`] = 'please enter a valid minimum order';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const addUnitPrice = () => {
        setUnitPrices([...unitPrices, {
            unit: 'kg',
            price_per_unit: '',
            quantity_available: '',
            minimum_order: '1',
            isNew: true
        }]);
    };

    const removeUnitPrice = async (index: number) => {
        const unitPrice = unitPrices[index];

        if (unitPrices.length === 1) {
            showAlert(
                'error',
                'Cannot Remove',
                'A product must have at least one unit price.',
                [{ text: 'OK', onPress: () => {} }]
            );
            return;
        }

        if (!unitPrice.isNew && unitPrice.id) {
            try {
                const token = await AsyncStorage.getItem('token');
                if (token) {
                    await api.delete(`/products/unit-prices/${unitPrice.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } catch (error: any) {
                console.error('Error deleting unit price:', error);
                showAlert(
                    'error',
                    'Delete Failed',
                    'Failed to delete unit price. Please try again.',
                    [{ text: 'OK', onPress: () => {} }]
                );
                return;
            }
        }

        const newUnitPrices = unitPrices.filter((_, i) => i !== index);
        setUnitPrices(newUnitPrices);
    };

    const updateUnitPrice = (index: number, field: keyof UnitPriceForm, value: string) => {
        const newUnitPrices = [...unitPrices];
        // @ts-ignore
        newUnitPrices[index][field] = value;
        setUnitPrices(newUnitPrices);

        const errorKey = field === 'price_per_unit' ? `price_${index}` :
            field === 'quantity_available' ? `quantity_${index}` :
                `minimum_${index}`;
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

            for (const unitPrice of unitPrices) {
                if (unitPrice.price_per_unit.trim() === '' || unitPrice.quantity_available.trim() === '') {
                    continue;
                }

                const unitPriceData = {
                    unit: unitPrice.unit,
                    price_per_unit: parseFloat(unitPrice.price_per_unit),
                    quantity_available: parseFloat(unitPrice.quantity_available),
                    minimum_order: parseFloat(unitPrice.minimum_order)
                };

                if (unitPrice.isNew) {
                    await api.post(`/products/${product.id}/unit-prices`, unitPriceData, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } else if (unitPrice.id) {
                    await api.put(`/products/unit-prices/${unitPrice.id}`, unitPriceData, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }

            showAlert(
                'success',
                'Success!',
                'Product updated successfully!',
                [{ text: 'OK', onPress: () => router.replace('/farmer/dashboard') }]
            );

        } catch (error: any) {
            console.error('Error updating product:', error);
            showAlert(
                'error',
                'Update Failed',
                error.response?.data?.detail || 'Failed to update product. Please try again.',
                [{ text: 'OK', onPress: () => {} }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        showAlert(
            'warning',
            'Delete Product',
            'Are you sure you want to delete this product? This action cannot be undone.',
            [
                { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                { text: 'Delete', onPress: confirmDelete, style: 'destructive' }
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
                'Deleted!',
                'Product deleted successfully!',
                [{ text: 'OK', onPress: () => router.replace('/farmer/dashboard') }]
            );

        } catch (error: any) {
            console.error('Error deleting product:', error);
            showAlert(
                'error',
                'Delete Failed',
                error.response?.data?.detail || 'Failed to delete product. Please try again.',
                [{ text: 'OK', onPress: () => {} }]
            );
        }
    };

    if (loadingProduct) {
        return (
            <View className="flex-1">
                <Header title="edit product" showBackButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading product...</Text>
                </View>
            </View>
        );
    }

    if (!product) {
        return (
            <View className="flex-1">
                <Header title="edit product" showBackButton={true} />
                <View className="flex-1 justify-center items-center bg-white px-6">
                    <Text className="text-lg font-medium text-black mb-2">product not found</Text>
                    <Text className="text-gray-600 text-center">
                        the product you&#39;re trying to edit doesn&#39;t exist or you don&#39;t have permission to edit it.
                    </Text>
                </View>
            </View>
        );
    }

    const productImage = getProductImage(product.item);

    return (
        <View className="flex-1">
            <Header title="edit product" showBackButton={true} />

            <ScrollView className="flex-1 bg-white px-6 pt-6" showsVerticalScrollIndicator={false}>
                {/* Product Info Section */}
                <View className="flex-row items-center mb-6 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {/* Product Image */}
                    <View
                        className="w-20 h-20 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: getProductBackgroundColor(product.item) }}
                    >
                        {imageError ? (
                            <Text className="text-xs text-gray-500 text-center px-1">
                                image failed
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

                    {/* Product Details */}
                    <View className="flex-1">
                        <Text className="text-lg font-medium text-black mb-1">
                            {formatItemName(product.item)}
                        </Text>
                        <Text className="text-sm text-gray-600 mb-2">
                            created: {new Date(product.created_at).toLocaleDateString()}
                        </Text>
                        <View className={`px-3 py-1 rounded-full self-start ${
                            product.is_active ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                            <Text className={`text-xs font-medium ${
                                product.is_active ? 'text-green-700' : 'text-gray-600'
                            }`}>
                                {product.is_active ? 'listed' : 'unlisted'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Status Toggle */}
                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        product status
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
                                isActive ? 'black' : 'text-gray-600'
                            }`}>
                                listed
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
                                unlisted
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Description */}
                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        description
                    </Text>
                    <TextInput
                        className="border rounded-xl px-4 py-3 text-base bg-gray-50 border-gray-200 text-black"
                        placeholder="e.g., organic, pesticide-free, locally grown..."
                        placeholderTextColor="#666666"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>

                {/* Unit Prices */}
                <View className="mb-3">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-base font-medium text-black">
                            pricing & stock
                        </Text>
                        <TouchableOpacity
                            onPress={addUnitPrice}
                            className="flex-row items-center px-3 py-2 bg-green-50 rounded-lg"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add" size={16} color="#10B981" />
                            <Text className="text-sm font-medium text-green-700 ml-1">
                                add unit
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {unitPrices.map((unitPrice, index) => (
                        <View key={`${unitPrice.id || 'new'}-${index}`} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-sm font-medium text-black">
                                    unit {index + 1}
                                </Text>
                                {unitPrices.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => removeUnitPrice(index)}
                                        className="p-1"
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#F44336" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Unit Selection */}
                            <View className="mb-3">
                                <Text className="text-sm font-medium mb-2 text-black">unit</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {UNITS.map((unit) => (
                                        <Pressable
                                            key={unit}
                                            onPress={() => updateUnitPrice(index, 'unit', unit)}
                                            className={`px-3 py-2 rounded-lg border ${
                                                unitPrice.unit === unit
                                                    ? 'border-background bg-background'
                                                    : 'border-gray-300 bg-white'
                                            }`}
                                        >
                                            <Text className={`text-sm font-medium ${
                                                unitPrice.unit === unit ? 'text-black' : 'text-gray-600'
                                            }`}>
                                                {unit}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Price, Quantity, Minimum Order */}
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Text className="text-sm font-medium mb-2 text-black">
                                        price (rs)
                                    </Text>
                                    <TextInput
                                        className={`border rounded-lg px-3 py-2 text-sm bg-white ${
                                            errors[`price_${index}`] ? 'border-red-500' : 'border-gray-200'
                                        }`}
                                        placeholder="0.00"
                                        placeholderTextColor="#666666"
                                        value={unitPrice.price_per_unit}
                                        onChangeText={(value) => updateUnitPrice(index, 'price_per_unit', value)}
                                        keyboardType="numeric"
                                    />
                                    {errors[`price_${index}`] && (
                                        <Text className="text-red-500 text-xs mt-1">
                                            {errors[`price_${index}`]}
                                        </Text>
                                    )}
                                </View>

                                <View className="flex-1">
                                    <Text className="text-sm font-medium mb-2 text-black">
                                        quantity
                                    </Text>
                                    <TextInput
                                        className={`border rounded-lg px-3 py-2 text-sm bg-white ${
                                            errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-200'
                                        }`}
                                        placeholder="0"
                                        placeholderTextColor="#666666"
                                        value={unitPrice.quantity_available}
                                        onChangeText={(value) => updateUnitPrice(index, 'quantity_available', value)}
                                        keyboardType="numeric"
                                    />
                                    {errors[`quantity_${index}`] && (
                                        <Text className="text-red-500 text-xs mt-1">
                                            {errors[`quantity_${index}`]}
                                        </Text>
                                    )}
                                </View>

                                <View className="flex-1">
                                    <Text className="text-sm font-medium mb-2 text-black">
                                        min. order
                                    </Text>
                                    <TextInput
                                        className={`border rounded-lg px-3 py-2 text-sm bg-white ${
                                            errors[`minimum_${index}`] ? 'border-red-500' : 'border-gray-200'
                                        }`}
                                        placeholder="1"
                                        placeholderTextColor="#666666"
                                        value={unitPrice.minimum_order}
                                        onChangeText={(value) => updateUnitPrice(index, 'minimum_order', value)}
                                        keyboardType="numeric"
                                    />
                                    {errors[`minimum_${index}`] && (
                                        <Text className="text-red-500 text-xs mt-1">
                                            {errors[`minimum_${index}`]}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}

                    {errors.unitPrices && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                            {errors.unitPrices}
                        </Text>
                    )}
                </View>

                {/* Action Buttons */}
                <View className="mb-12 flex-row gap-6 justify-center">
                    {/* Update Button */}
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

                    {/* Delete Button */}
                    <TouchableOpacity
                        className="flex-1 items-center justify-center py-4"
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash" size={32} color="#000000" />
                    </TouchableOpacity>
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