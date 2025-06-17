import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CartItemCard from './CartItemCard';

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

interface FarmerGroup {
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    items: CartItem[];
    subtotal: number;
}

interface CartFarmerGroupProps {
    farmerGroup: FarmerGroup;
    onUpdateQuantity: (itemId: number, newQuantity: number) => void;
    onRemoveItem: (itemId: number) => void;
    onCheckout: () => void;
    updatingItems: Set<number>;
}

export default function CartFarmerGroup({
    farmerGroup,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    updatingItems
}: CartFarmerGroupProps) {

    return (
        <View className="mx-6 bg-surface rounded-xl border border-gray-200 overflow-hidden">
            {/* Farmer Header */}
            <View className="bg-background p-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="person" size={16} color="#4CAF50" />
                            <Text className="text-base font-medium text-black ml-2">
                                {farmerGroup.farmer_name}
                            </Text>
                        </View>
                        <View className="flex-row items-center">
                            <Ionicons name="location-outline" size={14} color="#666666" />
                            <Text className="text-sm text-gray-600 ml-1">
                                {farmerGroup.farmer_district}
                            </Text>
                        </View>
                    </View>
                    <View className="items-end">
                        <Text className="text-sm text-gray-600">
                            {farmerGroup.items.length} item{farmerGroup.items.length !== 1 ? 's' : ''}
                        </Text>
                        <Text className="text-base font-semibold text-action-green">
                            rs {farmerGroup.subtotal.toFixed(2)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Cart Items */}
            <View className="p-4 pt-0">
                {farmerGroup.items.map((item, index) => (
                    <View key={item.id}>
                        <CartItemCard
                            item={item}
                            onUpdateQuantity={onUpdateQuantity}
                            onRemove={onRemoveItem}
                            isUpdating={updatingItems.has(item.id)}
                        />
                        {index < farmerGroup.items.length - 1 && (
                            <View className="h-px bg-gray-200 my-3" />
                        )}
                    </View>
                ))}
            </View>

            {/* Checkout Button */}
            <View className="p-4 pt-0">
                <TouchableOpacity
                    onPress={onCheckout}
                    className="bg-action-green py-3 px-4 rounded-xl flex-row items-center justify-center"
                    activeOpacity={0.7}
                >
                    <Ionicons name="card" size={20} color="white" />
                    <Text className="text-white font-medium ml-2">
                        checkout with {farmerGroup.farmer_name.split(' ')[0].toLowerCase()}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}