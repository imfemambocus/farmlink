import { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from "expo-router";
import { getProductBackgroundColor } from "@/utils/products";
import { UnitPrice } from "@/types";
import { useCart } from '@/context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: UnitPrice[];
    created_at: string;
}

interface ProductCardProps {
    product: Product;
}

// Helper functions
const getFilteredUnitPrices = (unitPrices: UnitPrice[], userRole: string): UnitPrice[] => {
    if (userRole === 'farmer') {
        return unitPrices;
    }

    const customerType = userRole as 'individual' | 'business';
    return unitPrices.filter(up => up.customer_type === customerType);
};

const getQuantityStep = (userRole: string): number => {
    return userRole === 'business' ? 25 : 1;
};

export default function ProductCard({ product }: ProductCardProps) {
    const { user } = useContext(AuthContext);
    const { triggerCartFlash } = useCart();
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUnitPrice, setSelectedUnitPrice] = useState<UnitPrice | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [imageError, setImageError] = useState(false);
    const [addingToCart, setAddingToCart] = useState(false);

    const backgroundOpacity = useSharedValue(0);
    const modalTranslateY = useSharedValue(1000);

    const productImage = getProductImage(product.item);
    const userRole = user?.role || 'individual';
    const quantityStep = getQuantityStep(userRole);

    // Filter unit prices based on user role
    const filteredUnitPrices = getFilteredUnitPrices(product.unit_prices, userRole);

    const addToCart = async (unitPriceId: number, selectedQuantity: number) => {
        try {
            setAddingToCart(true);
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                router.replace('/login');
                return;
            }

            await api.post('/orders/cart/items', {
                farmer_product_id: product.id,
                unit_price_id: unitPriceId,
                quantity: selectedQuantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Trigger cart flash animation instead of showing alert
            triggerCartFlash();

        } catch (error: any) {
            console.error('Error adding to cart:', error);
            // For errors, we could still show a brief message or just log
            // For now, we'll just log the error
        } finally {
            setAddingToCart(false);
        }
    };

    const quickAddToCart = async () => {
        if (filteredUnitPrices.length > 0) {
            const firstUnitPrice = filteredUnitPrices[0];
            const minOrder = firstUnitPrice.minimum_order;
            const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
            const finalQuantity = Math.max(adjustedMinOrder, quantityStep);

            await addToCart(firstUnitPrice.id, finalQuantity);
        }
    };

    const addToCartFromModal = async () => {
        if (selectedUnitPrice) {
            await addToCart(selectedUnitPrice.id, quantity);
            closeModal(); // Close modal after adding to cart
        }
    };

    const openModal = () => {
        if (filteredUnitPrices.length > 0) {
            setSelectedUnitPrice(filteredUnitPrices[0]);
            // Set quantity to minimum order, adjusted to quantity step
            const minOrder = filteredUnitPrices[0].minimum_order;
            const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
            setQuantity(Math.max(adjustedMinOrder, quantityStep));
        }
        setModalVisible(true);
        setImageError(false);
        backgroundOpacity.value = withTiming(1, { duration: 300 });
        modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 100 });
    };

    const closeModal = () => {
        backgroundOpacity.value = withTiming(0, { duration: 200 });
        modalTranslateY.value = withTiming(1000, { duration: 250 });
        setTimeout(() => {
            setModalVisible(false);
        }, 250);
    };

    const handleUnitPriceSelect = (unitPrice: UnitPrice) => {
        setSelectedUnitPrice(unitPrice);
        // Adjust quantity to minimum order and quantity step
        const minOrder = unitPrice.minimum_order;
        const adjustedMinOrder = Math.ceil(minOrder / quantityStep) * quantityStep;
        setQuantity(Math.max(adjustedMinOrder, quantityStep));
    };

    const adjustQuantity = (delta: number) => {
        if (!selectedUnitPrice) return;

        const newQuantity = quantity + (delta * quantityStep);
        const adjustedMinOrder = Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep;
        const minQuantity = Math.max(adjustedMinOrder, quantityStep);

        if (newQuantity >= minQuantity && newQuantity <= selectedUnitPrice.quantity_available) {
            setQuantity(newQuantity);
        }
    };

    const backgroundStyle = useAnimatedStyle(() => ({
        opacity: backgroundOpacity.value,
    }));

    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    // Don't render if no prices available for this user type
    if (filteredUnitPrices.length === 0) {
        return null;
    }

    return (
        <>
            {/* Main Product Card */}
            <TouchableOpacity
                onPress={openModal}
                className="bg-surface rounded-xl border border-gray-200 p-4"
                activeOpacity={0.7}
            >
                {/* Product Image Container */}
                <View className="w-1/2 aspect-square rounded-[40px] items-center justify-center mb-3 self-center">
                    {imageError ? (
                        <Text className="text-xs text-gray-500 text-center px-2">
                            Image failed to load
                        </Text>
                    ) : (
                        <Image
                            source={productImage}
                            style={{
                                width: '100%',
                                height: '100%',
                                resizeMode: 'contain',
                            }}
                            onError={() => setImageError(true)}
                        />
                    )}
                </View>

                {/* Product Name and Category Tag */}
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm font-medium text-black flex-1" numberOfLines={1}>
                        {product.item.toLowerCase()}
                    </Text>
                    <View className="px-3 py-1 bg-light-100 rounded-full">
                        <Text className="text-xs text-black font-medium">
                            {product.category}
                        </Text>
                    </View>
                </View>

                {/* Price and Add to Cart */}
                <View className="flex-row items-end justify-between">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <Text className="text-xs text-gray-500">
                                {filteredUnitPrices.map(up => up.unit).join(', ')}
                            </Text>
                        </View>
                        <View className="flex-row items-baseline">
                            <Text className="text-base font-bold text-black">
                                rs {filteredUnitPrices.length > 0 ? filteredUnitPrices[0].price_per_unit : product.lowest_price}
                            </Text>
                            <Text className="text-xs text-gray-500 ml-1">
                                / {filteredUnitPrices.length > 0 ? filteredUnitPrices[0].unit : 'unit'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            quickAddToCart();
                        }}
                        className="bg-background px-2 py-2 rounded-lg"
                        activeOpacity={0.7}
                        disabled={addingToCart}
                    >
                        {addingToCart ? (
                            <View className="w-4 h-4">
                                <Text className="text-xs text-center">...</Text>
                            </View>
                        ) : (
                            <Ionicons name="basket" size={16} color="black" />
                        )}
                    </TouchableOpacity>
                </View>
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
                        {/* Large Product Image */}
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
                                        width: '80%',
                                        height: '80%',
                                        resizeMode: 'contain',
                                    }}
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </View>

                        {/* Fixed Content Layout */}
                        <View className="flex-1 p-2">
                            {/* Product Name and Farmer */}
                            <View className="mb-3">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-xl font-medium text-black flex-1">
                                        {product.item.toLowerCase()}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        {userRole === 'business' && (
                                            <View className="px-3 py-1 bg-blue-100 rounded-full">
                                                <Text className="text-xs text-blue-600 font-medium">
                                                    bulk pricing
                                                </Text>
                                            </View>
                                        )}
                                        {/* Fresh indicator for items listed in last 3 days */}
                                        {(() => {
                                            const listingDate = new Date(product.created_at);
                                            const threeDaysAgo = new Date();
                                            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                                            return listingDate > threeDaysAgo;
                                        })() && (
                                            <View className="flex-row items-center">
                                                <Ionicons name="leaf" size={12} color="#4CAF50" />
                                                <Text className="text-xs text-action-green ml-1 font-medium">
                                                    fresh
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Text className="text-base text-gray-600">produced by: </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                closeModal();
                                                router.push(`/(auth)/customer/farmers/${product.farmer_id}`);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text className="text-base text-action-green font-medium">
                                                {product.farmer_name}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="location-outline" size={14} color="#666666" />
                                        <Text className="text-sm text-gray-600 ml-1">
                                            {product.farmer_district}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Description */}
                            {product.description && (
                                <View className="mb-3">
                                    <Text className="text-base font-medium text-black mb-2">
                                        description
                                    </Text>
                                    <Text className="text-gray-600 text-sm">
                                        {product.description}
                                    </Text>
                                </View>
                            )}

                            {/* Pricing & Stock */}
                            <View className="mb-3">
                                <Text className="text-base font-medium text-black mb-2">
                                    {userRole === 'business' ? 'select unit & bulk price' : 'select unit & price'}
                                </Text>
                                <View className="flex-row gap-2">
                                    {filteredUnitPrices.map((unitPrice) => (
                                        <TouchableOpacity
                                            key={unitPrice.id}
                                            onPress={() => handleUnitPriceSelect(unitPrice)}
                                            className={`p-3 rounded-lg border ${
                                                selectedUnitPrice?.id === unitPrice.id
                                                    ? 'bg-gray-100 border-action-green'
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                            style={{
                                                flex: filteredUnitPrices.length === 1 ? 1 : 1 / filteredUnitPrices.length,
                                                maxWidth: filteredUnitPrices.length === 1 ? '100%' : `${100 / filteredUnitPrices.length}%`
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text className={`text-center text-sm ${
                                                selectedUnitPrice?.id === unitPrice.id
                                                    ? 'text-action-green font-medium'
                                                    : 'text-black'
                                            }`}>
                                                rs {unitPrice.price_per_unit} / {unitPrice.unit}
                                            </Text>
                                            {userRole === 'business' && (
                                                <Text className="text-xs text-gray-500 text-center mt-1">
                                                    min: {unitPrice.minimum_order}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Quantity Selection */}
                            {selectedUnitPrice && (
                                <View className="mb-5">
                                    <Text className="text-base font-medium text-black mb-2">
                                        quantity {userRole === 'business' && `(steps of ${quantityStep})`}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        {/* Left Column - Quantity Controls */}
                                        <View className="flex-[65%]">
                                            <View className="flex-row items-center justify-between bg-gray-100 rounded-lg p-2">
                                                <TouchableOpacity
                                                    onPress={() => adjustQuantity(-1)}
                                                    className="w-8 h-8 bg-background rounded items-center justify-center"
                                                    activeOpacity={0.7}
                                                    disabled={quantity <= Math.max(
                                                        Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep,
                                                        quantityStep
                                                    )}
                                                >
                                                    <Ionicons
                                                        name="remove"
                                                        size={16}
                                                        color={quantity <= Math.max(
                                                            Math.ceil(selectedUnitPrice.minimum_order / quantityStep) * quantityStep,
                                                            quantityStep
                                                        ) ? "#ccc" : "#000"}
                                                    />
                                                </TouchableOpacity>

                                                <View className="flex-1 mx-3 items-center">
                                                    <Text className="text-lg font-medium text-black">
                                                        {quantity}
                                                    </Text>
                                                    <Text className="text-xs text-gray-600 text-center">
                                                        min: {selectedUnitPrice.minimum_order} | max: {selectedUnitPrice.quantity_available}
                                                    </Text>
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => adjustQuantity(1)}
                                                    className="w-8 h-8 bg-background rounded items-center justify-center"
                                                    activeOpacity={0.7}
                                                    disabled={quantity >= selectedUnitPrice.quantity_available}
                                                >
                                                    <Ionicons
                                                        name="add"
                                                        size={16}
                                                        color={quantity >= selectedUnitPrice.quantity_available ? "#ccc" : "#000"}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Right Column - Total Price */}
                                        <View className="flex-[35%] bg-gray-100 rounded-lg p-3 justify-center items-center flex flex-row gap-2">
                                            <Text className="text-center text-lg font-semibold">
                                                rs {(selectedUnitPrice.price_per_unit * quantity).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Action Button */}
                            <View className="pb-2">
                                <TouchableOpacity
                                    onPress={addToCartFromModal}
                                    className="bg-background py-4 px-6 rounded-xl"
                                    activeOpacity={0.7}
                                    disabled={addingToCart || !selectedUnitPrice}
                                >
                                    <Text className="text-center font-medium text-black">
                                        {addingToCart ? 'adding to cart...' : 'add to cart'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
}