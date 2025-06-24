import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { Platform } from 'react-native';
import { translations, getNestedTranslation } from '@/constants/translations';

interface VoiceCommand {
    action: 'search' | 'add' | 'checkout' | 'unknown';
    product?: string;
    quantity?: number;
    unit?: string;
    district?: string;
    farmer?: string;
    confidence: number;
}

interface VoiceResult {
    success: boolean;
    command?: VoiceCommand;
    message: string;
    data?: any;
    suggestions?: string[];
}

interface ProductMatch {
    id: number;
    item: string;
    farmer_name: string;
    farmer_district: string;
    unit_prices: Array<{
        id: number;
        unit: string;
        customer_type: string;
        price_per_unit: number;
        quantity_available: number;
        minimum_order: number;
    }>;
}

class VoiceInputService {
    private isListening = false;
    private recognizedText = '';
    private isInitialized = false;

    private productMappings = new Map([
        ['tomato', ['tomato', 'tomate']],
        ['potato', ['potato', 'pomme de terre']],
        ['onion', ['onion', 'oignon']],
        ['carrot', ['carrot', 'carotte']],
        ['cabbage', ['cabbage', 'chou']],
        ['lettuce', ['lettuce', 'laitue']],
        ['spinach', ['spinach', 'épinard']],
        ['broccoli', ['broccoli', 'brocoli']],
        ['cauliflower', ['cauliflower', 'chou-fleur']],
        ['bell pepper', ['bell pepper', 'pepper', 'capsicum', 'poivron']],
        ['chili', ['chili', 'chilli', 'hot pepper', 'piment']],
        ['cucumber', ['cucumber', 'concombre']],
        ['eggplant', ['eggplant', 'aubergine', 'brinjal']],
        ['okra', ['okra', 'lady finger', 'gombo']],
        ['green beans', ['green beans', 'beans', 'haricots verts']],
        ['pumpkin', ['pumpkin', 'citrouille']],
        ['beetroot', ['beetroot', 'beet', 'betterave']],
        ['radish', ['radish', 'radis']],
        ['ginger', ['ginger', 'gingembre']],
        ['garlic', ['garlic', 'ail']],
        ['apple', ['apple', 'pomme']],
        ['banana', ['banana', 'banane']],
        ['orange', ['orange']],
        ['mango', ['mango', 'mangue']],
        ['pineapple', ['pineapple', 'ananas']],
        ['papaya', ['papaya', 'papaye']],
        ['guava', ['guava', 'goyave']],
        ['lychee', ['lychee', 'litchi']],
        ['coconut', ['coconut', 'coco']],
        ['lemon', ['lemon', 'citron']],
        ['lime', ['lime', 'citron vert']],
        ['watermelon', ['watermelon', 'pastèque']],
        ['melon', ['melon']],
        ['grapes', ['grapes', 'raisin']],
        ['strawberry', ['strawberry', 'fraise']]
    ]);

    private unitMappings = new Map([
        ['kilogram', ['kg', 'kilo', 'kilogram', 'kilograms']],
        ['gram', ['g', 'gram', 'grams', 'gramme', 'grammes']],
        ['piece', ['piece', 'pieces', 'unit', 'units', 'each']],
        ['bunch', ['bunch', 'bunches', 'bouquet']],
        ['dozen', ['dozen', 'douzaine']],
        ['basket', ['basket', 'baskets', 'panier']]
    ]);

    private districts = [
        'port louis', 'beau bassin-rose hill', 'vacoas-phoenix', 'curepipe', 'quatre bornes',
        'triolet', 'goodlands', 'centre de flacq', 'mahebourg', 'saint pierre', 'rose belle',
        'riviere du rempart', 'grand baie', 'pamplemousses', 'grand port', 'black river',
        'moka', 'plaines wilhems', 'riviere noire', 'savanne', 'flacq'
    ];

    constructor() {}

    private getCurrentLanguage(): 'en' | 'fr' {
        return 'en';
    }

    private t(key: string, params?: Record<string, string | number>): string {
        const language = this.getCurrentLanguage();
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
    }

    private async initializeVoice() {
        if (this.isInitialized) return;

        try {
            if (Platform.OS === 'web') {
                console.warn('Voice recognition not available on web platform');
                return;
            }

            Voice.onSpeechStart = this.onSpeechStart;
            Voice.onSpeechRecognized = this.onSpeechRecognized;
            Voice.onSpeechEnd = this.onSpeechEnd;
            Voice.onSpeechError = this.onSpeechError;
            Voice.onSpeechResults = this.onSpeechResults;

            this.isInitialized = true;
            console.log('🎤 Voice service initialized successfully');
        } catch (error) {
            console.error('Voice initialization error:', error);
            throw new Error(this.t('voice.voiceNotAvailable'));
        }
    }

    private onSpeechStart = () => {
        console.log('🎤 Voice: Speech started');
        this.isListening = true;
    };

    private onSpeechRecognized = () => {
        console.log('🎤 Voice: Speech recognized');
    };

    private onSpeechEnd = () => {
        console.log('🎤 Voice: Speech ended');
        this.isListening = false;
    };

    private onSpeechError = (error: SpeechErrorEvent) => {
        console.error('🎤 Voice: Speech error', error);
        this.isListening = false;
    };

    private onSpeechResults = (event: SpeechResultsEvent) => {
        if (event.value && event.value.length > 0) {
            this.recognizedText = event.value[0];
            console.log('🎤 Voice: Recognized text:', this.recognizedText);
        }
    };

    async startListening(): Promise<void> {
        try {
            await this.initializeVoice();

            if (this.isListening) {
                await this.stopListening();
            }

            this.recognizedText = '';

            await Voice.start('en-US');
            this.isListening = true;
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            throw new Error(this.t('voice.failedToStart'));
        }
    }

    async stopListening(): Promise<string> {
        try {
            if (this.isListening) {
                await Voice.stop();
            }
            this.isListening = false;
            return this.recognizedText;
        } catch (error) {
            console.error('Error stopping voice recognition:', error);
            this.isListening = false;
            return this.recognizedText;
        }
    }

    async processVoiceCommand(
        recognizedText: string,
        customerType: 'individual' | 'business'
    ): Promise<VoiceResult> {
        try {
            console.log('🤖 Processing voice command:', recognizedText);

            if (!recognizedText || recognizedText.trim().length === 0) {
                return {
                    success: false,
                    message: this.t('voice.didntHear'),
                    suggestions: [
                        this.t('voice.makesSure'),
                        this.t('voice.checkPermissions'),
                        this.t('voice.tryQuieter')
                    ]
                };
            }

            const command = this.parseVoiceCommand(recognizedText);
            console.log('🧠 Parsed command:', command);

            if (command.confidence < 0.3) {
                return {
                    success: false,
                    message: this.t('voice.didntUnderstand'),
                    suggestions: [
                        this.t('voice.searchForTomatoes'),
                        this.t('voice.addToCart'),
                        this.t('voice.findCarrots'),
                        this.t('voice.checkoutItems')
                    ]
                };
            }

            switch (command.action) {
                case 'search':
                    return await this.executeSearch(command, customerType);
                case 'add':
                    return await this.executeAddToCart(command, customerType);
                case 'checkout':
                    return await this.executeCheckout();
                default:
                    return {
                        success: false,
                        message: this.t('voice.understoodButNoAction'),
                        suggestions: [
                            this.t('voice.searchForProduct'),
                            this.t('voice.addQuantityProduct'),
                            this.t('voice.checkoutItems')
                        ]
                    };
            }
        } catch (error) {
            console.error('Error processing voice command:', error);
            return {
                success: false,
                message: this.t('voice.errorProcessing')
            };
        }
    }

    private parseVoiceCommand(text: string): VoiceCommand {
        const normalizedText = text.toLowerCase().trim();
        console.log('🔍 Parsing:', normalizedText);

        let command: VoiceCommand = {
            action: 'unknown',
            confidence: 0
        };

        if (this.containsWords(normalizedText, ['search', 'find', 'look for', 'show me'])) {
            command.action = 'search';
            command.confidence += 0.4;
        } else if (this.containsWords(normalizedText, ['add', 'put', 'include', 'cart'])) {
            command.action = 'add';
            command.confidence += 0.4;
        } else if (this.containsWords(normalizedText, ['checkout', 'check out', 'buy', 'purchase', 'order now'])) {
            command.action = 'checkout';
            command.confidence += 0.8;
            return command;
        }

        const detectedProduct = this.detectProduct(normalizedText);
        if (detectedProduct) {
            command.product = detectedProduct;
            command.confidence += 0.3;
        }

        const { quantity, unit } = this.detectQuantityAndUnit(normalizedText);
        if (quantity) {
            command.quantity = quantity;
            command.confidence += 0.2;
        }
        if (unit) {
            command.unit = unit;
            command.confidence += 0.1;
        }

        const detectedDistrict = this.detectDistrict(normalizedText);
        if (detectedDistrict) {
            command.district = detectedDistrict;
            command.confidence += 0.1;
        }

        console.log('📊 Final command confidence:', command.confidence);
        return command;
    }

    private async executeSearch(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: this.t('voice.pleaseLoginSearch') };
            }

            const searchParams: any = { limit: 20 };

            if (command.product) {
                searchParams.search = command.product;
            }
            if (command.district) {
                searchParams.district = command.district;
            }

            console.log('🔍 Searching with params:', searchParams);

            const response = await api.get('/browse/products/search', {
                params: searchParams,
                headers: { Authorization: `Bearer ${token}` }
            });

            const products = response.data.items || [];

            const filteredProducts = products.filter((product: any) =>
                product.unit_prices.some((up: any) =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (filteredProducts.length === 0) {
                let message = this.t('voice.noProductsFound', {
                    product: command.product || this.t('common.products')
                });
                if (command.district) {
                    message += ` ${this.t('voice.fromFarmersIn', { district: command.district })}`;
                }
                message += ` ${this.t('voice.forCustomerType', { customerType })}`;

                return {
                    success: false,
                    message,
                    suggestions: [
                        this.t('voice.tryWithoutDistrict'),
                        this.t('voice.searchDifferentProduct'),
                        this.t('voice.searchVegetables')
                    ]
                };
            }

            const productNames = filteredProducts.slice(0, 5).map((p: any) => p.item).join(', ');
            let message = this.t('voice.foundResults', {
                count: filteredProducts.length,
                plural: filteredProducts.length > 1 ? 's' : ''
            });
            if (command.district) {
                message += ` ${this.t('voice.fromDistrict', { district: command.district })}`;
            }
            message += `: ${productNames}${filteredProducts.length > 5 ? ` ${this.t('voice.andMore')}` : ''}`;

            return {
                success: true,
                message,
                data: { products: filteredProducts, searchTerm: command.product }
            };

        } catch (error) {
            console.error('Search error:', error);
            return {
                success: false,
                message: this.t('voice.searchError')
            };
        }
    }

    private async executeAddToCart(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: this.t('voice.pleaseLoginCart') };
            }

            if (!command.product) {
                return {
                    success: false,
                    message: this.t('voice.specifyProduct')
                };
            }

            const searchResponse = await api.get('/browse/products/search', {
                params: { search: command.product, limit: 10 },
                headers: { Authorization: `Bearer ${token}` }
            });

            const products: ProductMatch[] = searchResponse.data.items || [];

            const suitableProducts = products.filter(product =>
                product.unit_prices.some(up =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (suitableProducts.length === 0) {
                return {
                    success: false,
                    message: this.t('voice.productNotAvailable', {
                        product: command.product,
                        customerType
                    }),
                    suggestions: [
                        this.t('voice.searchProductFirst'),
                        this.t('voice.searchSimilarProducts'),
                        this.t('voice.tryAgainLater')
                    ]
                };
            }

            const bestMatch = this.findBestProductMatch(suitableProducts, command, customerType);
            if (!bestMatch) {
                return {
                    success: false,
                    message: this.t('voice.foundButCouldntMatch', { product: command.product })
                };
            }

            const finalQuantity = this.calculateFinalQuantity(
                command.quantity || 1,
                bestMatch.unitPrice.minimum_order,
                customerType
            );

            if (finalQuantity > bestMatch.unitPrice.quantity_available) {
                return {
                    success: false,
                    message: this.t('voice.onlyAvailable', {
                        available: bestMatch.unitPrice.quantity_available,
                        unit: bestMatch.unitPrice.unit,
                        product: bestMatch.product.item,
                        farmer: bestMatch.product.farmer_name
                    }),
                    suggestions: [
                        this.t('voice.trySmallerQuantity'),
                        this.t('voice.searchOtherFarmers')
                    ]
                };
            }

            await api.post('/orders/cart/items', {
                farmer_product_id: bestMatch.product.id,
                unit_price_id: bestMatch.unitPrice.id,
                quantity: finalQuantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const totalCost = (finalQuantity * bestMatch.unitPrice.price_per_unit).toFixed(2);

            return {
                success: true,
                message: this.t('voice.addedToCart', {
                    quantity: finalQuantity,
                    unit: bestMatch.unitPrice.unit,
                    product: bestMatch.product.item,
                    farmer: bestMatch.product.farmer_name,
                    cost: totalCost
                }),
                data: {
                    product: bestMatch.product.item,
                    farmer: bestMatch.product.farmer_name,
                    quantity: finalQuantity,
                    unit: bestMatch.unitPrice.unit,
                    cost: totalCost
                }
            };

        } catch (error: any) {
            console.error('Add to cart error:', error);

            if (error.response?.status === 400) {
                return {
                    success: false,
                    message: error.response.data.detail || this.t('voice.unableToAddItem')
                };
            }

            return {
                success: false,
                message: this.t('voice.errorAddingItem')
            };
        }
    }

    private async executeCheckout(): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: this.t('voice.pleaseLoginCheckout') };
            }

            const cartResponse = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cart = cartResponse.data;

            if (!cart.farmer_groups || cart.farmer_groups.length === 0) {
                return {
                    success: false,
                    message: this.t('voice.cartEmpty'),
                    suggestions: [
                        this.t('voice.addTomatoesToCart'),
                        this.t('voice.searchForVegetables')
                    ]
                };
            }

            const itemCount = Number(cart.total_items) || 0;
            const totalAmount = Number(cart.total_amount) || 0;
            const farmerCount = cart.farmer_groups ? cart.farmer_groups.length : 0;

            return {
                success: true,
                message: this.t('voice.proceedingToCheckout', {
                    items: itemCount,
                    farmers: farmerCount,
                    plural: farmerCount > 1 ? 's' : '',
                    amount: totalAmount.toFixed(2)
                }),
                data: {
                    action: 'navigate_to_checkout',
                    cart: cart
                }
            };

        } catch (error) {
            console.error('Checkout error:', error);
            return {
                success: false,
                message: this.t('voice.checkoutError')
            };
        }
    }

    private containsWords(text: string, words: string[]): boolean {
        return words.some(word => text.includes(word));
    }

    private detectProduct(text: string): string | undefined {
        for (const [product, variants] of this.productMappings) {
            if (variants.some(variant => text.includes(variant))) {
                return product;
            }
        }
        return undefined;
    }

    private detectQuantityAndUnit(text: string): { quantity?: number; unit?: string } {
        const quantityRegex = /(\d+(?:\.\d+)?|\bhalf\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)/i;
        const quantityMatch = text.match(quantityRegex);

        let quantity: number | undefined;
        if (quantityMatch) {
            const quantityStr = quantityMatch[1].toLowerCase();
            if (quantityStr === 'half') quantity = 0.5;
            else if (quantityStr === 'one') quantity = 1;
            else if (quantityStr === 'two') quantity = 2;
            else if (quantityStr === 'three') quantity = 3;
            else if (quantityStr === 'four') quantity = 4;
            else if (quantityStr === 'five') quantity = 5;
            else if (quantityStr === 'six') quantity = 6;
            else if (quantityStr === 'seven') quantity = 7;
            else if (quantityStr === 'eight') quantity = 8;
            else if (quantityStr === 'nine') quantity = 9;
            else if (quantityStr === 'ten') quantity = 10;
            else quantity = parseFloat(quantityStr);
        }

        let unit: string | undefined;
        for (const [standardUnit, variants] of this.unitMappings) {
            if (variants.some(variant => text.includes(variant))) {
                unit = standardUnit === 'kilogram' ? 'kg' :
                    standardUnit === 'gram' ? 'g' :
                        standardUnit;
                break;
            }
        }

        return { quantity, unit };
    }

    private detectDistrict(text: string): string | undefined {
        return this.districts.find(district =>
            text.includes(district) || text.includes(district.replace(/\s+/g, ''))
        );
    }

    private findBestProductMatch(
        products: ProductMatch[],
        command: VoiceCommand,
        customerType: 'individual' | 'business'
    ) {
        for (const product of products) {
            const suitableUnitPrices = product.unit_prices.filter(up =>
                up.customer_type === customerType && up.quantity_available > 0
            );

            if (command.unit) {
                const matchingUnitPrice = suitableUnitPrices.find(up =>
                    up.unit.toLowerCase() === command.unit?.toLowerCase() ||
                    this.unitMappings.get(command.unit || '')?.includes(up.unit.toLowerCase())
                );

                if (matchingUnitPrice) {
                    return { product, unitPrice: matchingUnitPrice };
                }
            }

            if (suitableUnitPrices.length > 0) {
                const bestUnitPrice = suitableUnitPrices.sort((a, b) => a.price_per_unit - b.price_per_unit)[0];
                return { product, unitPrice: bestUnitPrice };
            }
        }

        return null;
    }

    private calculateFinalQuantity(
        requestedQuantity: number,
        minimumOrder: number,
        customerType: 'individual' | 'business'
    ): number {
        const quantityStep = customerType === 'business' ? 25 : 1;
        const adjustedMinimum = Math.ceil(minimumOrder / quantityStep) * quantityStep;
        return Math.max(requestedQuantity, adjustedMinimum);
    }

    async checkPermissions(): Promise<boolean> {
        try {
            if (Platform.OS === 'web') {
                return false;
            }

            await this.initializeVoice();
            const available = await Voice.isAvailable();
            return available === 1;
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    async cleanup(): Promise<void> {
        try {
            if (this.isListening) {
                await Voice.stop();
            }
            if (this.isInitialized) {
                await Voice.destroy();
                Voice.removeAllListeners();
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    getIsListening(): boolean {
        return this.isListening;
    }
}

export default new VoiceInputService();