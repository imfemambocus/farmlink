// data/mauritianRecipes.ts - Mauritian Recipe Knowledge Base
export interface RecipeIngredient {
    name: string;
    quantity: string;
    unit: string;
    category: 'vegetable' | 'fruit' | 'herb' | 'spice';
}

export interface RecipeRule {
    name: string;
    triggerIngredients: string[];
    ingredients: RecipeIngredient[];
    cuisine_type: 'mauritian' | 'creole' | 'indian' | 'chinese';
    difficulty: 'easy' | 'medium' | 'hard';
    prep_time: string;
    description: string;
    instructions: string[];
    nutritional_benefits: string[];
    weight: number;
}

export const MAURITIAN_RECIPES: RecipeRule[] = [
    {
        name: 'Rougaille Tomate Mauricienne',
        triggerIngredients: ['tomato', 'onion', 'garlic', 'ginger', 'chili'],
        ingredients: [
            { name: 'tomato', quantity: '2', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.2', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.1', unit: 'kg', category: 'spice' },
            { name: 'chili', quantity: '0.1', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '25 minutes',
        description: 'Classic Mauritian tomato-based stew, perfect with rice or bread',
        instructions: [
            'Dice tomatoes and onions finely',
            'Heat oil in pan and sauté onions until golden',
            'Add minced garlic, ginger and chili, cook 2 minutes',
            'Add tomatoes and simmer 20 minutes until thick',
            'Season with salt, pepper and fresh thyme',
            'Serve hot with rice or bread'
        ],
        nutritional_benefits: [
            'Rich in lycopene from tomatoes',
            'High in vitamin C',
            'Anti-inflammatory properties from ginger',
            'Boosts immunity with garlic'
        ],
        weight: 1.0
    },

    {
        name: 'Cari Légumes Créole',
        triggerIngredients: ['potato', 'onion', 'carrot', 'green_beans', 'garlic'],
        ingredients: [
            { name: 'potato', quantity: '2', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'carrot', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'green_beans', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' }
        ],
        cuisine_type: 'creole',
        difficulty: 'medium',
        prep_time: '35 minutes',
        description: 'Traditional Creole vegetable curry with aromatic spices',
        instructions: [
            'Cut all vegetables into uniform pieces',
            'Make masala paste with onions, garlic and curry spices',
            'Fry masala until fragrant and oil separates',
            'Add hard vegetables first (potato, carrot)',
            'Add coconut milk and simmer 20 minutes',
            'Add green beans in last 10 minutes',
            'Season and garnish with fresh coriander'
        ],
        nutritional_benefits: [
            'High in dietary fiber',
            'Rich in beta-carotene from carrots',
            'Good source of potassium',
            'Antioxidants from mixed vegetables'
        ],
        weight: 0.9
    },

    {
        name: 'Salade Palmiste Tropical',
        triggerIngredients: ['cucumber', 'tomato', 'lettuce', 'carrot', 'onion', 'cabbage'],
        ingredients: [
            { name: 'cucumber', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'tomato', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'lettuce', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'carrot', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '0.3', unit: 'kg', category: 'vegetable' },
            { name: 'cabbage', quantity: '0.5', unit: 'kg', category: 'vegetable' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '15 minutes',
        description: 'Fresh and crisp Mauritian salad with lime dressing, perfect for hot weather',
        instructions: [
            'Wash all vegetables thoroughly in clean water',
            'Slice cucumber and tomatoes into thin rounds',
            'Shred lettuce and cabbage finely',
            'Grate carrot and slice onion thinly',
            'Mix with fresh lime juice, salt and black pepper',
            'Add a pinch of sugar if desired',
            'Garnish with fresh mint leaves and serve immediately'
        ],
        nutritional_benefits: [
            'Rich in vitamins A and C',
            'Low calorie, high nutrition',
            'Good source of dietary fiber',
            'Hydrating and refreshing'
        ],
        weight: 0.8
    },

    {
        name: 'Chatini Mangue Épicé',
        triggerIngredients: ['mango', 'lime', 'chili', 'ginger'],
        ingredients: [
            { name: 'mango', quantity: '2', unit: 'kg', category: 'fruit' },
            { name: 'lime', quantity: '0.3', unit: 'kg', category: 'fruit' },
            { name: 'chili', quantity: '0.05', unit: 'kg', category: 'spice' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '20 minutes',
        description: 'Sweet and spicy Mauritian mango chutney, perfect side dish',
        instructions: [
            'Choose ripe but firm mangoes',
            'Grate or finely chop mangoes',
            'Squeeze fresh lime juice generously over fruit',
            'Add finely minced chili and ginger to taste',
            'Add salt and a pinch of sugar',
            'Mix well and let marinate 15 minutes',
            'Serve as accompaniment to curry or rice dishes'
        ],
        nutritional_benefits: [
            'High in vitamin C and antioxidants',
            'Natural digestive aid',
            'Anti-inflammatory properties',
            'Rich in vitamin A'
        ],
        weight: 0.7
    },

    {
        name: 'Bouillon Légumes Réconfortant',
        triggerIngredients: ['pumpkin', 'onion', 'spinach', 'garlic', 'ginger'],
        ingredients: [
            { name: 'pumpkin', quantity: '1.5', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'spinach', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'creole',
        difficulty: 'medium',
        prep_time: '45 minutes',
        description: 'Hearty Mauritian vegetable soup with warming spices',
        instructions: [
            'Cube pumpkin and other root vegetables uniformly',
            'Sauté onions, garlic and ginger until aromatic',
            'Add cubed pumpkin and cover with water or broth',
            'Simmer gently for 35 minutes until vegetables are tender',
            'Add spinach in last 5 minutes',
            'Season with salt, pepper and fresh herbs',
            'Serve hot with crusty bread'
        ],
        nutritional_benefits: [
            'High in beta-carotene and vitamin A',
            'Rich in iron from leafy greens',
            'Warming and comforting',
            'Good source of fiber'
        ],
        weight: 0.6
    },

    {
        name: 'Cari Aubergine Mauricien',
        triggerIngredients: ['eggplant', 'tomato', 'onion', 'garlic', 'ginger'],
        ingredients: [
            { name: 'eggplant', quantity: '1.5', unit: 'kg', category: 'vegetable' },
            { name: 'tomato', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'medium',
        prep_time: '30 minutes',
        description: 'Flavorful Mauritian eggplant curry with rich tomato base',
        instructions: [
            'Cut eggplant into medium cubes and salt lightly',
            'Let eggplant drain for 15 minutes, then pat dry',
            'Fry eggplant until golden, set aside',
            'Make tomato base with onions, garlic, ginger',
            'Add fried eggplant back to tomato curry',
            'Simmer until tender and flavors blend',
            'Garnish with fresh coriander'
        ],
        nutritional_benefits: [
            'Rich in antioxidants',
            'Good source of fiber',
            'Low in calories',
            'Heart-healthy potassium'
        ],
        weight: 0.8
    },

    {
        name: 'Vindaye Légumes',
        triggerIngredients: ['cabbage', 'carrot', 'green_beans', 'garlic', 'ginger'],
        ingredients: [
            { name: 'cabbage', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'carrot', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'green_beans', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'medium',
        prep_time: '25 minutes',
        description: 'Tangy Mauritian pickled vegetable curry with mustard seeds',
        instructions: [
            'Cut vegetables into julienne strips',
            'Heat mustard oil and add mustard seeds',
            'Add garlic and ginger paste',
            'Add turmeric and vinegar for tang',
            'Stir-fry vegetables keeping them crunchy',
            'Season with salt and curry leaves',
            'Serve as side dish with rice'
        ],
        nutritional_benefits: [
            'Probiotic benefits from fermentation',
            'High in vitamin C',
            'Aids digestion',
            'Low calorie option'
        ],
        weight: 0.7
    },

    {
        name: 'Salade de Concombre à la Mauricienne',
        triggerIngredients: ['cucumber', 'onion', 'chili', 'lime'],
        ingredients: [
            { name: 'cucumber', quantity: '1.5', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '0.3', unit: 'kg', category: 'vegetable' },
            { name: 'chili', quantity: '0.02', unit: 'kg', category: 'spice' },
            { name: 'lime', quantity: '0.2', unit: 'kg', category: 'fruit' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '10 minutes',
        description: 'Refreshing Mauritian cucumber salad with lime and chili',
        instructions: [
            'Slice cucumbers very thinly using mandoline or sharp knife',
            'Slice onions into thin rings',
            'Finely chop fresh chili (remove seeds for less heat)',
            'Mix vegetables in large bowl',
            'Squeeze fresh lime juice over salad',
            'Add salt and mix gently',
            'Let marinate 10 minutes before serving'
        ],
        nutritional_benefits: [
            'Very low in calories',
            'High water content for hydration',
            'Vitamin C from lime',
            'Cooling effect in hot weather'
        ],
        weight: 0.6
    },

    {
        name: 'Brèdes Épinards Mauricien',
        triggerIngredients: ['spinach', 'garlic', 'ginger', 'onion'],
        ingredients: [
            { name: 'spinach', quantity: '1', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' },
            { name: 'onion', quantity: '0.3', unit: 'kg', category: 'vegetable' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '20 minutes',
        description: 'Traditional Mauritian spinach dish with garlic and ginger',
        instructions: [
            'Clean spinach thoroughly and chop roughly',
            'Heat oil and sauté sliced onions until soft',
            'Add minced garlic and ginger, cook 1 minute',
            'Add spinach and cook until wilted',
            'Season with salt and pepper',
            'Cook until excess water evaporates',
            'Serve hot as side dish'
        ],
        nutritional_benefits: [
            'Extremely high in iron',
            'Rich in folate and vitamins',
            'Good source of calcium',
            'Antioxidant powerhouse'
        ],
        weight: 0.7
    },

    {
        name: 'Gâteau Patate Douce',
        triggerIngredients: ['potato', 'coconut'],
        ingredients: [
            { name: 'potato', quantity: '2', unit: 'kg', category: 'vegetable' },
            { name: 'coconut', quantity: '1', unit: 'kg', category: 'fruit' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'medium',
        prep_time: '60 minutes',
        description: 'Traditional Mauritian sweet potato cake with coconut',
        instructions: [
            'Boil potatoes until very tender',
            'Mash potatoes until completely smooth',
            'Grate fresh coconut or use coconut milk',
            'Mix mashed potato with coconut',
            'Add sugar, vanilla and a pinch of salt',
            'Steam in banana leaves for 45 minutes',
            'Cool before serving as dessert'
        ],
        nutritional_benefits: [
            'Rich in beta-carotene',
            'Natural sweetness',
            'Good source of fiber',
            'Traditional comfort food'
        ],
        weight: 0.5
    },

    {
        name: 'Salade Papaye Verte',
        triggerIngredients: ['papaya', 'carrot', 'lime', 'chili'],
        ingredients: [
            { name: 'papaya', quantity: '1.5', unit: 'kg', category: 'fruit' },
            { name: 'carrot', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'lime', quantity: '0.2', unit: 'kg', category: 'fruit' },
            { name: 'chili', quantity: '0.02', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'easy',
        prep_time: '15 minutes',
        description: 'Fresh green papaya salad with Southeast Asian influence',
        instructions: [
            'Peel and julienne green papaya',
            'Grate carrot into thin strips',
            'Finely slice fresh chili',
            'Mix papaya and carrot in large bowl',
            'Add lime juice, salt and a touch of sugar',
            'Add chili to taste',
            'Let flavors meld for 10 minutes before serving'
        ],
        nutritional_benefits: [
            'Digestive enzymes from papaya',
            'High in vitamin C',
            'Low calorie and refreshing',
            'Good source of fiber'
        ],
        weight: 0.6
    },

    {
        name: 'Cari Gros Pois avec Potiron',
        triggerIngredients: ['pumpkin', 'onion', 'garlic', 'ginger'],
        ingredients: [
            { name: 'pumpkin', quantity: '2', unit: 'kg', category: 'vegetable' },
            { name: 'onion', quantity: '0.5', unit: 'kg', category: 'vegetable' },
            { name: 'garlic', quantity: '0.1', unit: 'kg', category: 'herb' },
            { name: 'ginger', quantity: '0.05', unit: 'kg', category: 'spice' }
        ],
        cuisine_type: 'mauritian',
        difficulty: 'medium',
        prep_time: '40 minutes',
        description: 'Hearty Mauritian pumpkin curry, comfort food at its best',
        instructions: [
            'Cut pumpkin into large chunks, keeping skin on',
            'Make a paste with onions, garlic and ginger',
            'Heat oil and fry the paste until fragrant',
            'Add curry powder and cook 2 minutes',
            'Add pumpkin chunks and coconut milk',
            'Simmer gently until pumpkin is tender',
            'Season and garnish with fresh herbs'
        ],
        nutritional_benefits: [
            'Very high in vitamin A',
            'Rich in potassium',
            'Good source of fiber',
            'Naturally sweet and satisfying'
        ],
        weight: 0.8
    }
];

// Export ingredient categories for the AI service
export const INGREDIENT_CATEGORIES = new Map([
    ['vegetables', [
        'tomato', 'potato', 'onion', 'carrot', 'cabbage', 'lettuce', 'spinach',
        'broccoli', 'cauliflower', 'bell_pepper', 'chili', 'cucumber', 'eggplant',
        'okra', 'green_beans', 'pumpkin', 'beetroot', 'radish', 'ginger', 'garlic'
    ]],
    ['fruits', [
        'apple', 'banana', 'orange', 'mango', 'pineapple', 'papaya', 'guava',
        'lychee', 'coconut', 'lemon', 'lime', 'watermelon', 'melon', 'grapes', 'strawberry'
    ]],
    ['herbs', ['garlic', 'ginger']],
    ['spices', ['chili', 'ginger']]
]);

// Export cuisine affinities
export const CUISINE_AFFINITIES = new Map([
    ['mauritian', ['tomato', 'mango', 'lime', 'coconut', 'pumpkin', 'eggplant', 'papaya']],
    ['creole', ['potato', 'carrot', 'spinach', 'garlic', 'ginger', 'pumpkin']],
    ['indian', ['onion', 'garlic', 'ginger', 'chili', 'spinach', 'eggplant']],
    ['chinese', ['cabbage', 'broccoli', 'green_beans', 'garlic', 'bell_pepper']]
]);