import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    color?: string;
    subtitle?: string;
}

export default function StatCard({
     title,
     value,
     icon,
     color = '#4CAF50',
     subtitle
 }: StatCardProps) {
    return (
        <View className="bg-surface rounded-xl p-4 border border-gray-200 flex-1 mx-1">
            <View className="flex-row items-center justify-between mb-2">
                <View
                    className="rounded-full p-2"
                    style={{ backgroundColor: `${color}20` }}
                >
                    <Ionicons
                        name={icon as any}
                        size={20}
                        color={color}
                    />
                </View>
            </View>

            <Text className="text-2xl font-bold text-black mb-1">
                {value}
            </Text>

            <Text className="text-sm font-medium text-gray-700 mb-1">
                {title}
            </Text>

            {subtitle && (
                <Text className="text-xs text-gray-500">
                    {subtitle}
                </Text>
            )}
        </View>
    );
}