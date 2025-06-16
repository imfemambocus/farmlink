import { useContext } from 'react';
import { View, Text } from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/Header';

export default function Homepage() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    const getUserName = () => {
        if (user.role === 'individual' && user.individual_profile) {
            return user.individual_profile.first_name || 'User';
        } else if (user.role === 'business' && user.business_profile) {
            return user.business_profile.business_name || 'Business';
        }
        return 'User';
    };

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="browse"
                showCartButton={true}
                showSettingsButton={true}
            />

            {/* Content Section */}
            <View className="flex-1 px-6 pt-6 justify-center items-center">
                <Text className="text-2xl font-medium text-black mb-4">
                    Welcome, {getUserName()}!
                </Text>
                <Text className="text-base text-gray-600 text-center">
                    Your {user.role} homepage content will go here
                </Text>
            </View>
        </View>
    );
}