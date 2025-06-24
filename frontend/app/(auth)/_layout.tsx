import { useContext, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';

export default function AuthLayout() {
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (!user) {
            router.replace('/intro');
        }
    }, [user]);

    if (!user) {
        return null;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="profile/index" />
        </Stack>
    );
}