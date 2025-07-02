import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const GOOGLE_TRANSLATE_API_KEY = Constants.expoConfig?.extra?.GOOGLE_TRANSLATE_API_KEY;
const TRANSLATION_CACHE_PREFIX = 'translation_cache_';
const CACHE_VERSION = '1.0';

interface TranslationCache {
    [sourceText: string]: {
        [targetLang: string]: {
            translation: string;
            timestamp: number;
            version: string;
        }
    }
}

interface TranslationRequest {
    text: string;
    targetLang: 'en' | 'fr';
    sourceLang?: 'en' | 'fr' | 'auto';
    cacheKey?: string;
}

export class TranslationService {
    private cache: TranslationCache = {};
    private cacheLoaded = false;
    private static readonly CACHE_EXPIRY_STATIC = 30 * 24 * 60 * 60 * 1000;
    private static readonly CACHE_EXPIRY_DYNAMIC = 7 * 24 * 60 * 60 * 1000;

    async init() {
        if (!this.cacheLoaded) {
            await this.loadCache();
            this.cacheLoaded = true;
        }
    }

    private async loadCache(): Promise<void> {
        try {
            const cacheData = await AsyncStorage.getItem(`${TRANSLATION_CACHE_PREFIX}main`);
            if (cacheData) {
                const parsedCache = JSON.parse(cacheData);
                if (parsedCache.version === CACHE_VERSION) {
                    this.cache = parsedCache.data || {};
                } else {
                    await this.clearCache();
                }
            }
        } catch (error) {
            console.error('Error loading translation cache:', error);
            this.cache = {};
        }
    }

    private async saveCache(): Promise<void> {
        try {
            await AsyncStorage.setItem(`${TRANSLATION_CACHE_PREFIX}main`, JSON.stringify({
                version: CACHE_VERSION,
                data: this.cache
            }));
        } catch (error) {
            console.error('Error saving translation cache:', error);
        }
    }

    private getCacheKey(text: string, customKey?: string): string {
        return customKey || text.trim().toLowerCase();
    }

    private isExpired(timestamp: number, isStatic: boolean = false): boolean {
        const maxAge = isStatic ? TranslationService.CACHE_EXPIRY_STATIC : TranslationService.CACHE_EXPIRY_DYNAMIC;
        return Date.now() - timestamp > maxAge;
    }

    private getCachedTranslation(text: string, targetLang: 'en' | 'fr', customKey?: string): string | null {
        const cacheKey = this.getCacheKey(text, customKey);
        const cached = this.cache[cacheKey]?.[targetLang];

        if (cached && cached.version === CACHE_VERSION && !this.isExpired(cached.timestamp)) {
            return cached.translation;
        }

        return null;
    }

    private setCachedTranslation(
        text: string,
        targetLang: 'en' | 'fr',
        translation: string,
        customKey?: string
    ): void {
        const cacheKey = this.getCacheKey(text, customKey);

        if (!this.cache[cacheKey]) {
            this.cache[cacheKey] = {};
        }

        this.cache[cacheKey][targetLang] = {
            translation,
            timestamp: Date.now(),
            version: CACHE_VERSION
        };
    }

    async translate({ text, targetLang, sourceLang = 'auto', cacheKey }: TranslationRequest): Promise<string> {
        if (!text.trim()) return text;

        await this.init();

        if (!GOOGLE_TRANSLATE_API_KEY) {
            return text;
        }

        const cached = this.getCachedTranslation(text, targetLang, cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const requestBody = {
                q: text,
                target: targetLang,
                ...(sourceLang !== 'auto' && { source: sourceLang })
            };

            const response = await fetch(
                `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }

            const data = await response.json();
            const translatedText = data.data.translations[0].translatedText;

            this.setCachedTranslation(text, targetLang, translatedText, cacheKey);
            await this.saveCache();

            return translatedText;
        } catch (error) {
            console.error('Translation error:', error);
            return text;
        }
    }

    async translateBatch(requests: TranslationRequest[]): Promise<string[]> {
        await this.init();

        const results: string[] = [];
        const uncachedRequests: { request: TranslationRequest; index: number }[] = [];

        requests.forEach((request, index) => {
            if (!request.text.trim()) {
                results[index] = request.text;
                return;
            }

            const cached = this.getCachedTranslation(request.text, request.targetLang, request.cacheKey);
            if (cached) {
                results[index] = cached;
            } else {
                uncachedRequests.push({ request, index });
            }
        });

        if (uncachedRequests.length > 0) {
            try {
                const textsToTranslate = uncachedRequests.map(ur => ur.request.text);
                const targetLang = uncachedRequests[0].request.targetLang;

                const response = await fetch(
                    `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            q: textsToTranslate,
                            target: targetLang,
                            format: 'text'
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`Translation API error: ${response.status}`);
                }

                const data = await response.json();
                const translations = data.data.translations;

                uncachedRequests.forEach((ur, i) => {
                    const translatedText = translations[i].translatedText;
                    results[ur.index] = translatedText;

                    this.setCachedTranslation(
                        ur.request.text,
                        ur.request.targetLang,
                        translatedText,
                        ur.request.cacheKey
                    );
                });

                await this.saveCache();
            } catch (error) {
                console.error('Batch translation error:', error);
                uncachedRequests.forEach(ur => {
                    results[ur.index] = ur.request.text;
                });
            }
        }

        return results;
    }

    async invalidateProductCache(productId: number): Promise<void> {
        await this.init();

        const cacheKey = `product_${productId}`;
        if (this.cache[cacheKey]) {
            delete this.cache[cacheKey];
            await this.saveCache();
        }
    }

    async clearCache(): Promise<void> {
        this.cache = {};
        await AsyncStorage.removeItem(`${TRANSLATION_CACHE_PREFIX}main`);
    }

    getCacheStats(): { entries: number; languages: string[] } {
        const languages = new Set<string>();
        let entries = 0;

        Object.values(this.cache).forEach(langCache => {
            Object.keys(langCache).forEach(lang => {
                languages.add(lang);
                entries++;
            });
        });

        return {
            entries,
            languages: Array.from(languages)
        };
    }
}

export const googleTranslationService = new TranslationService();