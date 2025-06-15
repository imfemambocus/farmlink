import { useContext } from 'react';
import { View, Text } from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/Header';

export default function FarmerDashboard() {
    const { user } = useContext(AuthContext);

    if (!user || user.role !== 'farmer') return null;

    const getFarmerName = () => {
        if (user.farmer_profile) {
            return user.farmer_profile.first_name || 'Farmer';
        }
        return 'Farmer';
    };

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="dashboard"
                showSettingsButton={true}
            />

            {/* Content Section */}
            <View className="flex-1 px-6 pt-6 justify-center items-center">
                <Text className="text-2xl font-medium text-black mb-4">
                    Welcome, {getFarmerName()}!
                </Text>
                <Text className="text-base text-gray-600 text-center">
                    Your farmer dashboard content will go here
                </Text>
            </View>
        </View>
    );
}