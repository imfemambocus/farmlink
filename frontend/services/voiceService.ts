import Voice, { SpeechResultsEvent, SpeechErrorEvent } from 'react-native-voice-enhanced';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/apiService';
import { Platform, PermissionsAndroid } from 'react-native';

interface VoiceCommand {
    action: 'search' | 'add' | 'checkout' | 'unknown';
    product?: string;
    quantity?: number;
    unit?: string;
    district?: string;
    confidence: number;
}

interface VoiceResult {
    success: boolean;
    command?: VoiceCommand;
    message: string;
    data?: any;
}

class VoiceInputService {
    private isListening = false;
    private recognizedText = '';

    private productMappings = new Map([
        ['tomato', ['tomato', 'tomatoes']],
        ['potato', ['potato', 'potatoes']],
        ['onion', ['onion', 'onions']],
        ['carrot', ['carrot', 'carrots']],
        ['cabbage', ['cabbage']],
        ['lettuce', ['lettuce']],
        ['spinach', ['spinach']],
        ['broccoli', ['broccoli']],
        ['cauliflower', ['cauliflower']],
        ['bell pepper', ['bell pepper', 'pepper', 'capsicum']],
        ['chili', ['chili', 'chilli', 'hot pepper']],
        ['cucumber', ['cucumber', 'cucumbers']],
        ['eggplant', ['eggplant', 'aubergine', 'brinjal']],
        ['okra', ['okra', 'lady finger']],
        ['green beans', ['green beans', 'beans']],
        ['pumpkin', ['pumpkin']],
        ['beetroot', ['beetroot', 'beet']],
        ['radish', ['radish']],
        ['ginger', ['ginger']],
        ['garlic', ['garlic']],
        ['apple', ['apple', 'apples']],
        ['banana', ['banana', 'bananas']],
        ['orange', ['orange', 'oranges']],
        ['mango', ['mango', 'mangoes']],
        ['pineapple', ['pineapple']],
        ['papaya', ['papaya']],
        ['guava', ['guava']],
        ['lychee', ['lychee']],
        ['coconut', ['coconut']],
        ['lemon', ['lemon', 'lemons']],
        ['lime', ['lime', 'limes']],
        ['watermelon', ['watermelon']],
        ['melon', ['melon']],
        ['grapes', ['grapes']],
        ['strawberry', ['strawberry', 'strawberries']]
    ]);

    private unitMappings = new Map([
        ['kilogram', ['kg', 'kilo', 'kilogram', 'kilograms']],
        ['gram', ['g', 'gram', 'grams']],
        ['piece', ['piece', 'pieces', 'unit', 'units', 'each']],
        ['bunch', ['bunch', 'bunches']],
        ['dozen', ['dozen']],
        ['basket', ['basket', 'baskets']]
    ]);

    private districts = [
        'port louis', 'beau bassin-rose hill', 'vacoas-phoenix', 'curepipe', 'quatre bornes',
        'triolet', 'goodlands', 'centre de flacq', 'mahebourg', 'saint pierre', 'rose belle',
        'riviere du rempart', 'grand baie', 'pamplemousses', 'grand port', 'black river',
        'moka', 'plaines wilhems', 'riviere noire', 'savanne', 'flacq'
    ];

    constructor() {
        this.setupVoiceListeners();
    }

    private setupVoiceListeners() {
        Voice.onSpeechResults = (event: SpeechResultsEvent) => {
            if (event.value && event.value.length > 0) {
                this.recognizedText = event.value[0];
            }
        };

        Voice.onSpeechError = (error: SpeechErrorEvent) => {
            console.log('Voice error:', error);
            this.isListening = false;
        };

        Voice.onSpeechEnd = () => {
            this.isListening = false;
        };
    }

    async checkPermissions(): Promise<boolean> {
        try {
            if (Platform.OS === 'android') {
                // Just check if the permission is granted
                const granted = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
                );
                return granted;
            }

            // For iOS, return true - permission will be requested when starting voice
            return true;
        } catch (error) {
            console.log('Permission check error:', error);
            return false;
        }
    }

    async requestPermissions(): Promise<boolean> {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'Farmlink needs microphone access for voice commands to search products and add items to cart',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );

                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }

            // For iOS, return true - permission will be requested when starting voice
            return true;
        } catch (error) {
            console.log('Permission request error:', error);
            return false;
        }
    }

    async startListening(): Promise<void> {
        try {
            if (this.isListening) {
                await Voice.stop();
            }

            // For Android, make sure we have permission before starting
            if (Platform.OS === 'android') {
                const hasPermission = await this.checkPermissions();
                if (!hasPermission) {
                    throw new Error('Microphone permission not granted');
                }
            }

            this.recognizedText = '';
            await Voice.start('en-US');
            this.isListening = true;
        } catch (error: any) {
            this.isListening = false;
            if (error.message?.includes('permission') || error.message?.includes('denied')) {
                throw new Error('Microphone permission denied');
            }
            throw new Error('Failed to start voice recognition');
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
            this.isListening = false;
            return this.recognizedText;
        }
    }

    async processVoiceCommand(text: string, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            if (!text?.trim()) {
                return {
                    success: false,
                    message: "I didn't hear anything. Please try again."
                };
            }

            const command = this.parseCommand(text);

            if (command.confidence < 0.3) {
                return {
                    success: false,
                    message: "I didn't understand that command."
                };
            }

            switch (command.action) {
                case 'search':
                    return await this.handleSearch(command, customerType);
                case 'add':
                    return await this.handleAddToCart(command, customerType);
                case 'checkout':
                    return await this.handleCheckout();
                default:
                    return {
                        success: false,
                        message: "Try commands like 'search for vegetables', 'add 2 kg tomatoes', or 'checkout'."
                    };
            }
        } catch (error) {
            return {
                success: false,
                message: "Something went wrong. Please try again."
            };
        }
    }

    private parseCommand(text: string): VoiceCommand {
        const lowerText = text.toLowerCase().trim();
        let command: VoiceCommand = { action: 'unknown', confidence: 0 };

        // Determine action
        if (this.containsAny(lowerText, ['search', 'find', 'look for', 'show me'])) {
            command.action = 'search';
            command.confidence += 0.4;
        } else if (this.containsAny(lowerText, ['add', 'put', 'include'])) {
            command.action = 'add';
            command.confidence += 0.4;
        } else if (this.containsAny(lowerText, ['checkout', 'buy', 'purchase', 'order', 'proceed'])) {
            command.action = 'checkout';
            command.confidence = 0.8;
            return command;
        }

        // Find product
        const detectedProduct = this.detectProduct(lowerText);
        if (detectedProduct) {
            command.product = detectedProduct;
            command.confidence += 0.3;
        }

        // Find quantity and unit
        const { quantity, unit } = this.detectQuantityAndUnit(lowerText);
        if (quantity) {
            command.quantity = quantity;
            command.confidence += 0.2;
        }
        if (unit) {
            command.unit = unit;
            command.confidence += 0.1;
        }

        // Find district
        const detectedDistrict = this.detectDistrict(lowerText);
        if (detectedDistrict) {
            command.district = detectedDistrict;
            command.confidence += 0.1;
        }

        return command;
    }

    private async handleSearch(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in first." };
            }

            const params: any = { limit: 20 };
            if (command.product) params.search = command.product;
            if (command.district) params.district = command.district;

            const response = await api.get('/browse/products/search', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            const products = response.data.items || [];
            const availableProducts = products.filter((p: any) =>
                p.unit_prices.some((up: any) =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (availableProducts.length === 0) {
                return {
                    success: false,
                    message: `No ${command.product || 'products'} found${command.district ? ` in ${command.district}` : ''}.`
                };
            }

            return {
                success: true,
                message: `Found ${availableProducts.length} product${availableProducts.length > 1 ? 's' : ''}.`,
                data: { products: availableProducts, searchTerm: command.product }
            };

        } catch (error) {
            return { success: false, message: "Search failed. Please try again." };
        }
    }

    private async handleAddToCart(command: VoiceCommand, customerType: string): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in first." };
            }

            if (!command.product) {
                return { success: false, message: "Please specify a product to add." };
            }

            // Search for the product
            const searchResponse = await api.get('/browse/products/search', {
                params: { search: command.product, limit: 5 },
                headers: { Authorization: `Bearer ${token}` }
            });

            const products = searchResponse.data.items || [];
            const availableProduct = products.find((p: any) =>
                p.unit_prices.some((up: any) =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (!availableProduct) {
                return {
                    success: false,
                    message: `${command.product} is not available.`
                };
            }

            const bestMatch = this.findBestProductMatch(
                [availableProduct],
                command,
                customerType
            );

            if (!bestMatch) {
                return {
                    success: false,
                    message: `Found ${command.product} but couldn't match the requested unit.`
                };
            }

            const quantity = Math.max(command.quantity || 1, bestMatch.unitPrice.minimum_order);

            if (quantity > bestMatch.unitPrice.quantity_available) {
                return {
                    success: false,
                    message: `Only ${bestMatch.unitPrice.quantity_available} ${bestMatch.unitPrice.unit} available.`
                };
            }

            // Add to cart
            await api.post('/orders/cart/items', {
                farmer_product_id: availableProduct.id,
                unit_price_id: bestMatch.unitPrice.id,
                quantity: quantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cost = (quantity * bestMatch.unitPrice.price_per_unit).toFixed(2);

            return {
                success: true,
                message: `Added ${quantity} ${bestMatch.unitPrice.unit} of ${availableProduct.item} - Rs ${cost}`,
                data: { product: availableProduct.item, quantity, cost }
            };

        } catch (error) {
            return { success: false, message: "Failed to add item to cart." };
        }
    }

    private async handleCheckout(): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in first." };
            }

            const cartResponse = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cart = cartResponse.data;
            const itemCount = Number(cart.total_items) || 0;

            if (itemCount === 0) {
                return {
                    success: false,
                    message: "Your cart is empty. Add some items first."
                };
            }

            return {
                success: true,
                message: `Proceeding to checkout with ${itemCount} item${itemCount > 1 ? 's' : ''}.`,
                data: { action: 'navigate_to_checkout', cart }
            };

        } catch (error) {
            return { success: false, message: "Checkout failed. Please try again." };
        }
    }

    private containsAny(text: string, words: string[]): boolean {
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
        products: any[],
        command: VoiceCommand,
        customerType: string, // 'individual' | 'business'
    ) {
        for (const product of products) {
            const suitableUnitPrices = product.unit_prices.filter((up: any) =>
                up.customer_type === customerType && up.quantity_available > 0
            );

            if (command.unit) {
                const matchingUnitPrice = suitableUnitPrices.find((up: any) =>
                    up.unit.toLowerCase() === command.unit?.toLowerCase() ||
                    this.unitMappings.get(command.unit || '')?.includes(up.unit.toLowerCase())
                );

                if (matchingUnitPrice) {
                    return { product, unitPrice: matchingUnitPrice };
                }
            }

            if (suitableUnitPrices.length > 0) {
                const bestUnitPrice = suitableUnitPrices.sort((a: any, b: any) =>
                    a.price_per_unit - b.price_per_unit
                )[0];
                return { product, unitPrice: bestUnitPrice };
            }
        }

        return null;
    }

    async cleanup(): Promise<void> {
        try {
            if (this.isListening) {
                await Voice.stop();
            }
            Voice.removeAllListeners();
        } catch (error) {
            console.log('Cleanup error:', error);
        }
    }
}

export default new VoiceInputService();