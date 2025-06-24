import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/context/LanguageContext';

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
    const { tCommon } = useTranslation();

    const getProductText = (count: number): string => {
        return count === 1 ? tCommon('product') : tCommon('products');
    };

    if (variant === 'vertical') {
        return (
            <TouchableOpacity
                onPress={onPress}
                className="bg-surface rounded-xl border border-gray-300 p-4 flex-1"
                activeOpacity={0.7}
            >
                <View className="flex-row items-center mb-3">
                    <Ionicons name="person-circle" size={24} color="#000000" />
                    <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                        {farmer.name}
                    </Text>
                </View>

                <View className="flex-row items-center mb-3">
                    <Ionicons name="location-outline" size={14} color="#666666" />
                    <Text className="text-sm text-gray-600 ml-1" numberOfLines={1}>
                        {farmer.district}
                    </Text>
                </View>

                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={14} color="#4CAF50" />
                    <Text className="text-sm text-black ml-1 font-medium">
                        {farmer.product_count} {getProductText(farmer.product_count)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-background rounded-xl p-4 w-64"
            activeOpacity={0.7}
        >
            <View className="flex-row items-center mb-3">
                <Ionicons name="person-circle" size={32} color="#000000" />
                <Text className="text-sm font-semibold text-black ml-3 flex-1" numberOfLines={1}>
                    {farmer.name}
                </Text>
            </View>

            <View className="flex-row items-center mb-3">
                <Ionicons name="location-outline" size={16} color="#666666" />
                <Text className="text-sm text-gray-600 ml-2" numberOfLines={1}>
                    {farmer.district}
                </Text>
            </View>

            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Ionicons name="leaf-outline" size={16} color="#4CAF50" />
                    <Text className="text-sm text-black ml-2 font-medium">
                        {farmer.product_count} {getProductText(farmer.product_count)}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#666666" />
            </View>
        </TouchableOpacity>
    );
}