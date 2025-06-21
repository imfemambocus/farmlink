// services/ruleBasedAIService.ts - Updated to use external recipe database
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

class RuleBasedAIService {
    private recipeRules: RecipeRule[] = [];
    private ingredientCategories: Map<string, string[]> = new Map();
    private cuisineAffinities: Map<string, string[]> = new Map();

    constructor() {
        this.initializeKnowledgeBase();
    }

    /**
     * Initialize knowledge base from external recipe database
     */
    private initializeKnowledgeBase() {
        // Load recipes from external file
        this.recipeRules = MAURITIAN_RECIPES;
        this.ingredientCategories = INGREDIENT_CATEGORIES;
        this.cuisineAffinities = CUISINE_AFFINITIES;

        console.log(`🍽️ Loaded ${this.recipeRules.length} Mauritian recipes into knowledge base`);
    }

    /**
     * MAIN AI FUNCTION: Generate personalized recipe suggestions
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
        console.log('🤖 AI: Starting rule-based recipe generation...');

        const cartAnalysis = this.analyzeCartContents(cartItems);
        const candidateRecipes = this.applyRecipeRules(cartItems, cartAnalysis);
        const scoredRecipes = this.scoreAndRankRecipes(candidateRecipes, cartItems, customerType, userPreferences);
        const topRecipes = scoredRecipes.slice(0, 3);
        const processedRecipes = await Promise.all(
            topRecipes.map(recipe => this.processRecipeForMissingIngredients(recipe, cartItems, customerType))
        );

        console.log('🤖 AI: Generated', processedRecipes.length, 'personalized recipes');
        return processedRecipes;
    }

    /**
     * Analyze cart contents using classification algorithms
     */
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

    /**
     * Apply recipe matching rules
     */
    private applyRecipeRules(cartItems: CartItem[], cartAnalysis: any): Recipe[] {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const matchingRecipes: Recipe[] = [];

        console.log('🔍 Cart items:', cartItemNames);

        for (const rule of this.recipeRules) {
            const matchScore = this.calculateRuleMatchScore(rule, cartItemNames);

            console.log(`🔍 Recipe: ${rule.name}, Match score: ${matchScore}`);

            if (matchScore > 0.1) {
                const recipe = this.createRecipeFromRule(rule, cartItems, matchScore);
                matchingRecipes.push(recipe);
                console.log(`✅ Added recipe: ${rule.name}`);
            }
        }

        console.log(`📝 Total matching recipes: ${matchingRecipes.length}`);
        return matchingRecipes;
    }

    /**
     * Score and rank recipes using ML-inspired algorithms
     */
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

    /**
     * Calculate ML-style confidence score (0-1)
     */
    private calculateConfidenceScore(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business',
        userPreferences?: any
    ): number {
        let score = 0;
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());

        // Ingredient overlap score (0.4 weight)
        const ingredientOverlap = recipe.ingredients.filter(ingredient =>
            cartItemNames.some(cartItem =>
                cartItem.includes(ingredient.name) || ingredient.name.includes(cartItem)
            )
        ).length;
        score += (ingredientOverlap / recipe.ingredients.length) * 0.4;

        // Customer type relevance (0.2 weight)
        if (customerType === 'business' && recipe.difficulty !== 'hard') {
            score += 0.2;
        } else if (customerType === 'individual' && recipe.difficulty === 'easy') {
            score += 0.2;
        }

        // Cuisine preference (0.2 weight)
        if (userPreferences?.preferredCuisine?.includes(recipe.cuisine_type)) {
            score += 0.2;
        }

        // Completeness bonus (0.2 weight)
        const missingCount = recipe.ingredients.filter(ing =>
            !cartItemNames.some(cartItem =>
                cartItem.includes(ing.name) || ing.name.includes(cartItem)
            )
        ).length;
        score += (1 - (missingCount / recipe.ingredients.length)) * 0.2;

        return Math.min(score, 1.0);
    }

    /**
     * Calculate rule match score using set similarity
     */
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

    /**
     * Helper methods for ingredient classification
     */
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

    /**
     * Create recipe from rule
     */
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

    /**
     * Process recipe to find missing ingredients and check their availability
     */
    private async processRecipeForMissingIngredients(
        recipe: Recipe,
        cartItems: CartItem[],
        customerType: 'individual' | 'business'
    ): Promise<Recipe> {
        const cartItemNames = cartItems.map(item => item.product_name.toLowerCase());
        const missingIngredients: RecipeIngredient[] = [];

        // Find ALL missing ingredients
        for (const ingredient of recipe.ingredients) {
            const ingredientName = ingredient.name.toLowerCase();
            const isInCart = cartItemNames.some(cartItem =>
                cartItem.includes(ingredientName) || ingredientName.includes(cartItem)
            );

            if (!isInCart) {
                missingIngredients.push(ingredient);
            }
        }

        // Check availability of missing ingredients
        const availableMissingIngredients = await this.checkIngredientsAvailability(
            missingIngredients,
            customerType
        );

        const estimatedCost = await this.estimateMissingIngredientsCost(availableMissingIngredients, customerType);

        return {
            ...recipe,
            missing_ingredients: missingIngredients,
            available_missing_ingredients: availableMissingIngredients,
            estimated_total_cost: estimatedCost
        };
    }

    /**
     * Check which missing ingredients are actually available from farmers
     */
    private async checkIngredientsAvailability(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<RecipeIngredient[]> {
        const availableIngredients: RecipeIngredient[] = [];

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return availableIngredients;

            for (const ingredient of missingIngredients) {
                try {
                    console.log(`🔍 Checking availability for: ${ingredient.name}`);

                    const searchResponse = await api.get(`/browse/products/search`, {
                        params: { search: ingredient.name, limit: 10 },
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const products = searchResponse.data.items || [];
                    console.log(`📦 Found ${products.length} products for ${ingredient.name}`);

                    // Check if any farmer has this ingredient available for this customer type
                    let hasAvailableProduct = false;
                    let productDetails = [];

                    for (const product of products) {
                        const availableUnitPrices = product.unit_prices.filter((up: any) =>
                            up.customer_type === customerType && up.quantity_available > 0
                        );

                        if (availableUnitPrices.length > 0) {
                            hasAvailableProduct = true;
                            productDetails.push({
                                name: product.item,
                                farmer: product.farmer_name,
                                prices: availableUnitPrices.length
                            });
                        }
                    }

                    console.log(`✅ ${ingredient.name} available: ${hasAvailableProduct}`, productDetails);

                    if (hasAvailableProduct) {
                        availableIngredients.push(ingredient);
                    }
                } catch (error) {
                    console.error(`❌ Error checking availability for ${ingredient.name}:`, error);
                    // Continue to next ingredient if one fails
                }
            }
        } catch (error) {
            console.error('❌ Error checking ingredients availability:', error);
        }

        console.log(`📋 Available ingredients summary:`, availableIngredients.map(ing => ing.name));
        return availableIngredients;
    }

    /**
     * Estimate missing ingredients cost
     */
    private async estimateMissingIngredientsCost(
        missingIngredients: RecipeIngredient[],
        customerType: 'individual' | 'business'
    ): Promise<number> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return 0;

            let totalCost = 0;

            for (const ingredient of missingIngredients) {
                const searchResponse = await api.get(`/browse/products/search`, {
                    params: { search: ingredient.name, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` }
                });

                const products = searchResponse.data.items || [];

                const prices = products
                    .flatMap((product: any) =>
                        product.unit_prices
                            .filter((up: any) => up.customer_type === customerType)
                            .map((up: any) => up.price_per_unit)
                    )
                    .sort((a: number, b: number) => a - b);

                if (prices.length > 0) {
                    const lowestPrices = prices.slice(0, 3);
                    const medianPrice = lowestPrices[Math.floor(lowestPrices.length / 2)];
                    // Estimate cost for 1 unit
                    totalCost += medianPrice * 1;
                }
            }

            return totalCost;
        } catch (error) {
            console.error('Error estimating costs:', error);
            return 0;
        }
    }

    /**
     * Find best product match for an ingredient
     */
    async findBestProductMatch(ingredientName: string, customerType: 'individual' | 'business'): Promise<any> {
        try {
            console.log(`🔍 Finding best match for: ${ingredientName} (${customerType})`);

            const token = await AsyncStorage.getItem('token');
            const searchResponse = await api.get(`/browse/products/search`, {
                params: { search: ingredientName, limit: 20 },
                headers: { Authorization: `Bearer ${token}` }
            });

            const products = searchResponse.data.items || [];
            console.log(`📦 Found ${products.length} products for ${ingredientName}`);

            let bestMatch = null;
            let lowestPrice = Infinity;

            for (const product of products) {
                console.log(`🏪 Checking product: ${product.item} from ${product.farmer_name}`);

                const suitablePrices = product.unit_prices.filter(
                    (up: any) => up.customer_type === customerType && up.quantity_available > 0
                );

                console.log(`💰 Found ${suitablePrices.length} suitable prices for ${product.item}`);

                for (const unitPrice of suitablePrices) {
                    console.log(`   Price: rs ${unitPrice.price_per_unit}, Available: ${unitPrice.quantity_available}, Min order: ${unitPrice.minimum_order}`);

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
                        console.log(`✅ New best match: ${product.item} from ${product.farmer_name} at rs ${unitPrice.price_per_unit}`);
                    }
                }
            }

            if (bestMatch) {
                console.log(`🎯 Final best match for ${ingredientName}:`, bestMatch);
            } else {
                console.log(`❌ No suitable match found for ${ingredientName}`);
            }

            return bestMatch;
        } catch (error) {
            console.error(`❌ Error finding product match for ${ingredientName}:`, error);
            return null;
        }
    }

    /**
     * Add missing ingredients to cart
     */
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
                    console.log(`🔄 Processing ingredient: ${ingredient.name}`);

                    const bestMatch = await this.findBestProductMatch(ingredient.name, customerType);

                    if (bestMatch) {
                        // Always add just 1 unit or minimum order, whichever is higher
                        const finalQuantity = Math.max(1, bestMatch.minimum_order);

                        console.log(`📝 Adding to cart: ${finalQuantity} ${bestMatch.unit} of ${bestMatch.product_name}`);

                        const cartResponse = await api.post('/orders/cart/items', {
                            farmer_product_id: bestMatch.farmer_product_id,
                            unit_price_id: bestMatch.unit_price_id,
                            quantity: finalQuantity
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        console.log(`✅ Successfully added ${ingredient.name} to cart`);

                        addedItems.push({
                            name: ingredient.name,
                            product: bestMatch.product_name,
                            farmer: bestMatch.farmer_name,
                            price: bestMatch.price_per_unit,
                            quantity: finalQuantity,
                            unit: bestMatch.unit
                        });
                    } else {
                        console.log(`❌ No match found for ${ingredient.name}`);
                        errors.push(`Could not find ${ingredient.name} from any farmer`);
                    }
                } catch (itemError: any) {
                    console.error(`❌ Failed to add ${ingredient.name}:`, itemError);
                    console.error('Error details:', itemError.response?.data);
                    errors.push(`Failed to add ${ingredient.name}: ${itemError.response?.data?.detail || itemError.message}`);
                }
            }

            console.log(`📊 Cart addition summary: ${addedItems.length} added, ${errors.length} errors`);
            if (errors.length > 0) {
                console.log(`❌ Errors:`, errors);
            }

            return { success: addedItems.length > 0, addedItems, errors };
        } catch (error: any) {
            console.error('❌ Fatal error adding ingredients to cart:', error);
            return { success: false, addedItems: [], errors: ['Failed to add ingredients to cart: ' + error.message] };
        }
    }
}

export default new RuleBasedAIService();