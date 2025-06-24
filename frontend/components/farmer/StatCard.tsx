import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    color?: string;
    subtitle?: string;
    loading?: boolean;
}

export default function StatCard({
     title,
     value,
     icon,
     color = '#4CAF50',
     subtitle,
     loading = false
 }: StatCardProps) {
    return (
        <View
            className="bg-white rounded-xl p-4 border border-gray-200 flex-1 mx-1 relative overflow-hidden"
            style={{ height: 120 }}
        >
            <View
                className="absolute -bottom-3 -right-3 rounded-full items-center justify-center"
                style={{
                    width: 60,
                    height: 60,
                    backgroundColor: `${color}15`
                }}
            >
                <Ionicons
                    name={icon as any}
                    size={30}
                    color={`${color}60`}
                />
            </View>

            <View className="flex-1 justify-between">
                <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-gray-700">
                        {title}
                    </Text>
                    {loading && (
                        <ActivityIndicator size={12} color={color} />
                    )}
                </View>

                <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                    {loading ? "..." : value}
                </Text>

                {subtitle && (
                    <Text className="text-xs text-gray-500" numberOfLines={1} style={{ marginTop: 4 }}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    );
}