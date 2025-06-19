import { useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    runOnJS
} from 'react-native-reanimated';

interface HeaderProps {
    title: string;
    showBackButton?: boolean;
    showCartButton?: boolean;
    showSettingsButton?: boolean;
    showLogoutButton?: boolean;
}

export default function Header({
   title,
   showBackButton = false,
   showCartButton = false,
   showSettingsButton = false,
   showLogoutButton = false,
}: HeaderProps) {
    const { logout } = useContext(AuthContext);
    const { cartItemCount, isFlashing, refreshCartCount } = useCart();

    // Animation values - ONLY for the badge
    const badgeScale = useSharedValue(1);
    const badgeBackgroundColor = useSharedValue(0);

    const handleBackPress = () => router.back();
    const handleCartPress = () => router.push('/(auth)/customer/cart');
    const handleSettingsPress = () => router.push('/profile');
    const handleLogout = () => logout();

    // Animated styles for cart badge ONLY
    const animatedBadgeStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: badgeScale.value }],
            backgroundColor: `rgba(239, 68, 68, ${1 - badgeBackgroundColor.value * 0.5})`, // Flash between red-500 and lighter red
        };
    });

    // Trigger flash animation when isFlashing changes
    useEffect(() => {
        if (isFlashing) {
            // Scale animation for badge only
            badgeScale.value = withSequence(
                withSpring(1.3, { damping: 8, stiffness: 200 }),
                withSpring(1, { damping: 8, stiffness: 200 })
            );

            // Background color pulse for badge only
            badgeBackgroundColor.value = withSequence(
                withTiming(1, { duration: 150 }),
                withTiming(0, { duration: 150 }),
                withTiming(1, { duration: 150 }),
                withTiming(0, { duration: 150 })
            );

            // Refresh cart count after animation
            setTimeout(() => {
                runOnJS(refreshCartCount)();
            }, 100);
        }
    }, [isFlashing]);

    return (
        <View className="bg-background rounded-bl-[40px] rounded-br-[40px]" style={{ height: '20%' }}>
            <View className="pl-6 pr-6 justify-end h-full pb-5">
                <View className="flex-row justify-between items-center">
                    <Text className="text-2xl font-semibold text-black">
                        {title.toLowerCase()}
                    </Text>
                    <View className="flex-row items-center gap-4">
                        {showCartButton && (
                            <TouchableOpacity
                                onPress={handleCartPress}
                                activeOpacity={0.7}
                                className="relative"
                            >
                                {/* Cart icon - NO animation */}
                                <Ionicons
                                    name="cart-outline"
                                    size={24}
                                    color="#000000"
                                />

                                {/* Cart Badge - WITH animation */}
                                {cartItemCount > 0 && (
                                    <Animated.View
                                        style={[
                                            {
                                                position: 'absolute',
                                                top: -8,
                                                right: -8,
                                                borderRadius: 10,
                                                minWidth: 20,
                                                height: 20,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                borderWidth: 2,
                                                borderColor: '#ffffff',
                                            },
                                            animatedBadgeStyle
                                        ]}
                                    >
                                        <Text
                                            className="text-white text-xs font-bold"
                                            style={{
                                                fontSize: cartItemCount > 99 ? 8 : 10,
                                                lineHeight: cartItemCount > 99 ? 10 : 12
                                            }}
                                        >
                                            {cartItemCount > 99 ? '99+' : cartItemCount}
                                        </Text>
                                    </Animated.View>
                                )}
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