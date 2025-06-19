// context/FarmerOrdersContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/context/AuthContext';
import api from '@/services/api';

interface FarmerOrdersContextType {
    pendingOrdersCount: number;
    refreshPendingOrdersCount: () => Promise<void>;
}

const FarmerOrdersContext = createContext<FarmerOrdersContextType>({
    pendingOrdersCount: 0,
    refreshPendingOrdersCount: async () => {},
});

export const useFarmerOrders = () => {
    const context = useContext(FarmerOrdersContext);
    if (!context) {
        throw new Error('useFarmerOrders must be used within a FarmerOrdersProvider');
    }
    return context;
};

interface FarmerOrdersProviderProps {
    children: ReactNode;
}

export const FarmerOrdersProvider = ({ children }: FarmerOrdersProviderProps) => {
    const { user } = useContext(AuthContext);
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

    const refreshPendingOrdersCount = async () => {
        try {
            // Only fetch for farmers
            if (user?.role !== 'farmer') {
                setPendingOrdersCount(0);
                return;
            }

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setPendingOrdersCount(0);
                return;
            }

            const response = await api.get('/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Count orders that are not delivered or cancelled
            const pendingOrders = response.data.filter((order: any) =>
                !['delivered', 'cancelled'].includes(order.status)
            );

            setPendingOrdersCount(pendingOrders.length);
        } catch (error) {
            console.error('Error fetching pending orders count:', error);
            setPendingOrdersCount(0);
        }
    };

    useEffect(() => {
        // Only refresh when user changes and is a farmer
        if (user?.role === 'farmer') {
            refreshPendingOrdersCount();
        } else {
            setPendingOrdersCount(0);
        }
    }, [user]);

    return (
        <FarmerOrdersContext.Provider value={{
            pendingOrdersCount,
            refreshPendingOrdersCount,
        }}>
            {children}
        </FarmerOrdersContext.Provider>
    );
};