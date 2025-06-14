import { Stack } from "expo-router";
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
    return (
        <AuthProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            />
        </AuthProvider>
    );
}
