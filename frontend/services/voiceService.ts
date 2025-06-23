// services/voiceService.ts - Fixed with better error handling
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { Platform } from 'react-native';

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

    // Common product mappings for Mauritian context
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

    // Unit mappings
    private unitMappings = new Map([
        ['kilogram', ['kg', 'kilo', 'kilogram', 'kilograms']],
        ['gram', ['g', 'gram', 'grams', 'gramme', 'grammes']],
        ['piece', ['piece', 'pieces', 'unit', 'units', 'each']],
        ['bunch', ['bunch', 'bunches', 'bouquet']],
        ['dozen', ['dozen', 'douzaine']],
        ['basket', ['basket', 'baskets', 'panier']]
    ]);

    // Mauritian districts
    private districts = [
        'port louis', 'beau bassin-rose hill', 'vacoas-phoenix', 'curepipe', 'quatre bornes',
        'triolet', 'goodlands', 'centre de flacq', 'mahebourg', 'saint pierre', 'rose belle',
        'riviere du rempart', 'grand baie', 'pamplemousses', 'grand port', 'black river',
        'moka', 'plaines wilhems', 'riviere noire', 'savanne', 'flacq'
    ];

    constructor() {
        // Initialize but don't set up listeners immediately
    }

    private async initializeVoice() {
        if (this.isInitialized) return;

        try {
            // Check if voice is available on this platform
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
            throw new Error('Voice recognition not available on this device');
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

    /**
     * Start listening for voice input
     */
    async startListening(): Promise<void> {
        try {
            await this.initializeVoice();

            if (this.isListening) {
                await this.stopListening();
            }

            // Reset recognized text
            this.recognizedText = '';

            await Voice.start('en-US');
            this.isListening = true;
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            throw new Error('Failed to start voice recognition. Please check your microphone permissions.');
        }
    }

    /**
     * Stop listening and return recognized text
     */
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

    /**
     * Process voice command and execute action
     */
    async processVoiceCommand(
        recognizedText: string,
        customerType: 'individual' | 'business'
    ): Promise<VoiceResult> {
        try {
            console.log('🤖 Processing voice command:', recognizedText);

            if (!recognizedText || recognizedText.trim().length === 0) {
                return {
                    success: false,
                    message: "I didn't hear anything clearly. Please try speaking again.",
                    suggestions: [
                        "Make sure you're speaking clearly",
                        "Check your microphone permissions",
                        "Try again in a quieter environment"
                    ]
                };
            }

            const command = this.parseVoiceCommand(recognizedText);
            console.log('🧠 Parsed command:', command);

            if (command.confidence < 0.3) {
                return {
                    success: false,
                    message: "I didn't understand that command.",
                    suggestions: [
                        "Search for tomatoes",
                        "Add 2 kg of potatoes to cart",
                        "Find carrots from Curepipe",
                        "Checkout my items"
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
                        message: "I understood your speech but couldn't determine the action. Try being more specific.",
                        suggestions: [
                            "Search for [product name]",
                            "Add [quantity] [unit] of [product] to cart",
                            "Checkout my items"
                        ]
                    };
            }
        } catch (error) {
            console.error('Error processing voice command:', error);
            return {
                success: false,
                message: "Sorry, there was an error processing your command. Please try again."
            };
        }
    }

    /**
     * Parse voice command using NLP techniques
     */
    private parseVoiceCommand(text: string): VoiceCommand {
        const normalizedText = text.toLowerCase().trim();
        console.log('🔍 Parsing:', normalizedText);

        let command: VoiceCommand = {
            action: 'unknown',
            confidence: 0
        };

        // Action detection with higher confidence scoring
        if (this.containsWords(normalizedText, ['search', 'find', 'look for', 'show me'])) {
            command.action = 'search';
            command.confidence += 0.4;
        } else if (this.containsWords(normalizedText, ['add', 'put', 'include', 'cart'])) {
            command.action = 'add';
            command.confidence += 0.4;
        } else if (this.containsWords(normalizedText, ['checkout', 'check out', 'buy', 'purchase', 'order now'])) {
            command.action = 'checkout';
            command.confidence += 0.8; // High confidence for checkout
            return command; // Return early for checkout
        }

        // Product detection
        const detectedProduct = this.detectProduct(normalizedText);
        if (detectedProduct) {
            command.product = detectedProduct;
            command.confidence += 0.3;
        }

        // Quantity and unit detection
        const { quantity, unit } = this.detectQuantityAndUnit(normalizedText);
        if (quantity) {
            command.quantity = quantity;
            command.confidence += 0.2;
        }
        if (unit) {
            command.unit = unit;
            command.confidence += 0.1;
        }

        // District detection
        const detectedDistrict = this.detectDistrict(normalizedText);
        if (detectedDistrict) {
            command.district = detectedDistrict;
            command.confidence += 0.1;
        }

        console.log('📊 Final command confidence:', command.confidence);
        return command;
    }

    /**
     * Execute search command
     */
    private async executeSearch(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in to search for products." };
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

            // Filter products that have pricing for the customer type
            const filteredProducts = products.filter((product: any) =>
                product.unit_prices.some((up: any) =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (filteredProducts.length === 0) {
                let message = `No ${command.product || 'products'} found`;
                if (command.district) {
                    message += ` from farmers in ${command.district}`;
                }
                message += ` for ${customerType} customers.`;

                return {
                    success: false,
                    message,
                    suggestions: [
                        "Try searching without specifying a district",
                        "Search for a different product",
                        "Say 'search for vegetables' for broader results"
                    ]
                };
            }

            const productNames = filteredProducts.slice(0, 5).map((p: any) => p.item).join(', ');
            let message = `Found ${filteredProducts.length} result${filteredProducts.length > 1 ? 's' : ''}`;
            if (command.district) {
                message += ` from ${command.district}`;
            }
            message += `: ${productNames}${filteredProducts.length > 5 ? ' and more' : ''}`;

            return {
                success: true,
                message,
                data: { products: filteredProducts, searchTerm: command.product }
            };

        } catch (error) {
            console.error('Search error:', error);
            return {
                success: false,
                message: "Sorry, there was an error searching for products. Please try again."
            };
        }
    }

    /**
     * Execute add to cart command with intelligent matching
     */
    private async executeAddToCart(command: VoiceCommand, customerType: 'individual' | 'business'): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in to add items to cart." };
            }

            if (!command.product) {
                return {
                    success: false,
                    message: "Please specify which product you want to add. For example: 'Add 2 kg of tomatoes to cart'."
                };
            }

            // Search for the product
            const searchResponse = await api.get('/browse/products/search', {
                params: { search: command.product, limit: 10 },
                headers: { Authorization: `Bearer ${token}` }
            });

            const products: ProductMatch[] = searchResponse.data.items || [];

            // Filter and find best matches
            const suitableProducts = products.filter(product =>
                product.unit_prices.some(up =>
                    up.customer_type === customerType && up.quantity_available > 0
                )
            );

            if (suitableProducts.length === 0) {
                return {
                    success: false,
                    message: `Sorry, ${command.product} is not available from any farmers for ${customerType} customers right now.`,
                    suggestions: [
                        "Try searching for the product first to see availability",
                        "Search for similar products",
                        "Try again later as farmers update their inventory regularly"
                    ]
                };
            }

            // Intelligent product and unit price selection
            const bestMatch = this.findBestProductMatch(suitableProducts, command, customerType);
            if (!bestMatch) {
                return {
                    success: false,
                    message: `Found ${command.product} but couldn't match your requirements. Please try with different units or quantities.`
                };
            }

            // Determine final quantity
            const finalQuantity = this.calculateFinalQuantity(
                command.quantity || 1,
                bestMatch.unitPrice.minimum_order,
                customerType
            );

            // Check availability
            if (finalQuantity > bestMatch.unitPrice.quantity_available) {
                return {
                    success: false,
                    message: `Sorry, only ${bestMatch.unitPrice.quantity_available} ${bestMatch.unitPrice.unit} of ${bestMatch.product.item} available from ${bestMatch.product.farmer_name}.`,
                    suggestions: [
                        "Try a smaller quantity",
                        "Search for the same product from other farmers"
                    ]
                };
            }

            // Add to cart
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
                message: `Added ${finalQuantity} ${bestMatch.unitPrice.unit} of ${bestMatch.product.item} from ${bestMatch.product.farmer_name} to your cart for Rs ${totalCost}.`,
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
                    message: error.response.data.detail || "Unable to add item to cart. Please check the quantity and try again."
                };
            }

            return {
                success: false,
                message: "Sorry, there was an error adding the item to your cart. Please try again."
            };
        }
    }

    /**
     * Execute checkout command
     */
    private async executeCheckout(): Promise<VoiceResult> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                return { success: false, message: "Please log in to checkout." };
            }

            // Get current cart
            const cartResponse = await api.get('/orders/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const cart = cartResponse.data;

            if (!cart.farmer_groups || cart.farmer_groups.length === 0) {
                return {
                    success: false,
                    message: "Your cart is empty. Add some items before checkout.",
                    suggestions: [
                        "Say 'Add tomatoes to cart' to add items",
                        "Say 'Search for vegetables' to browse products"
                    ]
                };
            }

            const itemCount = Number(cart.total_items) || 0;
            const totalAmount = Number(cart.total_amount) || 0;
            const farmerCount = cart.farmer_groups ? cart.farmer_groups.length : 0;

            return {
                success: true,
                message: `Proceeding to checkout with ${itemCount} items from ${farmerCount} farmer${farmerCount > 1 ? 's' : ''} for Rs ${totalAmount.toFixed(2)}.`,
                data: {
                    action: 'navigate_to_checkout',
                    cart: cart
                }
            };

        } catch (error) {
            console.error('Checkout error:', error);
            return {
                success: false,
                message: "Sorry, there was an error accessing your cart for checkout."
            };
        }
    }

    // Helper methods
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
        // Enhanced quantity detection with support for decimals and fractions
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

        // Unit detection
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

            // If specific unit requested, try to match it
            if (command.unit) {
                const matchingUnitPrice = suitableUnitPrices.find(up =>
                    up.unit.toLowerCase() === command.unit?.toLowerCase() ||
                    this.unitMappings.get(command.unit || '')?.includes(up.unit.toLowerCase())
                );

                if (matchingUnitPrice) {
                    return { product, unitPrice: matchingUnitPrice };
                }
            }

            // Otherwise, pick best available unit price (lowest price)
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

    /**
     * Check if microphone permission is available
     */
    async checkPermissions(): Promise<boolean> {
        try {
            if (Platform.OS === 'web') {
                return false;
            }

            await this.initializeVoice();
            const available = await Voice.isAvailable();
            // Voice.isAvailable() returns 1 for true, 0 for false
            return available === 1;
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    /**
     * Clean up voice recognition resources
     */
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

    /**
     * Get current listening state
     */
    getIsListening(): boolean {
        return this.isListening;
    }
}

export default new VoiceInputService();