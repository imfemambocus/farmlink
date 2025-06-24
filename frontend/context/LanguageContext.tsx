import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { translations, getNestedTranslation } from '@/constants/translations';

export type Language = 'en' | 'fr';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: string, params?: Record<string, string | number>) => string;
    getErrorMessage: (error: any) => string;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: async () => {},
    t: (key: string) => key,
    getErrorMessage: (error: any) => 'Error',
    isLoading: true,
});

const LANGUAGE_STORAGE_KEY = 'user_language_preference';

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setCurrentLanguage] = useState<Language>('en');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        initializeLanguage();
    }, []);

    const initializeLanguage = async () => {
        try {
            const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

            if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'fr')) {
                setCurrentLanguage(storedLanguage as Language);
            } else {
                const deviceLanguages = getLocales();
                const deviceLanguage = deviceLanguages[0]?.languageCode;

                if (deviceLanguage === 'fr') {
                    setCurrentLanguage('fr');
                } else {
                    setCurrentLanguage('en');
                }
            }
        } catch (error) {
            console.error('Error initializing language:', error);
            setCurrentLanguage('en');
        } finally {
            setIsLoading(false);
        }
    };

    const setLanguage = async (lang: Language) => {
        try {
            setCurrentLanguage(lang);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch (error) {
            console.error('Error saving language preference:', error);
        }
    };

    const t = (key: string, params?: Record<string, string | number>): string => {
        const translation = getNestedTranslation(translations[language], key);

        if (!params) {
            return translation;
        }

        let result = translation;
        Object.entries(params).forEach(([paramKey, paramValue]) => {
            const placeholder = `{${paramKey}}`;
            result = result.replace(new RegExp(placeholder, 'g'), String(paramValue));
        });

        return result;
    };

    const getErrorMessage = (error: any): string => {
        if (error?.response?.status >= 500) {
            return t('auth.serverError');
        }
        if (error?.code === 'NETWORK_ERROR' || !error?.response) {
            return t('auth.networkError');
        }
        if (error?.response?.data?.detail) {
            return error.response.data.detail;
        }
        return t('auth.unknownError');
    };

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            t,
            isLoading,
            getErrorMessage,
        }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export const useTranslation = () => {
    const { t, getErrorMessage } = useLanguage();

    return {
        t,
        getErrorMessage,
        tCommon: (key: string, params?: Record<string, string | number>) => t(`common.${key}`, params),
        tAuth: (key: string, params?: Record<string, string | number>) => t(`auth.${key}`, params),
        tValidation: (key: string, params?: Record<string, string | number>) => t(`validation.${key}`, params),
        tDashboard: (key: string, params?: Record<string, string | number>) => t(`dashboard.${key}`, params),
        tCustomer: (key: string, params?: Record<string, string | number>) => t(`customer.${key}`, params),
        tCart: (key: string, params?: Record<string, string | number>) => t(`cart.${key}`, params),
        tProfile: (key: string, params?: Record<string, string | number>) => t(`profile.${key}`, params),
        tCheckout: (key: string, params?: Record<string, string | number>) => t(`checkout.${key}`, params),
        tNotifications: (key: string, params?: Record<string, string | number>) => t(`notifications.${key}`, params),
        tVoice: (key: string, params?: Record<string, string | number>) => t(`voice.${key}`, params),
        tProducts: (key: string, params?: Record<string, string | number>) => t(`productManagement.${key}`, params),
        tOrders: (key: string, params?: Record<string, string | number>) => t(`orders.${key}`, params),
    };
};