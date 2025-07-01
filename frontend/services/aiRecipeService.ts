import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/apiService';
import { translations, getNestedTranslation } from '@/constants/translations';
import {
    MAURITIAN_RECIPES,
    INGREDIENT_CATEGORIES,
    CUISINE_AFFINITIES,
    DIFFICULTY_TRANSLATIONS,
    RecipeRule,
    RecipeIngredient
} from '@/constants/recipes';

interface CartItem {
    product_name: string;
    quantity: number;
    unit_name: string;
}

interface Recipe {
    id: string;
    name: string;
    description: string;
    prep_time: string;
    difficulty: 'easy' | 'medium' | 'hard';
    difficulty_translated: string;
    cuisine_type: 'mauritian' | 'creole' | 'indian' | 'chinese';
    ingredients: RecipeIngredient[];
    missing_ingredients: RecipeIngredient[];
    available_missing_ingredients: RecipeIngredient[];
    estimated_total_cost: number;
    instructions: string[];
    nutritional_benefits: string[];
    confidence_score: number;
}

interface CachedProductSearch {
    products: any[];
    timestamp: number;
    customerType: string;
}

class RuleBasedAIService {
    private recipeRules: RecipeRule[] = [];
    private ingredientCategories: Map<string, string[]> = new Map();
    private cuisineAffinities: Map<string, string[]> = new Map();

    private productSearchCache: Map<string, CachedProductSearch> = new Map();
    private lastCartHash: string = '';
    private lastRecipesResult: Recipe[] = [];
    private readonly CACHE_DURATION = 5 * 60 * 1000;
    private readonly CART_DEBOUNCE_TIME = 2000;
    private cartUpdateTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.initializeKnowledgeBase();
    }

    async getCurrentLanguage(): Promise<'en' | 'fr'> {
        try {
            const storedLanguage = await AsyncStorage.getItem('user_language_preference');
            return (storedLanguage === 'fr') ? 'fr' : 'en';
        } catch (error) {
            return 'en';
        }
    }

    private async t(key: string, params?: Record<string, string | number>): Promise<string> {
        const language = await this.getCurrentLanguage();
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

    // Helper function to translate product names
    private async translateProduct(productName: string): Promise<string> {
        const translated = await this.t(`products.${productName}`);
        // Fallback to formatted name if translation not found
        return translated !== `products.${productName}` ? translated : productName.replace(/_/g, ' ');
    }

    // Helper function to translate units
    private async translateUnit(unit: string, quantity: number = 1): Promise<string> {
        if (quantity === 1) {
            const translated = await this.t(`units.${unit}`);
            return translated !== `units.${unit}` ? translated : unit;
        } else {
            // Handle plural forms
            const pluralUnit = this.getPluralUnit(unit, quantity);
            const translated = await this.t(`units.${pluralUnit}`);
            return translated !== `units.${pluralUnit}` ? translated : pluralUnit;
        }
    }

    private getPluralUnit(unit: string, quantity: number): string {
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
    }

    // Translate recipe ingredients
    private async translateIngredients(ingredients: RecipeIngredient[]): Promise<RecipeIngredient[]> {
        const translatedIngredients: RecipeIngredient[] = [];

        for (const ingredient of ingredients) {
            const translatedName = await this.translateProduct(ingredient.name);
            const translatedUnit = await this.translateUnit(ingredient.unit, parseFloat(ingredient.quantity));

            translatedIngredients.push({
                ...ingredient,
                name: translatedName,
                unit: translatedUnit
            });
        }

        return translatedIngredients;
    }

    private initializeKnowledgeBase() {
        this.recipeRules = MAURITIAN_RECIPES;
        this.ingredientCategories = INGREDIENT_CATEGORIES;
        this.cuisineAffinities = CUISINE_AFFINITIES;
    }

    async generatePersonalizedRecipes(
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: {
            preferredCuisine?: string[];
            dietaryRestrictions?: string[];
            skillLevel?: 'beginner' | 'intermediate' | 'advanced';
        }
    ): Promise<Recipe[]> {
        const cartHash = this.createCartHash(cartItems, customerType);

        if (cartHash === this.lastCartHash && this.lastRecipesResult.length > 0) {
            return this.lastRecipesResult;
        }

        if (this.cartUpdateTimer) {
            clearTimeout(this.cartUpdateTimer);
        }

        return new Promise((resolve) => {
            this.cartUpdateTimer = setTimeout(async () => {
                try {
                    const cartAnalysis = this.analyzeCartContents(cartItems);
                    const candidateRecipes = await this.applyRecipeRules(cartItems, cartAnalysis);
                    const scoredRecipes = this.scoreAndRankRecipes(candidateRecipes, cartItems, customerType, userPreferences);
                    const topRecipes = scoredRecipes.slice(0, 3);

                    const processedRecipes = await this.batchProcessMissingIngredients(topRecipes, cartItems, customerType);

                    this.lastCartHash = cartHash;
                    this.lastRecipesResult = processedRecipes;

                    resolve(processedRecipes);
                } catch (error) {
                    console.error('🤖 AI: Error generating recipes:', error);
                    resolve(this.lastRecipesResult || []);
                }
            }, this.CART_DEBOUNCE_TIME);
        });
    }

    private createCartHash(cartItems: CartItem[], customerType: string): string {
        const cartString = cartItems
            .map(item => `${item.product_name}:${item.quantity}:${item.unit_name}`)
            .sort()
            .join('|') + `|${customerType}`;

        let hash = 0;
        for (let i = 0; i < cartString.length; i++) {
            const char = cartString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    private async batchProcessMissingIngredients(
        recipes: Recipe[],
        cartItems: CartItem[],
        customerType: 'individual' | 'business'
    ): Promise<Recipe[]> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        const allMissingIngredients = new Set<string>();
        const recipeIngredientMap = new Map<string, { recipe: Recipe, ingredients: RecipeIngredient[], originalIngredients: RecipeIngredient[] }>();

        for (const recipe of recipes) {
            const missingIngredients: RecipeIngredient[] = [];
            const originalMissingIngredients: RecipeIngredient[] = [];

            // Find the original recipe rule to get English ingredient names
            const originalRule = this.recipeRules.find(rule =>
                recipe.id.includes(rule.translations.en.name.toLowerCase().replace(/\s+/g, '_')) ||
                recipe.id.includes(rule.translations.fr.name.toLowerCase().replace(/\s+/g, '_'))
            );

            if (originalRule) {
                for (let i = 0; i < originalRule.ingredients.length; i++) {
                    const originalIngredient = originalRule.ingredients[i];
                    const translatedIngredient = recipe.ingredients[i];
                    const ingredientName = originalIngredient.name.toLowerCase(); // Use original English name

                    const isInCart = cartItemNames.some(cartItem =>
                        cartItem.includes(ingredientName) || ingredientName.includes(cartItem)
                    );

                    if (!isInCart) {
                        originalMissingIngredients.push(originalIngredient); // Store original for API calls
                        missingIngredients.push(translatedIngredient); // Store translated for display
                        allMissingIngredients.add(ingredientName); // Use English name for API
                    }
                }
            }

            recipeIngredientMap.set(recipe.id, {
                recipe,
                ingredients: missingIngredients,
                originalIngredients: originalMissingIngredients
            });
        }

        const ingredientAvailabilityMap = await this.batchCheckIngredientsAvailability(
            Array.from(allMissingIngredients), // English names for API
            customerType
        );

        const processedRecipes: Recipe[] = [];

        for (const [recipeId, { recipe, ingredients: missingIngredients, originalIngredients }] of recipeIngredientMap) {
            const availableMissingIngredients = missingIngredients.filter((ingredient, index) =>
                ingredientAvailabilityMap.has(originalIngredients[index].name.toLowerCase()) // Check using English names
            );

            const estimatedCost = this.estimateCostFromAvailabilityMap(
                originalIngredients, // Use original ingredients for cost calculation
                ingredientAvailabilityMap
            );

            processedRecipes.push({
                ...recipe,
                missing_ingredients: missingIngredients, // Translated for display
                available_missing_ingredients: availableMissingIngredients, // Translated for display
                estimated_total_cost: estimatedCost
            });
        }

        return processedRecipes;
    }

    private async batchCheckIngredientsAvailability(
        ingredientNames: string[],
        customerType: 'individual' | 'business'
    ): Promise<Map<string, { products: any[], lowestPrice: number }>> {
        const availabilityMap = new Map<string, { products: any[], lowestPrice: number }>();
        const uncachedIngredients: string[] = [];

        ingredientNames.forEach(ingredientName => {
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                const suitableProducts = cached.products.filter(product =>
                    product.unit_prices.some((up: any) =>
                        up.customer_type === customerType && up.quantity_available > 0
                    )
                );

                if (suitableProducts.length > 0) {
                    const lowestPrice = this.findLowestPrice(suitableProducts, customerType);
                    availabilityMap.set(ingredientName, { products: suitableProducts, lowestPrice });
                }
            } else {
                uncachedIngredients.push(ingredientName);
            }
        });

        if (uncachedIngredients.length > 0) {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return availabilityMap;

                const searchPromises = uncachedIngredients.map(async (ingredientName) => {
                    try {
                        const searchResponse = await api.get(`/browse/products/search`, {
                            params: { search: ingredientName, limit: 10 },
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        const products = searchResponse.data.items || [];

                        const cacheKey = `${ingredientName}:${customerType}`;
                        this.productSearchCache.set(cacheKey, {
                            products,
                            timestamp: Date.now(),
                            customerType
                        });

                        const suitableProducts = products.filter((product: any) =>
                            product.unit_prices.some((up: any) =>
                                up.customer_type === customerType && up.quantity_available > 0
                            )
                        );

                        if (suitableProducts.length > 0) {
                            const lowestPrice = this.findLowestPrice(suitableProducts, customerType);
                            return { ingredientName, products: suitableProducts, lowestPrice };
                        }

                        return null;
                    } catch (error) {
                        console.error(`❌ Error searching for ${ingredientName}:`, error);
                        return null;
                    }
                });

                const results = await Promise.all(searchPromises);

                results.forEach(result => {
                    if (result) {
                        availabilityMap.set(result.ingredientName, {
                            products: result.products,
                            lowestPrice: result.lowestPrice
                        });
                    }
                });

            } catch (error) {
                console.error('❌ Error in batch ingredient search:', error);
            }
        }
        return availabilityMap;
    }

    private findLowestPrice(products: any[], customerType: string): number {
        let lowestPrice = Infinity;

        products.forEach((product: any) => {
            product.unit_prices.forEach((up: any) => {
                if (up.customer_type === customerType && up.quantity_available > 0) {
                    lowestPrice = Math.min(lowestPrice, up.price_per_unit);
                }
            });
        });

        return lowestPrice === Infinity ? 0 : lowestPrice;
    }

    private estimateCostFromAvailabilityMap(
        ingredients: RecipeIngredient[],
        availabilityMap: Map<string, { products: any[], lowestPrice: number }>
    ): number {
        let totalCost = 0;

        ingredients.forEach(ingredient => {
            const availability = availabilityMap.get(ingredient.name.toLowerCase());
            if (availability) {
                totalCost += availability.lowestPrice;
            }
        });

        return totalCost;
    }

    async findBestProductMatch(ingredientName: string, customerType: 'individual' | 'business'): Promise<any> {
        try {
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);
            let products: any[] = [];

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                products = cached.products;
            } else {
                const token = await AsyncStorage.getItem('token');
                const searchResponse = await api.get(`/browse/products/search`, {
                    params: { search: ingredientName, limit: 20 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                products = searchResponse.data.items || [];

                this.productSearchCache.set(cacheKey, {
                    products,
                    timestamp: Date.now(),
                    customerType
                });
            }

            let bestMatch = null;
            let lowestPrice = Infinity;

            for (const product of products) {
                const suitablePrices = product.unit_prices.filter(
                    (up: any) => up.customer_type === customerType && up.quantity_available > 0
                );

                for (const unitPrice of suitablePrices) {
                    if (unitPrice.price_per_unit < lowestPrice) {
                        lowestPrice = unitPrice.price_per_unit;
                        bestMatch = {
                            farmer_product_id: product.id,
                            unit_price_id: unitPrice.id,
                            product_name: product.item,
                            farmer_name: product.farmer_name,
                            price_per_unit: unitPrice.price_per_unit,
                            minimum_order: unitPrice.minimum_order,
                            unit: unitPrice.unit
                        };
                    }
                }
            }

            return bestMatch;
        } catch (error) {
            console.error(`❌ Error finding product match for ${ingredientName}:`, error);
            return null;
        }
    }

    private analyzeCartContents(cartItems: CartItem[]) {
        const analysis = {
            vegetableCount: 0,
            fruitCount: 0,
            categories: new Set<string>(),
            dominantCategory: '',
            complexity: 'simple',
            cuisineHints: new Set<string>()
        };

        for (const item of cartItems) {
            const itemName = item.product_name.toLowerCase();

            if (this.isVegetable(itemName)) {
                analysis.vegetableCount++;
                analysis.categories.add('vegetables');
            } else if (this.isFruit(itemName)) {
                analysis.fruitCount++;
                analysis.categories.add('fruits');
            }

            this.getCuisineHints(itemName).forEach(hint =>
                analysis.cuisineHints.add(hint)
            );
        }

        analysis.dominantCategory = analysis.vegetableCount > analysis.fruitCount ? 'vegetables' : 'fruits';
        analysis.complexity = cartItems.length > 4 ? 'complex' : 'simple';

        return analysis;
    }

    private async applyRecipeRules(cartItems: CartItem[], cartAnalysis: any): Promise<Recipe[]> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const matchingRecipes: Recipe[] = [];

        for (const rule of this.recipeRules) {
            // Use original English ingredient names for matching logic
            const matchScore = this.calculateRuleMatchScore(rule, cartItemNames);

            if (matchScore > 0.1) {
                const recipe = await this.createRecipeFromRule(rule, cartItems, matchScore);
                matchingRecipes.push(recipe);
            }
        }

        return matchingRecipes;
    }

    private scoreAndRankRecipes(
        recipes: Recipe[],
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): Recipe[] {
        return recipes
            .map(recipe => ({
                ...recipe,
                confidence_score: this.calculateConfidenceScore(recipe, cartItems, customerType, userPreferences)
            }))
            .sort((a, b) => b.confidence_score - a.confidence_score);
    }

    private calculateConfidenceScore(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): number {
        let score = 0;
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        // Find the original recipe rule to use English ingredient names for matching
        const originalRule = this.recipeRules.find(rule =>
            recipe.id.includes(rule.translations.en.name.toLowerCase().replace(/\s+/g, '_')) ||
            recipe.id.includes(rule.translations.fr.name.toLowerCase().replace(/\s+/g, '_'))
        );

        if (originalRule) {
            const ingredientOverlap = originalRule.ingredients.filter(ingredient =>
                cartItemNames.some(cartItem =>
                    cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
                )
            ).length;
            score += (ingredientOverlap / originalRule.ingredients.length) * 0.4;

            const missingCount = originalRule.ingredients.filter(ing =>
                !cartItemNames.some(cartItem =>
                    cartItem.includes(ing.name) || ing.name.includes(cartItem)
                )
            ).length;
            score += (1 - (missingCount / originalRule.ingredients.length)) * 0.2;
        } else {
            // Fallback to using translated ingredients if original rule not found
            const ingredientOverlap = recipe.ingredients.filter(ingredient =>
                cartItemNames.some(cartItem =>
                    cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
                )
            ).length;
            score += (ingredientOverlap / recipe.ingredients.length) * 0.4;

            const missingCount = recipe.ingredients.filter(ing =>
                !cartItemNames.some(cartItem =>
                    cartItem.includes(ing.name) || ing.name.includes(cartItem)
                )
            ).length;
            score += (1 - (missingCount / recipe.ingredients.length)) * 0.2;
        }

        if (customerType === 'business' && recipe.difficulty !== 'hard') {
            score += 0.2;
        } else if (customerType === 'individual' && recipe.difficulty === 'easy') {
            score += 0.2;
        }

        if (userPreferences?.preferredCuisine?.includes(recipe.cuisine_type)) {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    private calculateRuleMatchScore(rule: RecipeRule, cartItemNames: string[]): number {
        const triggerMatches = rule.triggerIngredients.filter((trigger: string) =>
            cartItemNames.some(cartItem => {
                const cartItemLower = cartItem.toLowerCase();
                const triggerLower = trigger.toLowerCase();

                return cartItemLower === triggerLower ||
                    cartItemLower.includes(triggerLower) ||
                    triggerLower.includes(cartItemLower);
            })
        );

        const score = triggerMatches.length > 0 ? triggerMatches.length / rule.triggerIngredients.length : 0;
        return score > 0 ? Math.max(score, 0.5) : 0;
    }

    private isVegetable(itemName: string): boolean {
        const vegetables = this.ingredientCategories.get('vegetables') || [];
        return vegetables.some(veg => itemName.includes(veg) || veg.includes(itemName));
    }

    private isFruit(itemName: string): boolean {
        const fruits = this.ingredientCategories.get('fruits') || [];
        return fruits.some(fruit => itemName.includes(fruit) || fruit.includes(itemName));
    }

    private getCuisineHints(itemName: string): string[] {
        const hints: string[] = [];
        for (const [cuisine, ingredients] of this.cuisineAffinities) {
            if (ingredients.some(ing => itemName.includes(ing) || ing.includes(itemName))) {
                hints.push(cuisine);
            }
        }
        return hints;
    }

    private async createRecipeFromRule(rule: RecipeRule, cartItems: CartItem[], matchScore: number): Promise<Recipe> {
        const language = await this.getCurrentLanguage();
        const translation = rule.translations[language];

        // Translate ingredients
        const translatedIngredients = await this.translateIngredients(rule.ingredients);

        // Get translated difficulty
        const translatedDifficulty = DIFFICULTY_TRANSLATIONS[language][rule.difficulty];

        return {
            id: `rule_${translation.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            name: translation.name,
            description: translation.description,
            prep_time: rule.prep_time,
            difficulty: rule.difficulty, // Keep original for logic
            difficulty_translated: translatedDifficulty, // For display
            cuisine_type: rule.cuisine_type,
            ingredients: translatedIngredients,
            missing_ingredients: [],
            available_missing_ingredients: [],
            estimated_total_cost: 0,
            instructions: translation.instructions,
            nutritional_benefits: translation.nutritional_benefits,
            confidence_score: matchScore
        };
    }

    // Helper method to find original English ingredient name from translated name
    private async findOriginalIngredientName(translatedName: string): Promise<string> {
        const language = await this.getCurrentLanguage();

        if (language === 'en') {
            return translatedName; // Already in English
        }

        // Search through recipe rules to find the English equivalent
        for (const rule of this.recipeRules) {
            const translatedIngredients = await this.translateIngredients(rule.ingredients);
            const matchingIngredient = translatedIngredients.find(ing =>
                ing.name.toLowerCase() === translatedName.toLowerCase()
            );
            if (matchingIngredient) {
                const originalIndex = translatedIngredients.indexOf(matchingIngredient);
                return rule.ingredients[originalIndex].name;
            }
        }

        return translatedName; // Fallback to translated name if not found
    }

    async addMissingIngredientsToCart(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<{success: boolean, addedItems: any[], errors: string[]}> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error(await this.t('common.noAuthToken'));

            const addedItems: any[] = [];
            const errors: string[] = [];

            for (const ingredient of missingIngredients) {
                try {
                    // Get the original English ingredient name for API call
                    const englishIngredientName = await this.findOriginalIngredientName(ingredient.name);

                    const bestMatch = await this.findBestProductMatch(englishIngredientName, customerType);

                    if (bestMatch) {
                        const finalQuantity = Math.max(1, bestMatch.minimum_order);

                        await api.post('/orders/cart/items', {
                            farmer_product_id: bestMatch.farmer_product_id,
                            unit_price_id: bestMatch.unit_price_id,
                            quantity: finalQuantity
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        addedItems.push({
                            name: ingredient.name, // Keep translated name for display
                            product: bestMatch.product_name,
                            farmer: bestMatch.farmer_name,
                            price: bestMatch.price_per_unit,
                            quantity: finalQuantity,
                            unit: bestMatch.unit
                        });
                    } else {
                        errors.push(await this.t('common.couldNotFind', { item: ingredient.name }));
                    }
                } catch (itemError: any) {
                    errors.push(await this.t('common.failedToAdd', {
                        item: ingredient.name,
                        error: itemError.response?.data?.detail || itemError.message
                    }));
                }
            }

            return { success: addedItems.length > 0, addedItems, errors };
        } catch (error: any) {
            console.error('❌ Fatal error adding ingredients to cart:', error);
            return {
                success: false,
                addedItems: [],
                errors: [await this.t('common.fatalErrorAdding', { error: error.message })]
            };
        }
    }
}

export default new RuleBasedAIService();