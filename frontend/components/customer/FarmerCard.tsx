import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FarmerCardProps {
    farmer: {
        id: number;
        name: string;
        district: string;
        product_count: number;
    };
    onPress: () => void;
    variant?: 'horizontal' | 'vertical';
}

export default function FarmerCard({ farmer, onPress, variant = 'horizontal' }: FarmerCardProps) {
    if (variant === 'vertical') {
        return (
            <TouchableOpacity
                onPress={onPress}
                className="bg-surface rounded-xl border border-gray-300 p-4 flex-1"
                activeOpacity={0.7}
            >
                {/* Top Row: Icon and Name */}
                <View className="flex-row items-center mb-3">
                    <Ionicons name="person-circle" size={24} color="#000000" />
                    <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                        {farmer.name}
                    </Text>
                </View>

                {/* Location */}
                <View className="flex-row items-center mb-3">
                    <Ionicons name="location-outline" size={14} color="#666666" />
                    <Text className="text-sm text-gray-600 ml-1" numberOfLines={1}>
                        {farmer.district}
                    </Text>
                </View>

                {/* Product Count */}
                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={14} color="#4CAF50" />
                    <Text className="text-sm text-action-green ml-1 font-medium">
                        {farmer.product_count} product{farmer.product_count !== 1 ? 's' : ''}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // Horizontal variant
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-background rounded-xl p-4 w-64"
            activeOpacity={0.7}
        >
            {/* Top Row: Icon and Name */}
            <View className="flex-row items-center mb-3">
                <Ionicons name="person-circle" size={32} color="#000000" />
                <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                    {farmer.name}
                </Text>
            </View>

            {/* Location */}
            <View className="flex-row items-center mb-3">
                <Ionicons name="location-outline" size={16} color="#666666" />
                <Text className="text-sm text-gray-600 ml-2" numberOfLines={1}>
                    {farmer.district}
                </Text>
            </View>

            {/* Product Count */}
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={16} color="#4CAF50" />
                    <Text className="text-sm text-action-green ml-2 font-medium">
                        {farmer.product_count} product{farmer.product_count !== 1 ? 's' : ''}
                    </Text>
                </View>

                {/* Arrow indicator */}
                <Ionicons name="chevron-forward" size={18} color="#666666" />
            </View>
        </TouchableOpacity>
    );
}