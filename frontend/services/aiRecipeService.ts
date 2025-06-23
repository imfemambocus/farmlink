// services/ruleBasedAIService.ts - Optimized with caching and reduced API calls
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
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

    // CACHING: Reduce redundant API calls
    private productSearchCache: Map<string, CachedProductSearch> = new Map();
    private lastCartHash: string = '';
    private lastRecipesResult: Recipe[] = [];
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly CART_DEBOUNCE_TIME = 2000; // 2 seconds
    private cartUpdateTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.initializeKnowledgeBase();
    }

    private initializeKnowledgeBase() {
        this.recipeRules = MAURITIAN_RECIPES;
        this.ingredientCategories = INGREDIENT_CATEGORIES;
        this.cuisineAffinities = CUISINE_AFFINITIES;
    }

    /**
     * OPTIMIZED: Generate recipes with caching and debouncing
     */
    async generatePersonalizedRecipes(
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: {
            preferredCuisine?: string[];
            dietaryRestrictions?: string[];
            skillLevel?: 'beginner' | 'intermediate' | 'advanced';
        }
    ): Promise<Recipe[]> {
        console.log('🤖 AI: Starting optimized recipe generation...');

        // OPTIMIZATION 1: Create cart hash to detect changes
        const cartHash = this.createCartHash(cartItems, customerType);

        // OPTIMIZATION 2: Return cached result if cart hasn't changed
        if (cartHash === this.lastCartHash && this.lastRecipesResult.length > 0) {
            console.log('🎯 AI: Returning cached recipes (cart unchanged)');
            return this.lastRecipesResult;
        }

        // OPTIMIZATION 3: Debounce rapid cart changes
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

                    // OPTIMIZATION 4: Batch process missing ingredients
                    const processedRecipes = await this.batchProcessMissingIngredients(topRecipes, cartItems, customerType);

                    // Cache results
                    this.lastCartHash = cartHash;
                    this.lastRecipesResult = processedRecipes;

                    console.log('🤖 AI: Generated', processedRecipes.length, 'optimized recipes');
                    resolve(processedRecipes);
                } catch (error) {
                    console.error('🤖 AI: Error generating recipes:', error);
                    resolve(this.lastRecipesResult || []);
                }
            }, this.CART_DEBOUNCE_TIME);
        });
    }

    /**
     * OPTIMIZATION: Create hash of cart contents to detect changes
     */
    private createCartHash(cartItems: CartItem[], customerType: string): string {
        const cartString = cartItems
            .map(item => `${item.product_name}:${item.quantity}:${item.unit_name}`)
            .sort()
            .join('|') + `|${customerType}`;

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < cartString.length; i++) {
            const char = cartString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * OPTIMIZATION: Batch process missing ingredients to reduce API calls
     */
    private async batchProcessMissingIngredients(
        recipes: Recipe[],
        cartItems: CartItem[],
        customerType: 'individual' | 'business'
    ): Promise<Recipe[]> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        // STEP 1: Collect ALL unique missing ingredients across all recipes
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

        // STEP 2: Batch search for all missing ingredients (ONE API call per unique ingredient)
        const ingredientAvailabilityMap = await this.batchCheckIngredientsAvailability(
            Array.from(allMissingIngredients),
            customerType
        );

        // STEP 3: Process each recipe using the batched results
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

    /**
     * OPTIMIZATION: Batch check ingredient availability with caching
     */
    private async batchCheckIngredientsAvailability(
        ingredientNames: string[],
        customerType: 'individual' | 'business'
    ): Promise<Map<string, { products: any[], lowestPrice: number }>> {
        const availabilityMap = new Map<string, { products: any[], lowestPrice: number }>();
        const uncachedIngredients: string[] = [];

        // STEP 1: Check cache first
        ingredientNames.forEach(ingredientName => {
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                // Use cached data
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

        // STEP 2: Batch search for uncached ingredients
        if (uncachedIngredients.length > 0) {
            console.log(`🔍 Batch searching for ${uncachedIngredients.length} ingredients`);

            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return availabilityMap;

                // OPTIMIZATION: Search for multiple ingredients in fewer API calls
                const searchPromises = uncachedIngredients.map(async (ingredientName) => {
                    try {
                        const searchResponse = await api.get(`/browse/products/search`, {
                            params: { search: ingredientName, limit: 10 },
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        const products = searchResponse.data.items || [];

                        // Cache the result
                        const cacheKey = `${ingredientName}:${customerType}`;
                        this.productSearchCache.set(cacheKey, {
                            products,
                            timestamp: Date.now(),
                            customerType
                        });

                        // Check if available for this customer type
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

                // Wait for all searches to complete
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

        console.log(`📋 Found ${availabilityMap.size} available ingredients out of ${ingredientNames.length}`);
        return availabilityMap;
    }

    /**
     * OPTIMIZATION: Find lowest price from cached data
     */
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

    /**
     * OPTIMIZATION: Estimate cost from availability map (no additional API calls)
     */
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

    /**
     * OPTIMIZATION: Improved product matching with caching
     */
    async findBestProductMatch(ingredientName: string, customerType: 'individual' | 'business'): Promise<any> {
        try {
            console.log(`🔍 Finding best match for: ${ingredientName} (${customerType})`);

            // Check cache first
            const cacheKey = `${ingredientName}:${customerType}`;
            const cached = this.productSearchCache.get(cacheKey);
            let products: any[] = [];

            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                console.log(`📋 Using cached data for ${ingredientName}`);
                products = cached.products;
            } else {
                // Fetch from API
                const token = await AsyncStorage.getItem('token');
                const searchResponse = await api.get(`/browse/products/search`, {
                    params: { search: ingredientName, limit: 20 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                products = searchResponse.data.items || [];

                // Cache the result
                this.productSearchCache.set(cacheKey, {
                    products,
                    timestamp: Date.now(),
                    customerType
                });
            }

            console.log(`📦 Found ${products.length} products for ${ingredientName}`);

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

            if (bestMatch) {
                console.log(`🎯 Best match for ${ingredientName}:`, bestMatch.product_name);
            }

            return bestMatch;
        } catch (error) {
            console.error(`❌ Error finding product match for ${ingredientName}:`, error);
            return null;
        }
    }

    /**
     * OPTIMIZATION: Clear cache when needed
     */
    clearCache() {
        this.productSearchCache.clear();
        this.lastCartHash = '';
        this.lastRecipesResult = [];
        console.log('🧹 AI: Cache cleared');
    }

    // Keep all the other existing methods unchanged...
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
            console.log(`🛒 Adding ${missingIngredients.length} missing ingredients to cart for ${customerType}`);

            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('No authentication token');

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
                        errors.push(`Could not find ${ingredient.name} from any farmer`);
                    }
                } catch (itemError: any) {
                    errors.push(`Failed to add ${ingredient.name}: ${itemError.response?.data?.detail || itemError.message}`);
                }
            }

            return { success: addedItems.length > 0, addedItems, errors };
        } catch (error: any) {
            console.error('❌ Fatal error adding ingredients to cart:', error);
            return { success: false, addedItems: [], errors: ['Failed to add ingredients to cart: ' + error.message] };
        }
    }
}

export default new RuleBasedAIService();