import { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '@/services/apiService';
import {User, AuthContextType, ProfileUpdateData} from '@/types';

export const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    logout: () => {},
    updateProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const login = async (email: string, password: string) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            const token = res.data.access_token;

            await AsyncStorage.setItem('token', token);

            const profileRes = await api.get<User>('/auth/profile', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setUser(profileRes.data);
            console.log('User logged in:', profileRes.data.email);
            router.replace('/(auth)/customer/homepage');
        } catch (error: any) {
            console.error('Login failed:', error.response?.data || error.message);
            throw error;
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        setUser(null);
        router.replace('/intro');
    };

    const updateProfile = async (profileData: ProfileUpdateData) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const res = await api.put<User>('/auth/profile', profileData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setUser(res.data);
        } catch (error: any) {
            console.error('Profile update failed:', error.response?.data || error.message);
            throw error;
        }
    };

    const checkLogin = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            if (token) {
                try {
                    const res = await api.get<User>('/auth/profile', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    setUser(res.data);
                } catch (error) {
                    console.log('Token invalid, removing from storage');
                    await AsyncStorage.removeItem('token');
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error checking login:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkLogin();
    }, []);

    if (isLoading) {
        return null;
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};