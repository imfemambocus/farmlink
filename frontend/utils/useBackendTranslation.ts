import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import {googleTranslationService} from "@/services/googleTranslationService";

interface UseBackendTranslationOptions {
    cacheKey?: string; // For product descriptions: `product_${productId}`
    isStatic?: boolean; // For notification types that don't change
    enableBatch?: boolean; // For batch translations
}

interface TranslationState {
    translatedText: string;
    isTranslating: boolean;
    error: string | null;
}

// Single text translation hook
export const useBackendTranslation = (
    originalText: string,
    options: UseBackendTranslationOptions = {}
) => {
    const { language } = useLanguage();
    const [state, setState] = useState<TranslationState>({
        translatedText: originalText,
        isTranslating: false,
        error: null
    });

    useEffect(() => {
        if (!originalText?.trim()) {
            setState({
                translatedText: originalText,
                isTranslating: false,
                error: null
            });
            return;
        }

        // If the text is already in the target language, don't translate
        // You can enhance this with language detection if needed
        if (shouldSkipTranslation(originalText, language)) {
            setState({
                translatedText: originalText,
                isTranslating: false,
                error: null
            });
            return;
        }

        translateText();
    }, [originalText, language, options.cacheKey]);

    const shouldSkipTranslation = (text: string, targetLang: string): boolean => {
        // Basic language detection
        const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const frenchWords = ['le', 'la', 'les', 'et', 'ou', 'mais', 'dans', 'sur', 'à', 'pour', 'de', 'avec', 'par'];

        const lowerText = text.toLowerCase();
        const hasEnglish = englishWords.some(word => lowerText.includes(` ${word} `));
        const hasFrench = frenchWords.some(word => lowerText.includes(` ${word} `));

        // If text appears to be in English and target is English, skip
        if (hasEnglish && !hasFrench && targetLang === 'en') return true;
        // If text appears to be in French and target is French, skip
        if (hasFrench && !hasEnglish && targetLang === 'fr') return true;

        return false;
    };

    const translateText = async () => {
        setState(prev => ({ ...prev, isTranslating: true, error: null }));

        try {
            const translatedText = await googleTranslationService.translate({
                text: originalText,
                targetLang: language,
                cacheKey: options.cacheKey
            });

            setState({
                translatedText,
                isTranslating: false,
                error: null
            });
        } catch (error) {
            console.error('Translation error:', error);
            setState({
                translatedText: originalText, // Fallback to original
                isTranslating: false,
                error: error instanceof Error ? error.message : 'Translation failed'
            });
        }
    };

    return state;
};

// Batch translation hook for multiple texts
export const useBatchTranslation = (
    texts: Array<{ text: string; cacheKey?: string }>,
    options: UseBackendTranslationOptions = {}
) => {
    const { language } = useLanguage();
    const [state, setState] = useState<{
        translatedTexts: string[];
        isTranslating: boolean;
        error: string | null;
    }>({
        translatedTexts: texts.map(t => t.text),
        isTranslating: false,
        error: null
    });

    useEffect(() => {
        if (!texts.length) {
            setState({
                translatedTexts: [],
                isTranslating: false,
                error: null
            });
            return;
        }

        translateTexts();
    }, [JSON.stringify(texts), language]);

    const translateTexts = async () => {
        setState(prev => ({ ...prev, isTranslating: true, error: null }));

        try {
            const requests = texts.map(({ text, cacheKey }) => ({
                text,
                targetLang: language,
                cacheKey
            }));

            const translatedTexts = await googleTranslationService.translateBatch(requests);

            setState({
                translatedTexts,
                isTranslating: false,
                error: null
            });
        } catch (error) {
            console.error('Batch translation error:', error);
            setState({
                translatedTexts: texts.map(t => t.text),
                isTranslating: false,
                error: error instanceof Error ? error.message : 'Translation failed'
            });
        }
    };

    return state;
};

// Specialized hooks for your specific use cases

// For product descriptions - uses product ID for cache invalidation
export const useProductDescriptionTranslation = (description: string, productId: number) => {
    return useBackendTranslation(description, {
        cacheKey: `product_${productId}`,
        isStatic: false
    });
};

// For notification titles and messages - static content that rarely changes
export const useNotificationTranslation = (title: string, message: string, notificationType: string) => {
    const titleState = useBackendTranslation(title, {
        cacheKey: `notification_title_${notificationType}`,
        isStatic: true
    });

    const messageState = useBackendTranslation(message, {
        cacheKey: `notification_message_${notificationType}`,
        isStatic: true
    });

    return {
        translatedTitle: titleState.translatedText,
        translatedMessage: messageState.translatedText,
        isTranslating: titleState.isTranslating || messageState.isTranslating,
        error: titleState.error || messageState.error
    };
};

// For AI recommendation messages - static content
export const useRecommendationTranslation = (message: string, hasHistory: boolean) => {
    return useBackendTranslation(message, {
        cacheKey: `recommendation_${hasHistory ? 'with_history' : 'no_history'}`,
        isStatic: true
    });
};