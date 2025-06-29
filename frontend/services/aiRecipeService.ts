import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/apiService';
import { translations, getNestedTranslation } from '@/constants/translations';
import {
    MAURITIAN_RECIPES,
    INGREDIENT_CATEGORIES,
    CUISINE_AFFINITIES,
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

    private getCurrentLanguage(): 'en' | 'fr' {
        // In a real app, this would get the current language from AsyncStorage or context
        // For now, defaulting to 'en' - you may need to adjust this based on your app structure
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
                    const candidateRecipes = this.applyRecipeRules(cartItems, cartAnalysis);
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
        const recipeIngredientMap = new Map<string, { recipe: Recipe, ingredients: RecipeIngredient[] }>();

        recipes.forEach(recipe => {
            const missingIngredients: RecipeIngredient[] = [];

            recipe.ingredients.forEach(ingredient => {
                const ingredientName = ingredient.name.toLowerCase();
                const isInCart = cartItemNames.some(cartItem =>
                    cartItem.includes(ingredientName) || ingredientName.includes(cartItem)
                );

                if (!isInCart) {
                    missingIngredients.push(ingredient);
                    allMissingIngredients.add(ingredientName);
                }
            });

            recipeIngredientMap.set(recipe.id, { recipe, ingredients: missingIngredients });
        });

        const ingredientAvailabilityMap = await this.batchCheckIngredientsAvailability(
            Array.from(allMissingIngredients),
            customerType
        );

        const processedRecipes: Recipe[] = [];

        for (const [recipeId, { recipe, ingredients: missingIngredients }] of recipeIngredientMap) {
            const availableMissingIngredients = missingIngredients.filter(ingredient =>
                ingredientAvailabilityMap.has(ingredient.name.toLowerCase())
            );

            const estimatedCost = this.estimateCostFromAvailabilityMap(
                availableMissingIngredients,
                ingredientAvailabilityMap
            );

            processedRecipes.push({
                ...recipe,
                missing_ingredients: missingIngredients,
                available_missing_ingredients: availableMissingIngredients,
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

    clearCache() {
        this.productSearchCache.clear();
        this.lastCartHash = '';
        this.lastRecipesResult = [];
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

    private applyRecipeRules(cartItems: CartItem[], cartAnalysis: any): Recipe[] {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const matchingRecipes: Recipe[] = [];

        for (const rule of this.recipeRules) {
            const matchScore = this.calculateRuleMatchScore(rule, cartItemNames);

            if (matchScore > 0.1) {
                const recipe = this.createRecipeFromRule(rule, cartItems, matchScore);
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

        const ingredientOverlap = recipe.ingredients.filter(ingredient =>
            cartItemNames.some(cartItem =>
                cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
            )
        ).length;
        score += (ingredientOverlap / recipe.ingredients.length) * 0.4;

        if (customerType === 'business' && recipe.difficulty !== 'hard') {
            score += 0.2;
        } else if (customerType === 'individual' && recipe.difficulty === 'easy') {
            score += 0.2;
        }

        if (userPreferences?.preferredCuisine?.includes(recipe.cuisine_type)) {
            score += 0.2;
        }

        const missingCount = recipe.ingredients.filter(ing =>
            !cartItemNames.some(cartItem =>
                cartItem.includes(ing.name) || ing.name.includes(cartItem)
            )
        ).length;
        score += (1 - (missingCount / recipe.ingredients.length)) * 0.2;

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

    private createRecipeFromRule(rule: RecipeRule, cartItems: CartItem[], matchScore: number): Recipe {
        return {
            id: `rule_${rule.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            name: rule.name,
            description: rule.description,
            prep_time: rule.prep_time,
            difficulty: rule.difficulty,
            cuisine_type: rule.cuisine_type,
            ingredients: rule.ingredients,
            missing_ingredients: [],
            available_missing_ingredients: [],
            estimated_total_cost: 0,
            instructions: rule.instructions,
            nutritional_benefits: rule.nutritional_benefits,
            confidence_score: matchScore
        };
    }

    async addMissingIngredientsToCart(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<{success: boolean, addedItems: any[], errors: string[]}> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error(this.t('common.noAuthToken'));

            const addedItems: any[] = [];
            const errors: string[] = [];

            for (const ingredient of missingIngredients) {
                try {
                    const bestMatch = await this.findBestProductMatch(ingredient.name, customerType);

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
                            name: ingredient.name,
                            product: bestMatch.product_name,
                            farmer: bestMatch.farmer_name,
                            price: bestMatch.price_per_unit,
                            quantity: finalQuantity,
                            unit: bestMatch.unit
                        });
                    } else {
                        errors.push(this.t('common.couldNotFind', { item: ingredient.name }));
                    }
                } catch (itemError: any) {
                    errors.push(this.t('common.failedToAdd', {
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
                errors: [this.t('common.fatalErrorAdding', { error: error.message })]
            };
        }
    }
}

export default new RuleBasedAIService();