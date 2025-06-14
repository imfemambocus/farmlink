import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { User, AuthContextType } from '@/types';

export const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    const login = async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const token = res.data.access_token;
        await AsyncStorage.setItem('token', token);

        const profileRes = await api.get<User>('/auth/profile', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        setUser(profileRes.data);
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        setUser(null);
    };

    const checkLogin = async () => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            try {
                const res = await api.get<User>('/auth/profile', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(res.data);
            } catch {
                logout();
            }
        }
    };

    useEffect(() => {
        checkLogin();
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
