import { useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';

interface HeaderProps {
    title: string;
    showBackButton?: boolean;
    showCartButton?: boolean;
    showSettingsButton?: boolean;
    showLogoutButton?: boolean;
    onBackPress?: () => void;
    onCartPress?: () => void;
    onSettingsPress?: () => void;
}

export default function Header({
                                   title,
                                   showBackButton = false,
                                   showCartButton = false,
                                   showSettingsButton = false,
                                   showLogoutButton = true,
                                   onBackPress,
                                   onCartPress,
                                   onSettingsPress
                               }: HeaderProps) {
    const { logout } = useContext(AuthContext);

    const handleBackPress = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            router.back();
        }
    };

    const handleCartPress = () => {
        if (onCartPress) {
            onCartPress();
        }
        // Default cart navigation can be added here later
    };

    const handleSettingsPress = () => {
        if (onSettingsPress) {
            onSettingsPress();
        } else {
            router.push('/profile');
        }
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <View className="bg-light-100 rounded-bl-[40px] rounded-br-[40px]" style={{ height: '20%' }}>
            <View className="pl-6 pr-6 justify-end h-full pb-5">
                <View className="flex-row justify-between items-center">
                    <Text className="text-3xl font-medium text-black">
                        {title}
                    </Text>
                    <View className="flex-row items-center gap-4">
                        {showCartButton && (
                            <TouchableOpacity
                                onPress={handleCartPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="cart-outline"
                                    size={24}
                                    color="#000000"
                                />
                            </TouchableOpacity>
                        )}
                        {showSettingsButton && (
                            <TouchableOpacity
                                onPress={handleSettingsPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="settings-outline"
                                    size={24}
                                    color="#000000"
                                />
                            </TouchableOpacity>
                        )}
                        {showBackButton && (
                            <TouchableOpacity
                                onPress={handleBackPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="arrow-back"
                                    size={24}
                                    color="#000000"
                                />
                            </TouchableOpacity>
                        )}
                        {showLogoutButton && (
                            <TouchableOpacity
                                onPress={handleLogout}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="log-out-outline"
                                    size={24}
                                    color="#000000"
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}