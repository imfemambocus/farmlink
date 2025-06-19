// context/CartContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

interface CartContextType {
    cartItemCount: number;
    refreshCartCount: () => Promise<void>;
    triggerCartFlash: () => void;
    isFlashing: boolean;
}

const CartContext = createContext<CartContextType>({
    cartItemCount: 0,
    refreshCartCount: async () => {},
    triggerCartFlash: () => {},
    isFlashing: false,
});

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

interface CartProviderProps {
    children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
    const [cartItemCount, setCartItemCount] = useState(0);
    const [isFlashing, setIsFlashing] = useState(false);

    const refreshCartCount = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cartData = response.data;
            const totalItems = Number(cartData.total_items) || 0;
            setCartItemCount(totalItems);
        } catch (error) {
            console.error('Error fetching cart count:', error);
            setCartItemCount(0);
        }
    };

    const triggerCartFlash = () => {
        setIsFlashing(true);
        setTimeout(() => {
            setIsFlashing(false);
        }, 600); // Flash for 600ms
    };

    useEffect(() => {
        refreshCartCount();
    }, []);

    return (
        <CartContext.Provider value={{
            cartItemCount,
            refreshCartCount,
            triggerCartFlash,
            isFlashing,
        }}>
            {children}
        </CartContext.Provider>
    );
};