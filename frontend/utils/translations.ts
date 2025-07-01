import { useLanguage } from '@/context/LanguageContext';

// Helper function to format product names (removes underscores)
export const formatProductName = (productName: string): string => {
    return productName.replace(/_/g, ' ');
};

// Helper function to get plural form of unit
export const getPluralUnit = (unit: string, quantity: number): string => {
    if (quantity === 1) {
        return unit;
    }

    switch (unit) {
        case 'piece':
            return 'pieces';
        case 'bunch':
            return 'bunches';
        case 'dozen':
            return 'dozens';
        case 'basket':
            return 'baskets';
        case 'kg':
            return 'kgs';
        default:
            return unit + 's';
    }
};

// Custom hook for product translations
export const useProductTranslations = () => {
    const { t } = useLanguage();

    const translateProduct = (productName: string): string => {
        return t(`products.${productName}`) || formatProductName(productName);
    };

    const translateUnit = (unit: string, quantity: number = 1, showPlural: boolean = true): string => {
        if (!showPlural || quantity === 1) {
            return t(`units.${unit}`) || unit;
        }

        const pluralKey = getPluralUnit(unit, quantity);
        return t(`units.${pluralKey}`) || pluralKey;
    };

    const translateCategory = (category: string): string => {
        return t(`dashboard.${category}`) || category;
    };

    return {
        translateProduct,
        translateUnit,
        translateCategory,
        formatProductName,
    };
};