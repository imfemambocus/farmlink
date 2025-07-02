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
import { useTranslation } from '@/context/LanguageContext';
import { useProductTranslations } from '@/utils/productTranslations';
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
    difficulty_translated?: string;
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
    const { t, tCart } = useTranslation();
    const { translateProduct, translateUnit } = useProductTranslations();
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

    if (customerType === 'business') {
        return null;
    }

    const generateRecipes = async () => {
        if (cartItems.length === 0) return;

        setLoading(true);
        try {
            const generatedRecipes = await ruleBasedAIService.generatePersonalizedRecipes(
                cartItems,
                customerType
            );
            setRecipes(generatedRecipes);
        } catch (err) {
            console.error('Error generating recipes:', err);
            onAlert('error', t('ai.recipeError'), t('ai.failedToGenerate'));
        } finally {
            setLoading(false);
        }
    };

    const getTranslatedProductName = (productName: string): string => {
        const backendName = productName.toLowerCase().replace(/\s+/g, '_');
        const translatedName = translateProduct(backendName);
        return translatedName || productName.replace(/_/g, ' ');
    };

    const handleAddMissingIngredients = async (recipe: Recipe) => {
        if (recipe.available_missing_ingredients.length === 0) {
            if (recipe.missing_ingredients.length === 0) {
                onAlert('info', tCart('allSet'), tCart('alreadyHaveIngredients'));
            } else {
                onAlert('info', tCart('noAvailableIngredients'), tCart('noneAvailable'));
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
                    .map(item => {
                        const translatedProduct = getTranslatedProductName(item.product);
                        const translatedUnit = translateUnit(item.unit, item.quantity);
                        return `${item.quantity} ${translatedUnit} ${translatedProduct}`;
                    })
                    .join(', ');

                const plural = result.addedItems.length !== 1 ? 's' : '';
                onAlert(
                    'success',
                    tCart('ingredientsAdded'),
                    tCart('addedIngredients', {
                        count: result.addedItems.length,
                        plural,
                        list: ingredientsList
                    })
                );
                onIngredientsAdded();
            } else {
                onAlert('error', tCart('addFailed'), tCart('couldNotAdd'));
            }
        } catch (error) {
            console.error('Error adding ingredients:', error);
            onAlert('error', t('common.error'), tCart('couldNotAdd'));
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
            Animated.timing(animationValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                setExpandedRecipe(null);
            });
        } else {
            if (expandedRecipe) {
                const prevAnimationValue = getAnimationValue(expandedRecipe);
                Animated.timing(prevAnimationValue, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                }).start();
            }

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
        const difficultyText = recipe.difficulty_translated || t(`ai.${recipe.difficulty}`);

        return (
            <View
                style={{ width: cardWidth }}
                className="bg-white rounded-xl mr-4 border border-gray-200 overflow-hidden"
            >
                <View className="bg-gray-100 px-4 py-3">
                    <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1 mr-2">
                            <Text className="text-base font-semibold text-black mb-1" numberOfLines={2}>
                                {recipe.name}
                            </Text>
                            <Text className="text-xs text-gray-600" numberOfLines={2}>
                                {recipe.description}
                            </Text>
                        </View>
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

                            {recipe.missing_ingredients.length > 0 && (
                                <>
                                    <Text className="text-xs text-gray-400 mx-2">•</Text>
                                    <Text className="text-xs text-orange-600">
                                        {recipe.missing_ingredients.length} {t('ai.missing')}
                                    </Text>
                                </>
                            )}
                        </View>

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
                                {difficultyText}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="p-4">
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
                                            <ActivityIndicator size="small" color="black" />
                                            <Text className="text-black text-sm font-medium ml-2">{tCart('adding')}</Text>
                                        </>
                                    ) : (
                                        <Text className="text-black text-sm font-medium">
                                            {tCart('addMissingIngredients')} {recipe.available_missing_ingredients.length} {t('common.of')} {recipe.missing_ingredients.length}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                                    <View className="flex-row items-center">
                                        <Text className="text-orange-700 text-sm font-medium">
                                            {tCart('missingIngredientsNotAvailable')}
                                        </Text>
                                    </View>
                                    <Text className="text-orange-600 text-xs mt-1">
                                        {recipe.missing_ingredients.length} {recipe.missing_ingredients.length !== 1 ? t('cart.ingredients') : t('cart.ingredient')} {t('farmers.noProductsAvailable')}
                                    </Text>
                                </View>
                            )}
                        </>
                    ) : (
                        <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <View className="flex-row items-center justify-center">
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text className="text-green-700 text-sm font-medium ml-2">
                                    {tCart('allIngredientsReady')}
                                </Text>
                            </View>
                        </View>
                    )}

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
                            {isExpanded ? tCart('hideRecipe') : tCart('viewFullRecipe')}
                        </Text>
                    </TouchableOpacity>
                </View>

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
                        {recipe.nutritional_benefits && recipe.nutritional_benefits.length > 0 && (
                            <View className="mb-3">
                                <Text className="text-sm font-semibold text-black mb-2">{tCart('nutritionalBenefits')}</Text>
                                {recipe.nutritional_benefits.map((benefit, idx) => (
                                    <Text key={idx} className="text-xs text-blue-600 mb-1">
                                        • {benefit.toLowerCase()}
                                    </Text>
                                ))}
                            </View>
                        )}

                        <View className="mb-3">
                            <Text className="text-sm font-semibold text-black mb-2">{tCart('ingredients')}</Text>
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

                        <View>
                            <Text className="text-sm font-semibold text-black mb-2">{tCart('instructions')}</Text>
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
            <View className="mb-4">
                <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <View className="flex-row items-center mb-2">
                        <View className="bg-green-100 p-2 rounded-full mr-3">
                            <Ionicons name="sparkles" size={18} color="#10b981" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-lg font-semibold text-black">
                                {tCart('recipeSuggestions')}
                            </Text>
                            <Text className="text-sm text-gray-600">
                                {tCart('basedOnCart')}
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

            {loading ? (
                <View className="py-12 items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-3 text-sm">
                        {tCart('aiAnalyzing')}
                    </Text>
                </View>
            ) : recipes.length >= 1 ? (
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
            ) : (
                <View className="py-6 items-center">
                    <Text className="text-gray-600 mt-3 text-sm text-center">
                        {tCart('noRecipes')}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default RecipeSuggestions;