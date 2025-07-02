import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Pressable, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/context/LanguageContext';
import { useProductTranslations } from '@/utils/productTranslations';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface AvailableItems {
    fruits: string[];
    vegetables: string[];
}

interface UnitPricing {
    unit: string;
    individual: {
        price_per_unit: string;
        quantity_available: string;
        minimum_order: string;
    };
    business: {
        price_per_unit: string;
        quantity_available: string;
        minimum_order: string;
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

export default function AddProduct() {
    const router = useRouter();
    const { t, tProducts, tCommon } = useTranslation();
    const { translateProduct, translateUnit } = useProductTranslations();
    const [availableItems, setAvailableItems] = useState<AvailableItems>({ fruits: [], vegetables: [] });
    const [selectedCategory, setSelectedCategory] = useState<'fruits' | 'vegetables'>('vegetables');
    const [selectedItem, setSelectedItem] = useState<string>('');
    const [description, setDescription] = useState('');
    const [unitPricings, setUnitPricings] = useState<UnitPricing[]>([
        {
            unit: 'kg',
            individual: { price_per_unit: '', quantity_available: '', minimum_order: '1' },
            business: { price_per_unit: '', quantity_available: '', minimum_order: '25' }
        }
    ]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(true);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    useEffect(() => {
        fetchAvailableItems();
    }, []);

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

    const fetchAvailableItems = async () => {
        try {
            const response = await api.get('/products/items');
            setAvailableItems(response.data);
        } catch (error) {
            console.error('Error fetching items:', error);
            showAlert(
                'error',
                tProducts('loadingFailed'),
                tProducts('failedToLoadItems'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
        } finally {
            setLoadingItems(false);
        }
    };

    const getTranslatedProductName = (backendName: string): string => {
        const translatedName = translateProduct(backendName);
        return translatedName || backendName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toLowerCase());
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!selectedItem) {
            newErrors.item = tProducts('pleaseSelectItem');
        }

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
            individual: { price_per_unit: '', quantity_available: '', minimum_order: '1' },
            business: { price_per_unit: '', quantity_available: '', minimum_order: '25' }
        }]);
    };

    const removeUnitPricing = (index: number) => {
        if (unitPricings.length === 1) {
            showAlert(
                'error',
                tProducts('cannotRemove'),
                tProducts('mustHaveOnePricing'),
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
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const unitPricesForBackend: any[] = [];

            unitPricings.forEach(unitPricing => {
                unitPricesForBackend.push({
                    unit: unitPricing.unit,
                    customer_type: 'individual',
                    price_per_unit: parseFloat(unitPricing.individual.price_per_unit),
                    quantity_available: parseFloat(unitPricing.individual.quantity_available),
                    minimum_order: parseFloat(unitPricing.individual.minimum_order)
                });

                unitPricesForBackend.push({
                    unit: unitPricing.unit,
                    customer_type: 'business',
                    price_per_unit: parseFloat(unitPricing.business.price_per_unit),
                    quantity_available: parseFloat(unitPricing.business.quantity_available),
                    minimum_order: parseFloat(unitPricing.business.minimum_order)
                });
            });

            const payload = {
                item: selectedItem,
                description: description.trim() || undefined,
                unit_prices: unitPricesForBackend
            };

            await api.post('/products', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert(
                'success',
                tCommon('success'),
                tProducts('productAdded'),
                [{ text: tCommon('ok'), onPress: () => router.replace('/farmer/dashboard') }]
            );

        } catch (error: any) {
            console.error('Error adding product:', error);
            showAlert(
                'error',
                tProducts('addFailed'),
                error.response?.data?.detail || tProducts('failedToLoadItems'),
                [{ text: tCommon('ok'), onPress: () => {} }]
            );
        } finally {
            setLoading(false);
        }
    };

    const clearError = (field: string) => {
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    if (loadingItems) {
        return (
            <View className="flex-1">
                <View className="absolute top-0 left-0 right-0 z-10">
                    <Header title={tProducts('addProduct')} showBackButton={true} />
                </View>
                <View
                    className="flex-1 justify-center items-center"
                    style={{ paddingTop: Dimensions.get('window').height * 0.2 }}
                >
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tProducts('loadingItems')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <View className="absolute top-0 left-0 right-0 z-10">
                <Header title={tProducts('addProduct')} showBackButton={true} />
            </View>

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
                contentContainerStyle={{
                    paddingTop: Dimensions.get('window').height * 0.2
                }}
            >
                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        {tProducts('category')}
                    </Text>
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={() => {
                                setSelectedCategory('vegetables');
                                setSelectedItem('');
                                clearError('item');
                            }}
                            className={`flex-1 flex-row items-center justify-center py-2 px-4 rounded-xl ${
                                selectedCategory === 'vegetables'
                                    ? 'bg-background'
                                    : 'bg-gray-50'
                            }`}
                        >
                            <Text className="text-xl mr-2">🥬</Text>
                            <Text className={`font-medium text-sm ${
                                selectedCategory === 'vegetables' ? 'text-black' : 'text-gray-600'
                            }`}>
                                {t('dashboard.vegetables')}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setSelectedCategory('fruits');
                                setSelectedItem('');
                                clearError('item');
                            }}
                            className={`flex-1 flex-row items-center justify-center py-2 px-4 rounded-xl border ${
                                selectedCategory === 'fruits'
                                    ? 'border-gray-600 bg-gray-100'
                                    : 'border-gray-300 bg-gray-50'
                            }`}
                        >
                            <Text className="text-xl mr-2">🍎</Text>
                            <Text className={`font-medium text-sm ${
                                selectedCategory === 'fruits' ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                                {t('dashboard.fruits')}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        {tProducts('selectItem')}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        {availableItems[selectedCategory].map((item) => (
                            <Pressable
                                key={item}
                                onPress={() => {
                                    setSelectedItem(item);
                                    clearError('item');
                                }}
                                className={`px-4 py-2 rounded-xl border ${
                                    selectedItem === item
                                        ? 'border-background bg-background'
                                        : 'border-gray-300 bg-white'
                                }`}
                            >
                                <Text className={`text-sm font-medium ${
                                    selectedItem === item ? 'text-black' : 'text-gray-600'
                                }`}>
                                    {getTranslatedProductName(item)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    {errors.item && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                            {errors.item}
                        </Text>
                    )}
                </View>

                <View className="mb-6">
                    <Text className="text-base font-medium mb-3 text-black">
                        {tProducts('description')}
                    </Text>
                    <TextInput
                        className="border leading-[1.1] rounded-xl px-4 py-3 text-base bg-gray-50 border-gray-200 text-black"
                        placeholder={tProducts('organicExample')}
                        placeholderTextColor="#666666"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>

                <View>
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
                        <View key={index} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
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
                                                {translateUnit(unit)}
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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
                                            className={`border leading-[1.1] rounded-lg px-3 py-2 text-sm bg-white ${
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

                <View className="mb-12 flex-row justify-center">
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