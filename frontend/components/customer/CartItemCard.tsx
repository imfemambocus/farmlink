import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProductImage } from '@/constants/images';

interface CartItem {
    id: number;
    farmer_product_id: number;
    unit_price_id: number;
    quantity: number;
    unit_price_snapshot: number;
    total_price: number;
    product_name: string;
    unit_name: string;
    farmer_name: string;
}

interface CartItemCardProps {
    item: CartItem;
    onUpdateQuantity: (itemId: number, newQuantity: number) => void;
    onRemove: (itemId: number) => void;
    isUpdating: boolean;
}

export default function CartItemCard({
                                         item,
                                         onUpdateQuantity,
                                         onRemove,
                                         isUpdating
                                     }: CartItemCardProps) {
    const [imageError, setImageError] = useState(false);

    // Convert product name back to enum format for image lookup
    const getItemKey = (productName: string) => {
        return productName.toLowerCase().replace(/\s+/g, '_');
    };

    const productImage = getProductImage(getItemKey(item.product_name));

    const getProductBackgroundColor = (productName: string) => {
        const itemKey = getItemKey(productName);
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
        return colorMap[itemKey] || '#f5f5f5';
    };

    const handleQuantityChange = (delta: number) => {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0) {
            onUpdateQuantity(item.id, newQuantity);
        }
    };

    return (
        <View className="py-3">
            <View className="flex-row items-center">
                {/* Product Image */}
                <View
                    className="w-16 h-16 rounded-xl items-center justify-center mr-4"
                    style={{ backgroundColor: getProductBackgroundColor(item.product_name) }}
                >
                    {imageError ? (
                        <Text className="text-xs text-gray-500 text-center px-1">
                            No image
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

                {/* Product Info */}
                <View className="flex-1">
                    <Text className="text-base font-medium text-black mb-1">
                        {item.product_name}
                    </Text>
                    <Text className="text-sm text-gray-600 mb-2">
                        rs {item.unit_price_snapshot} / {item.unit_name}
                    </Text>

                    {/* Quantity Controls */}
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={() => handleQuantityChange(-1)}
                                className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
                                activeOpacity={0.7}
                                disabled={isUpdating || item.quantity <= 1}
                            >
                                {isUpdating ? (
                                    <ActivityIndicator size="small" color="#666" />
                                ) : (
                                    <Ionicons
                                        name="remove"
                                        size={16}
                                        color={item.quantity <= 1 ? "#ccc" : "#000"}
                                    />
                                )}
                            </TouchableOpacity>

                            <Text className="mx-4 text-base font-medium text-black min-w-[30px] text-center">
                                {item.quantity}
                            </Text>

                            <TouchableOpacity
                                onPress={() => handleQuantityChange(1)}
                                className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
                                activeOpacity={0.7}
                                disabled={isUpdating}
                            >
                                {isUpdating ? (
                                    <ActivityIndicator size="small" color="#666" />
                                ) : (
                                    <Ionicons name="add" size={16} color="#000" />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Remove Button */}
                        <TouchableOpacity
                            onPress={() => onRemove(item.id)}
                            className="p-2"
                            activeOpacity={0.7}
                            disabled={isUpdating}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={18}
                                color={isUpdating ? "#ccc" : "#ef4444"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Total Price */}
                <View className="items-end ml-4">
                    <Text className="text-base font-semibold text-black">
                        rs {item.total_price.toFixed(2)}
                    </Text>
                </View>
            </View>
        </View>
    );
}