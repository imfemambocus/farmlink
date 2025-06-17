import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
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
    onAddToCart: (product: Product, unitPriceId: number, quantity: number) => void;
    formatItemName: (item: string) => string;
    showAddToCart?: boolean;
}

export default function ProductCard({
    product,
    onAddToCart,
    formatItemName,
}: ProductCardProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUnitPrice, setSelectedUnitPrice] = useState<UnitPrice | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [imageError, setImageError] = useState(false);
    const [addingToCart, setAddingToCart] = useState(false);

    const backgroundOpacity = useSharedValue(0);
    const modalTranslateY = useSharedValue(1000);

    const productImage = getProductImage(product.item);

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
        if (product.unit_prices.length > 0) {
            setSelectedUnitPrice(product.unit_prices[0]);
            setQuantity(product.unit_prices[0].minimum_order);
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
        setQuantity(unitPrice.minimum_order);
    };

    const adjustQuantity = (delta: number) => {
        if (!selectedUnitPrice) return;

        const newQuantity = quantity + delta;
        if (newQuantity >= selectedUnitPrice.minimum_order &&
            newQuantity <= selectedUnitPrice.quantity_available) {
            setQuantity(newQuantity);
        }
    };

    const handleAddToCart = async () => {
        if (!selectedUnitPrice || addingToCart) return;

        setAddingToCart(true);
        try {
            await onAddToCart(product, selectedUnitPrice.id, quantity);
            closeModal();
        } catch (error) {
            // Error is handled in parent component
        } finally {
            setAddingToCart(false);
        }
    };

    const backgroundStyle = useAnimatedStyle(() => ({
        opacity: backgroundOpacity.value,
    }));

    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

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
                        {formatItemName(product.item)}
                    </Text>
                    <View className="px-3 py-1 bg-light-100 rounded-full">
                        <Text className="text-xs text-action-green font-medium">
                            {product.category}
                        </Text>
                    </View>
                </View>

                {/* Price and Add to Cart */}
                <View className="flex-row items-end justify-between">
                    <View>
                        <Text className="text-xs text-gray-500 mb-1">
                            {product.unit_prices.map(up => up.unit).join(', ')}
                        </Text>
                        <View className="flex-row items-baseline">
                            <Text className="text-base font-bold text-black">
                                rs {product.unit_prices.length > 0 ? product.unit_prices[0].price_per_unit : product.lowest_price}
                            </Text>
                            <Text className="text-xs text-gray-500 ml-1">
                                / {product.unit_prices.length > 0 ? product.unit_prices[0].unit : 'unit'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            // Add first unit price with minimum quantity
                            if (product.unit_prices.length > 0) {
                                const firstUnitPrice = product.unit_prices[0];
                                onAddToCart(product, firstUnitPrice.id, firstUnitPrice.minimum_order);
                            }
                        }}
                        className="bg-background px-2 py-2 rounded-lg"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="basket" size={16} color="black" />
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
                            {/* Product Name and Farmer */}
                            <View className="mb-3">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-xl font-medium text-black flex-1">
                                        {formatItemName(product.item)}
                                    </Text>
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
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Text className="text-base text-gray-600">produced by: </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                closeModal();
                                                // Navigate to farmer products page
                                                // This would be handled by the parent component
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
                                    select unit & price
                                </Text>
                                <View className="flex-row gap-2">
                                    {product.unit_prices.map((unitPrice) => (
                                        <TouchableOpacity
                                            key={unitPrice.id}
                                            onPress={() => handleUnitPriceSelect(unitPrice)}
                                            className={`p-3 rounded-lg border ${
                                                selectedUnitPrice?.id === unitPrice.id
                                                    ? 'bg-gray-100 border-action-green'
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                            style={{
                                                flex: product.unit_prices.length === 1 ? 1 : 1 / product.unit_prices.length,
                                                maxWidth: product.unit_prices.length === 1 ? '100%' : `${100 / product.unit_prices.length}%`
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
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Quantity Selection */}
                            {selectedUnitPrice && (
                                <View className="mb-5">
                                    <Text className="text-base font-medium text-black mb-2">
                                        quantity
                                    </Text>
                                    <View className="flex-row gap-4">
                                        {/* Left Column - Quantity Controls */}
                                        <View className="flex-1">
                                            <View className="flex-row items-center justify-between bg-gray-100 rounded-lg p-2">
                                                <TouchableOpacity
                                                    onPress={() => adjustQuantity(-1)}
                                                    className="w-8 h-8 bg-background rounded items-center justify-center"
                                                    activeOpacity={0.7}
                                                    disabled={quantity <= selectedUnitPrice.minimum_order}
                                                >
                                                    <Ionicons
                                                        name="remove"
                                                        size={16}
                                                        color={quantity <= selectedUnitPrice.minimum_order ? "#ccc" : "#000"}
                                                    />
                                                </TouchableOpacity>

                                                <View className="flex-1 mx-3 items-center">
                                                    <Text className="text-lg font-medium text-black">
                                                        {quantity}
                                                    </Text>
                                                    <Text className="text-xs text-gray-600">
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
                                        <View className="flex-1 bg-gray-100 rounded-lg p-3 justify-center items-center flex flex-row gap-2">
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
                                    onPress={handleAddToCart}
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