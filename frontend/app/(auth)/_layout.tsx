import { useContext, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

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
        <>
            <StatusBar style="dark" />

            <Stack screenOptions={{ headerShown: false }} />
        </>
    );
}