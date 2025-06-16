import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PRODUCT_IMAGES, getProductImage } from '@/constants/images';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UnitPrice {
    id: number;
    unit: string;
    price_per_unit: number;
    quantity_available: number;
    minimum_order: number;
}

interface ProductCardProps {
    product: {
        id: number;
        item: string;
        description?: string;
        is_active: boolean;
        unit_prices: UnitPrice[];
        created_at: string;
        updated_at: string;
    };
    onEdit?: (product: ProductCardProps['product']) => void;
    onToggleStatus?: (productId: number, newStatus: boolean) => void;
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

export default function ProductCard({ product, onEdit, onToggleStatus }: ProductCardProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(product);
    const [imageError, setImageError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });
    const backgroundOpacity = useSharedValue(0);
    const modalTranslateY = useSharedValue(1000); // Start off-screen

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

    const formatItemName = (item: string) => {
        return item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toLowerCase());
    };

    const getLowestPrice = () => {
        if (!product.unit_prices.length) return 0;
        return Math.min(...product.unit_prices.map(up => up.price_per_unit));
    };

    const getTotalQuantity = () => {
        return product.unit_prices.reduce((total, up) => total + up.quantity_available, 0);
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

    const openModal = () => {
        setCurrentProduct(product); // Update current product when opening modal
        setModalVisible(true);
        setImageError(false); // Reset image error state
        backgroundOpacity.value = withTiming(1, { duration: 300 });
        modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 100 });
    };

    const handleToggleStatus = async () => {
        if (loading) return;

        const newStatus = !currentProduct.is_active;
        setLoading(true);

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                showAlert(
                    'error',
                    'error',
                    'authentication required. please log in again.',
                    [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
                );
                return;
            }

            await api.put(`/products/${currentProduct.id}`,
                { is_active: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state
            setCurrentProduct(prev => ({ ...prev, is_active: newStatus }));

            // Call parent callback if provided
            onToggleStatus?.(currentProduct.id, newStatus);

            showAlert(
                'success',
                'success',
                `product ${newStatus ? 'listed' : 'unlisted'} successfully`,
                [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error updating product status:', error);
            showAlert(
                'error',
                'error',
                'failed to update product status. please try again.',
                [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        backgroundOpacity.value = withTiming(0, { duration: 200 });
        modalTranslateY.value = withTiming(1000, { duration: 250 });
        setTimeout(() => {
            setModalVisible(false);
        }, 250);
    };

    const backgroundStyle = useAnimatedStyle(() => ({
        opacity: backgroundOpacity.value,
    }));

    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    const productImage = getProductImage(product.item);

    return (
        <>
        {/* Main Product Card */}
            <TouchableOpacity
                onPress={openModal}
                className="bg-surface rounded-xl border border-gray-200 mb-4 p-4"
                activeOpacity={0.7}
            >
                {/* Product Image Container - square, half size of modal */}
                <View className="w-1/2 aspect-square rounded-[40px] items-center justify-center mb-3 self-center">
                    {imageError ? (
                        <Text className="text-xs text-gray-500 text-center px-2">
                            Image failed to load
                        </Text>
                    ) : (
                        <Image
                            source={productImage}
                            style={{
                                width: '85%',
                                height: '85%',
                                resizeMode: 'contain',
                            }}
                            onError={() => setImageError(true)}
                        />
                    )}
                </View>

                {/* Product Name and Status */}
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-black flex-1">
                        {formatItemName(product.item)}
                    </Text>
                    <View className={`px-3 py-1 rounded-full ${
                        product.is_active ? 'bg-background' : 'bg-gray-400'
                    }`}>
                        <Text className={`text-xs font-medium ${
                            product.is_active ? 'text-black' : 'text-white'
                        }`}>
                            {product.is_active ? 'listed' : 'unlisted'}
                        </Text>
                    </View>
                </View>

                {/* Price and Stock Info */}
                <Text className="text-xs text-gray-600">
                    from rs {getLowestPrice()}/unit • {getTotalQuantity()} in stock
                </Text>
            </TouchableOpacity>

        {/* Product Details Modal */}
            <Modal
                animationType="none"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View className="flex-1 justify-end">
                    <TouchableOpacity
                        onPress={closeModal}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                        activeOpacity={1}
                    >
                        <Animated.View
                            style={[
                                {
                                    flex: 1,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                                },
                                backgroundStyle
                            ]}
                        />
                    </TouchableOpacity>

                    <Animated.View
                        className="bg-surface rounded-t-[40px] overflow-hidden p-3"
                        style={[
                            { height: '86%' },
                            modalStyle
                        ]}
                    >
                        {/* Large Product Image - fixed at top */}
                        <View
                            className="h-[24rem] rounded-[40px] w-full mb-3 items-center justify-center"
                            style={{ backgroundColor: getProductBackgroundColor(product.item) }}
                        >
                            {imageError ? (
                                <Text className="text-sm text-gray-500 text-center px-4">
                                    Image failed to load
                                </Text>
                            ) : (
                                <Image
                                    source={productImage}
                                    style={{
                                        width: '60%',
                                        height: '60%',
                                        resizeMode: 'contain',
                                    }}
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </View>

                        {/* Fixed Content Layout */}
                        <View className="flex-1 p-2">
                            {/* Name and Status */}
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-xl font-medium text-black flex-1">
                                    {formatItemName(currentProduct.item)}
                                </Text>
                                <View className={`px-3 py-2 rounded-full ${
                                    currentProduct.is_active ? 'bg-light-100' : 'bg-gray-400'
                                }`}>
                                    <Text className={`text-sm font-medium ${
                                        currentProduct.is_active ? 'text-action-green' : 'text-white'
                                    }`}>
                                        {currentProduct.is_active ? 'listed' : 'unlisted'}
                                    </Text>
                                </View>
                            </View>

                            {/* Pricing & Stock */}
                            <View className="mb-6">
                                <View className="flex-row">
                                    {currentProduct.unit_prices.map((unitPrice, index) => (
                                        <View key={unitPrice.id} className="flex-row flex-1">
                                            <View className="flex-1 p-3 items-center">
                                                <Text className="text-base font-semibold text-black mb-1">
                                                    rs {unitPrice.price_per_unit} / {unitPrice.unit}
                                                </Text>
                                                <Text className="text-xs text-gray-600 mb-1">
                                                    {unitPrice.quantity_available} available
                                                </Text>
                                                <Text className="text-xs text-gray-500">
                                                    min: {unitPrice.minimum_order} {unitPrice.unit}
                                                </Text>
                                            </View>
                                            {index < currentProduct.unit_prices.length - 1 && (
                                                <View className="w-px bg-gray-200" />
                                            )}
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Description */}
                            {currentProduct.description && (
                                <View className="mb-6">
                                    <Text className="text-base font-medium text-black mb-2">
                                        description
                                    </Text>
                                    <Text className="text-gray-600 text-sm">
                                        {currentProduct.description}
                                    </Text>
                                </View>
                            )}

                            {/* Product Info */}
                            <View className="mb-3 p-3 bg-gray-50 rounded-xl">
                                <Text className="text-xs text-gray-600 mb-1">
                                    listed on: {new Date(currentProduct.created_at).toLocaleDateString()}
                                </Text>
                                <Text className="text-xs text-gray-600">
                                    last updated: {new Date(currentProduct.updated_at).toLocaleDateString()}
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View className="flex-row justify-center gap-8 pb-4">
                                <TouchableOpacity
                                    onPress={() => {
                                        closeModal();
                                        onEdit?.(currentProduct);
                                    }}
                                    className="p-3"
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="create" size={28} color="black" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleToggleStatus}
                                    className="p-3"
                                    activeOpacity={0.8}
                                    disabled={loading}
                                >
                                    <Ionicons
                                        name={loading ? "hourglass" : (currentProduct.is_active ? "eye-off" : "eye")}
                                        size={28}
                                        color={loading ? "#666666" : "black"}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                </View>

                {/* Custom Alert */}
                <CustomAlert
                    visible={alert.visible}
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    buttons={alert.buttons}
                    onClose={hideAlert}
                />
            </Modal>
        </>
    );
}