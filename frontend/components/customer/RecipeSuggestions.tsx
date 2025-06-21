// components/customer/RecipeSuggestions.tsx - Fixed Version
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Dimensions,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ruleBasedAIService from '@/services/aiRecipeService';

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
    ingredients: any[];
    missing_ingredients: any[];
    available_missing_ingredients: any[];
    estimated_total_cost: number;
    instructions: string[];
    nutritional_benefits: string[];
    confidence_score: number;
}

interface RecipeSuggestionsProps {
    cartItems: CartItem[];
    customerType: 'individual' | 'business';
    onIngredientsAdded: () => void;
    onAlert: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth * 0.8;

const RecipeSuggestions: React.FC<RecipeSuggestionsProps> = ({
     cartItems,
     customerType,
     onIngredientsAdded,
     onAlert
 }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingIngredients, setAddingIngredients] = useState<string | null>(null);
    const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
    const animationsRef = useRef<{ [key: string]: Animated.Value }>({});

    useEffect(() => {
        if (cartItems.length > 0 && customerType === 'individual') {
            generateRecipes();
        } else {
            setRecipes([]);
        }
    }, [cartItems, customerType]);

    // Hide completely for business users (after all hooks)
    if (customerType === 'business') {
        return null;
    }

    const generateRecipes = async () => {
        if (cartItems.length === 0) return;

        setLoading(true);
        try {
            console.log('🤖 Generating rule-based AI recipes...');
            const generatedRecipes = await ruleBasedAIService.generatePersonalizedRecipes(
                cartItems,
                customerType
            );
            setRecipes(generatedRecipes);
            console.log('✅ Generated', generatedRecipes.length, 'AI recipes');
        } catch (err) {
            console.error('Error generating recipes:', err);
            onAlert('error', 'AI Recipe Error', 'Failed to generate recipe suggestions.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMissingIngredients = async (recipe: Recipe) => {
        // Use available missing ingredients instead of all missing ingredients
        if (recipe.available_missing_ingredients.length === 0) {
            if (recipe.missing_ingredients.length === 0) {
                onAlert('info', 'All Set! 🎉', 'You already have all ingredients for this recipe in your cart!');
            } else {
                onAlert('info', 'No Available Ingredients', 'None of the missing ingredients are currently available from farmers.');
            }
            return;
        }

        setAddingIngredients(recipe.id);

        try {
            const result = await ruleBasedAIService.addMissingIngredientsToCart(
                recipe.available_missing_ingredients,
                customerType
            );

            if (result.success) {
                const ingredientsList = result.addedItems
                    .map(item => `${item.quantity} ${item.unit} ${item.product}`)
                    .join(', ');

                onAlert(
                    'success',
                    'Ingredients Added! 🎉',
                    `Added ${result.addedItems.length} ingredient${result.addedItems.length !== 1 ? 's' : ''}: ${ingredientsList}. Please adjust quantities as needed for your recipe.`
                );
                onIngredientsAdded();
            } else {
                onAlert('error', 'Add Failed', 'Could not add the available ingredients. Please try again.');
            }
        } catch (error) {
            console.error('Error adding ingredients:', error);
            onAlert('error', 'Error', 'Failed to add ingredients. Please try again.');
        } finally {
            setAddingIngredients(null);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'hard': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getDifficultyIcon = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'leaf';
            case 'medium': return 'time';
            case 'hard': return 'flame';
            default: return 'help-circle';
        }
    };

    const formatPrice = (price: number): string => {
        return price.toFixed(2);
    };

    const formatConfidenceScore = (score: number): string => {
        return `${Math.round(score * 100)}%`;
    };

    const getAnimationValue = (recipeId: string) => {
        if (!animationsRef.current[recipeId]) {
            animationsRef.current[recipeId] = new Animated.Value(0);
        }
        return animationsRef.current[recipeId];
    };

    const toggleRecipeExpansion = (recipeId: string) => {
        const animationValue = getAnimationValue(recipeId);

        if (expandedRecipe === recipeId) {
            // Collapse
            Animated.timing(animationValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                setExpandedRecipe(null);
            });
        } else {
            // Collapse previous if exists
            if (expandedRecipe) {
                const prevAnimationValue = getAnimationValue(expandedRecipe);
                Animated.timing(prevAnimationValue, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                }).start();
            }

            // Expand new
            setExpandedRecipe(recipeId);
            Animated.timing(animationValue, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    };

    const renderRecipeCard = ({ item: recipe }: { item: Recipe }) => {
        const isExpanded = expandedRecipe === recipe.id;
        const animationValue = getAnimationValue(recipe.id);

        return (
            <View
                style={{ width: cardWidth }}
                className="bg-white rounded-xl mr-4 border border-gray-200 overflow-hidden"
            >
                {/* Recipe Header */}
                <View className="bg-gray-100 px-4 py-3">
                    <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1 mr-2">
                            <Text className="text-base font-semibold text-black mb-1" numberOfLines={2}>
                                {recipe.name.toLowerCase()}
                            </Text>
                            <Text className="text-xs text-gray-600" numberOfLines={2}>
                                {recipe.description.toLowerCase()}
                            </Text>
                        </View>
                        {/* AI Confidence Badge */}
                        <View className="bg-green-100 px-2 py-1 rounded-full">
                            <Text className="text-green-700 text-xs font-medium">
                                🤖 {formatConfidenceScore(recipe.confidence_score)}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Ionicons name="time-outline" size={14} color="#666666" />
                            <Text className="text-xs text-gray-500 ml-1">{recipe.prep_time}</Text>

                            {/* Show missing ingredients count */}
                            {recipe.missing_ingredients.length > 0 && (
                                <>
                                    <Text className="text-xs text-gray-400 mx-2">•</Text>
                                    <Text className="text-xs text-orange-600">
                                        {recipe.missing_ingredients.length} missing
                                    </Text>
                                </>
                            )}
                        </View>

                        {/* Difficulty Badge */}
                        <View
                            className="flex-row items-center px-2 py-1 rounded-full"
                            style={{ backgroundColor: getDifficultyColor(recipe.difficulty) + '20' }}
                        >
                            <Ionicons
                                name={getDifficultyIcon(recipe.difficulty) as any}
                                size={12}
                                color={getDifficultyColor(recipe.difficulty)}
                            />
                            <Text
                                className="text-xs font-medium ml-1"
                                style={{ color: getDifficultyColor(recipe.difficulty) }}
                            >
                                {recipe.difficulty}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Recipe Content */}
                <View className="p-4">
                    {/* Missing Ingredients Status */}
                    {recipe.missing_ingredients.length > 0 ? (
                        <>
                            {recipe.available_missing_ingredients.length > 0 ? (
                                <TouchableOpacity
                                    onPress={() => handleAddMissingIngredients(recipe)}
                                    className="bg-background rounded-lg py-3 px-4 flex-row items-center justify-center mb-3"
                                    activeOpacity={0.7}
                                    disabled={addingIngredients === recipe.id}
                                >
                                    {addingIngredients === recipe.id ? (
                                        <>
                                            <ActivityIndicator size="small" color="white" />
                                            <Text className="text-black text-sm font-medium ml-2">adding...</Text>
                                        </>
                                    ) : (
                                        <Text className="text-black text-sm font-medium">
                                            add {recipe.available_missing_ingredients.length} of {recipe.missing_ingredients.length} missing ingredients
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                                    <View className="flex-row items-center">
                                        <Ionicons name="alert-circle" size={16} color="#f59e0b" />
                                        <Text className="text-orange-700 text-sm font-medium ml-2">
                                            missing ingredients not available
                                        </Text>
                                    </View>
                                    <Text className="text-orange-600 text-xs mt-1">
                                        {recipe.missing_ingredients.length} ingredient{recipe.missing_ingredients.length !== 1 ? 's' : ''} not found from farmers
                                    </Text>
                                </View>
                            )}
                        </>
                    ) : (
                        <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <View className="flex-row items-center">
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text className="text-green-700 text-sm font-medium ml-2">
                                    all ingredients ready!
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* View Recipe Button */}
                    <TouchableOpacity
                        onPress={() => toggleRecipeExpansion(recipe.id)}
                        className="bg-gray-100 rounded-lg py-2 px-3 flex-row items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "eye-outline"}
                            size={16}
                            color="#666666"
                        />
                        <Text className="text-gray-700 text-sm font-medium ml-2">
                            {isExpanded ? 'hide recipe' : 'view full recipe'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Animated Expanded Recipe Details */}
                <Animated.View
                    style={{
                        maxHeight: animationValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 800],
                        }),
                        opacity: animationValue,
                        overflow: 'hidden',
                    }}
                    className="border-t border-gray-200"
                >
                    <View className="px-4 pb-4 pt-3">
                        {/* Nutritional Benefits */}
                        {recipe.nutritional_benefits && recipe.nutritional_benefits.length > 0 && (
                            <View className="mb-3">
                                <Text className="text-sm font-semibold text-black mb-2">nutritional benefits:</Text>
                                {recipe.nutritional_benefits.map((benefit, idx) => (
                                    <Text key={idx} className="text-xs text-blue-600 mb-1">
                                        • {benefit.toLowerCase()}
                                    </Text>
                                ))}
                            </View>
                        )}

                        {/* Ingredients */}
                        <View className="mb-3">
                            <Text className="text-sm font-semibold text-black mb-2">ingredients:</Text>
                            {recipe.ingredients.map((ingredient, idx) => (
                                <View key={idx} className="flex-row items-center justify-between py-1">
                                    <Text className="text-xs text-gray-600 flex-1">
                                        • {ingredient.name}
                                        {ingredient.category && (
                                            <Text className="text-gray-400"> ({ingredient.category})</Text>
                                        )}
                                    </Text>
                                    <Text className="text-xs text-gray-500">
                                        {ingredient.quantity} {ingredient.unit}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Instructions */}
                        <View>
                            <Text className="text-sm font-semibold text-black mb-2">instructions:</Text>
                            {recipe.instructions.map((step, idx) => (
                                <Text key={idx} className="text-xs text-gray-600 mb-1 leading-4">
                                    {idx + 1}. {step.toLowerCase()}
                                </Text>
                            ))}
                        </View>
                    </View>
                </Animated.View>
            </View>
        );
    };

    if (cartItems.length === 0) {
        return null;
    }

    return (
        <View>
            {/* Recipe Suggestions Banner */}
            <View className="mb-4">
                <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <View className="flex-row items-center mb-2">
                        <View className="bg-green-100 p-2 rounded-full mr-3">
                            <Ionicons name="sparkles" size={18} color="#10b981" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-lg font-semibold text-black">
                                recipe suggestions
                            </Text>
                            <Text className="text-sm text-gray-600">
                                based on the items in your cart
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={generateRecipes}
                            className="p-2"
                            activeOpacity={0.7}
                            disabled={loading}
                        >
                            <Ionicons
                                name="refresh"
                                size={20}
                                color={loading ? "#ccc" : "#666666"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Loading State */}
            {loading ? (
                <View className="py-12 items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-3 text-sm">
                        🤖 ai analyzing cart & generating recipes...
                    </Text>
                </View>
            ) : (
                /* Recipe Cards Slider */
                <View className="mb-6">
                    <FlatList
                        data={recipes}
                        renderItem={renderRecipeCard}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingVertical: 4
                        }}
                        snapToInterval={cardWidth + 16}
                        snapToAlignment="start"
                        decelerationRate="fast"
                    />
                </View>
            )}
        </View>
    );
};

export default RecipeSuggestions;