import { Stack } from "expo-router";
import { AuthProvider } from '@/context/AuthContext';
import { useFonts } from "expo-font";
import { useEffect } from "react";
import * as SplashScreen from 'expo-splash-screen';
import './globals.css';
import { CartProvider } from "@/context/CartContext";
import { FarmerOrdersProvider } from "@/context/FarmerOrdersContext";
import {NotificationProvider} from "@/context/NotificationContext";

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
        'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
        'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
        'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    });

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <AuthProvider>
            <CartProvider>
                <FarmerOrdersProvider>
                    <NotificationProvider>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                            }}
                        />
                    </NotificationProvider>
                </FarmerOrdersProvider>
            </CartProvider>
        </AuthProvider>
    );
}