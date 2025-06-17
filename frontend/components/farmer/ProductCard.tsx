import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getProductBackgroundColor} from "@/utils/products";
import {UnitPrice} from "@/types";

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

    // Helper functions for pricing calculations
    const getIndividualPrices = () => {
        return product.unit_prices.filter(up => up.customer_type === 'individual');
    };

    const getBusinessPrices = () => {
        return product.unit_prices.filter(up => up.customer_type === 'business');
    };

    const getTotalIndividualQuantity = () => {
        return getIndividualPrices().reduce((total, up) => total + up.quantity_available, 0);
    };

    const getTotalBusinessQuantity = () => {
        return getBusinessPrices().reduce((total, up) => total + up.quantity_available, 0);
    };

    // Group unit prices by unit for modal display
    const getGroupedPrices = () => {
        const grouped: { [unit: string]: { individual?: UnitPrice; business?: UnitPrice } } = {};

        currentProduct.unit_prices.forEach(up => {
            if (!grouped[up.unit]) {
                grouped[up.unit] = {};
            }
            grouped[up.unit][up.customer_type] = up;
        });

        return grouped;
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
                <View className="flex-row items-center justify-between mb-3">
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

                {/* Updated Price and Stock Info - Simplified */}
                <Text className="text-xs text-gray-600">
                    dual pricing • {getTotalIndividualQuantity() + getTotalBusinessQuantity()} in stock
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
                        className="bg-surface rounded-t-[40px] overflow-hidden"
                        style={[
                            { height: '86%' },
                            modalStyle
                        ]}
                    >
                        {/* Scrollable Content */}
                        <ScrollView
                            className="flex-1 p-3"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            {/* Large Product Image */}
                            <View
                                className="h-[24rem] rounded-[40px] w-full mb-6 items-center justify-center"
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

                            {/* Updated Pricing & Stock */}
                            <View className="mb-6">
                                <Text className="text-base font-medium text-black mb-3">
                                    pricing & stock
                                </Text>

                                {Object.entries(getGroupedPrices()).map(([unit, prices]) => (
                                    <View key={unit} className="mb-4 p-3 bg-gray-50 rounded-xl">
                                        <Text className="text-sm font-medium text-black mb-3 text-center">
                                            {unit}
                                        </Text>

                                        <View className="flex-row gap-3">
                                            {/* Individual Pricing */}
                                            <View className="flex-1 p-3 bg-white rounded-lg border border-green-200">
                                                <View className="flex-row items-center mb-2">
                                                    <Ionicons name="person" size={14} color="#10B981" />
                                                    <Text className="text-xs font-medium text-green-700 ml-1">
                                                        Individual
                                                    </Text>
                                                </View>
                                                {prices.individual ? (
                                                    <>
                                                        <Text className="text-sm font-semibold text-black mb-1">
                                                            rs {prices.individual.price_per_unit}
                                                        </Text>
                                                        <Text className="text-xs text-gray-600 mb-1">
                                                            {prices.individual.quantity_available} available
                                                        </Text>
                                                        <Text className="text-xs text-gray-500">
                                                            min: {prices.individual.minimum_order}
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text className="text-xs text-gray-500 italic">
                                                        Not available
                                                    </Text>
                                                )}
                                            </View>

                                            {/* Business Pricing */}
                                            <View className="flex-1 p-3 bg-white rounded-lg border border-blue-200">
                                                <View className="flex-row items-center mb-2">
                                                    <Ionicons name="business" size={14} color="#3B82F6" />
                                                    <Text className="text-xs font-medium text-blue-700 ml-1">
                                                        Business
                                                    </Text>
                                                </View>
                                                {prices.business ? (
                                                    <>
                                                        <Text className="text-sm font-semibold text-black mb-1">
                                                            rs {prices.business.price_per_unit}
                                                        </Text>
                                                        <Text className="text-xs text-gray-600 mb-1">
                                                            {prices.business.quantity_available} available
                                                        </Text>
                                                        <Text className="text-xs text-gray-500">
                                                            min: {prices.business.minimum_order}
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text className="text-xs text-gray-500 italic">
                                                        Not available
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))}
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
                            <View className="mb-6 p-3 bg-gray-50 rounded-xl">
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
                        </ScrollView>
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