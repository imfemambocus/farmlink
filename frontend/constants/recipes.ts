export interface RecipeIngredient {
    name: string;
    quantity: string;
    unit: string;
    category: 'vegetable' | 'fruit' | 'herb' | 'spice';
}

export interface RecipeTranslations {
    en: {
        name: string;
        description: string;
        instructions: string[];
        nutritional_benefits: string[];
    };
    fr: {
        name: string;
        description: string;
        instructions: string[];
        nutritional_benefits: string[];
    };
}

export interface RecipeRule {
    triggerIngredients: string[];
    ingredients: RecipeIngredient[];
    cuisine_type: 'mauritian' | 'creole' | 'indian' | 'chinese';
    difficulty: 'easy' | 'medium' | 'hard';
    prep_time: string;
    weight: number;
    translations: RecipeTranslations;
}

export const MAURITIAN_RECIPES: RecipeRule[] = [
    {
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
        weight: 1.0,
        translations: {
            en: {
                name: 'Rougaille Tomate Mauricienne',
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
                ]
            },
            fr: {
                name: 'Rougaille Tomate Mauricienne',
                description: 'Ragoût mauricien classique à base de tomates, parfait avec du riz ou du pain',
                instructions: [
                    'Couper finement les tomates et les oignons',
                    'Chauffer l\'huile dans une poêle et faire revenir les oignons jusqu\'à ce qu\'ils soient dorés',
                    'Ajouter l\'ail émincé, le gingembre et le piment, cuire 2 minutes',
                    'Ajouter les tomates et laisser mijoter 20 minutes jusqu\'à épaississement',
                    'Assaisonner avec du sel, du poivre et du thym frais',
                    'Servir chaud avec du riz ou du pain'
                ],
                nutritional_benefits: [
                    'Riche en lycopène des tomates',
                    'Riche en vitamine C',
                    'Propriétés anti-inflammatoires du gingembre',
                    'Stimule l\'immunité avec l\'ail'
                ]
            }
        }
    },

    {
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
        weight: 0.9,
        translations: {
            en: {
                name: 'Cari Légumes Créole',
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
                ]
            },
            fr: {
                name: 'Cari Légumes Créole',
                description: 'Curry de légumes créole traditionnel aux épices aromatiques',
                instructions: [
                    'Couper tous les légumes en morceaux uniformes',
                    'Faire une pâte de masala avec les oignons, l\'ail et les épices de curry',
                    'Faire frire le masala jusqu\'à ce qu\'il soit parfumé et que l\'huile se sépare',
                    'Ajouter d\'abord les légumes durs (pomme de terre, carotte)',
                    'Ajouter le lait de coco et laisser mijoter 20 minutes',
                    'Ajouter les haricots verts dans les 10 dernières minutes',
                    'Assaisonner et garnir de coriandre fraîche'
                ],
                nutritional_benefits: [
                    'Riche en fibres alimentaires',
                    'Riche en bêta-carotène des carottes',
                    'Bonne source de potassium',
                    'Antioxydants des légumes mélangés'
                ]
            }
        }
    },

    {
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
        weight: 0.8,
        translations: {
            en: {
                name: 'Salade Palmiste Tropical',
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
                ]
            },
            fr: {
                name: 'Salade Palmiste Tropical',
                description: 'Salade mauricienne fraîche et croquante avec vinaigrette au citron vert, parfaite par temps chaud',
                instructions: [
                    'Laver soigneusement tous les légumes à l\'eau claire',
                    'Trancher les concombres et les tomates en rondelles fines',
                    'Hacher finement la laitue et le chou',
                    'Râper la carotte et trancher finement l\'oignon',
                    'Mélanger avec du jus de citron vert frais, du sel et du poivre noir',
                    'Ajouter une pincée de sucre si désiré',
                    'Garnir de feuilles de menthe fraîche et servir immédiatement'
                ],
                nutritional_benefits: [
                    'Riche en vitamines A et C',
                    'Faible en calories, haute nutrition',
                    'Bonne source de fibres alimentaires',
                    'Hydratant et rafraîchissant'
                ]
            }
        }
    },

    {
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
        weight: 0.7,
        translations: {
            en: {
                name: 'Chatini Mangue Épicé',
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
                ]
            },
            fr: {
                name: 'Chatini Mangue Épicé',
                description: 'Chutney de mangue mauricien sucré et épicé, accompagnement parfait',
                instructions: [
                    'Choisir des mangues mûres mais fermes',
                    'Râper ou hacher finement les mangues',
                    'Presser généreusement le jus de citron vert frais sur les fruits',
                    'Ajouter le piment et le gingembre finement hachés selon le goût',
                    'Ajouter du sel et une pincée de sucre',
                    'Bien mélanger et laisser mariner 15 minutes',
                    'Servir en accompagnement de curry ou de plats de riz'
                ],
                nutritional_benefits: [
                    'Riche en vitamine C et antioxydants',
                    'Aide digestive naturelle',
                    'Propriétés anti-inflammatoires',
                    'Riche en vitamine A'
                ]
            }
        }
    },

    {
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
        weight: 0.6,
        translations: {
            en: {
                name: 'Bouillon Légumes Réconfortant',
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
                ]
            },
            fr: {
                name: 'Bouillon Légumes Réconfortant',
                description: 'Soupe de légumes mauricienne copieuse aux épices réchauffantes',
                instructions: [
                    'Couper uniformément le potiron et autres légumes racines en cubes',
                    'Faire revenir les oignons, l\'ail et le gingembre jusqu\'à ce qu\'ils soient aromatiques',
                    'Ajouter le potiron en cubes et couvrir d\'eau ou de bouillon',
                    'Laisser mijoter doucement 35 minutes jusqu\'à ce que les légumes soient tendres',
                    'Ajouter les épinards dans les 5 dernières minutes',
                    'Assaisonner avec du sel, du poivre et des herbes fraîches',
                    'Servir chaud avec du pain croustillant'
                ],
                nutritional_benefits: [
                    'Riche en bêta-carotène et vitamine A',
                    'Riche en fer des légumes verts',
                    'Réchauffant et réconfortant',
                    'Bonne source de fibres'
                ]
            }
        }
    }
];

export const DIFFICULTY_TRANSLATIONS = {
    en: {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard'
    },
    fr: {
        easy: 'Facile',
        medium: 'Moyen',
        hard: 'Difficile'
    }
};

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

export const CUISINE_AFFINITIES = new Map([
    ['mauritian', ['tomato', 'mango', 'lime', 'coconut', 'pumpkin', 'eggplant', 'papaya']],
    ['creole', ['potato', 'carrot', 'spinach', 'garlic', 'ginger', 'pumpkin']],
    ['indian', ['onion', 'garlic', 'ginger', 'chili', 'spinach', 'eggplant']],
    ['chinese', ['cabbage', 'broccoli', 'green_beans', 'garlic', 'bell_pepper']]
]);