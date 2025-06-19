import { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useFarmerOrders } from '@/context/FarmerOrdersContext';
import { useCallback } from 'react';
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
    showOrdersButton?: boolean;
}

export default function Header({
   title,
   showBackButton = false,
   showCartButton = false,
   showSettingsButton = false,
   showLogoutButton = false,
   showOrdersButton = false,
}: HeaderProps) {
    const { logout, user } = useContext(AuthContext);
    const { cartItemCount, isFlashing, refreshCartCount } = useCart();
    const { pendingOrdersCount, refreshPendingOrdersCount } = useFarmerOrders();

    // Animation values - ONLY for the cart badge
    const badgeScale = useSharedValue(1);
    const badgeBackgroundColor = useSharedValue(0);

    const handleBackPress = () => router.back();
    const handleCartPress = () => router.push('/(auth)/customer/cart');
    const handleSettingsPress = () => router.push('/profile');
    const handleLogout = () => logout();

    const handleOrdersPress = () => {
        if (user?.farmer_profile) {
            router.push('/(auth)/farmer/orders');
        } else {
            router.push('/(auth)/customer/orders');
        }
    }

    // Refresh pending orders count when screen comes into focus
    // This ensures the count updates when navigating back from order details
    useFocusEffect(
        useCallback(() => {
            if (user?.role === 'farmer' && showOrdersButton) {
                refreshPendingOrdersCount();
            }
        }, [user?.role, showOrdersButton, refreshPendingOrdersCount])
    );

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
                    <View className="flex-row items-center gap-5">
                        {showCartButton && (
                            <TouchableOpacity
                                onPress={handleCartPress}
                                activeOpacity={0.7}
                                className="relative"
                            >
                                {/* Cart icon - NO animation */}
                                <Ionicons
                                    name="cart"
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
                        {showOrdersButton && user?.role === 'farmer' && (
                            <TouchableOpacity
                                onPress={handleOrdersPress}
                                activeOpacity={0.7}
                                className="relative"
                            >
                                <Ionicons
                                    name="receipt"
                                    size={24}
                                    color="#000000"
                                />

                                {/* Orders Badge for farmers - NO animation (static) */}
                                {pendingOrdersCount > 0 && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: -8,
                                            right: -8,
                                            backgroundColor: '#f59e0b', // amber-500
                                            borderRadius: 10,
                                            minWidth: 20,
                                            height: 20,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            borderWidth: 2,
                                            borderColor: '#ffffff',
                                        }}
                                    >
                                        <Text
                                            className="text-white text-xs font-bold"
                                            style={{
                                                fontSize: pendingOrdersCount > 99 ? 8 : 10,
                                                lineHeight: pendingOrdersCount > 99 ? 10 : 12
                                            }}
                                        >
                                            {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        {showOrdersButton && user?.role !== 'farmer' && (
                            <TouchableOpacity
                                onPress={handleOrdersPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="receipt"
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
                                    name="settings"
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
                                    name="log-out"
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