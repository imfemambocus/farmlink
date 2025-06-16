export const PRODUCT_IMAGES = {
    // Fruits
    tomato: require('../assets/images/products/tomato.png'),
    // banana: require('../assets/images/products/banana.png'),
    // apple: require('../assets/images/products/apple.png'),
    // orange: require('../assets/images/products/orange.png'),
    // mango: require('../assets/images/products/mango.png'),
    // pineapple: require('../assets/images/products/pineapple.png'),
    // papaya: require('../assets/images/products/papaya.png'),
    // guava: require('../assets/images/products/guava.png'),
    // lychee: require('../assets/images/products/lychee.png'),
    // coconut: require('../assets/images/products/coconut.png'),
    // lemon: require('../assets/images/products/lemon.png'),
    // lime: require('../assets/images/products/lime.png'),
    // watermelon: require('../assets/images/products/watermelon.png'),
    // melon: require('../assets/images/products/melon.png'),
    // grapes: require('../assets/images/products/grapes.png'),
    // strawberry: require('../assets/images/products/strawberry.png'),

    // Vegetables
    // potato: require('../assets/images/products/potato.png'),
    // carrot: require('../assets/images/products/carrot.png'),
    // onion: require('../assets/images/products/onion.png'),
    // cabbage: require('../assets/images/products/cabbage.png'),
    // lettuce: require('../assets/images/products/lettuce.png'),
    // spinach: require('../assets/images/products/spinach.png'),
    // broccoli: require('../assets/images/products/broccoli.png'),
    // cauliflower: require('../assets/images/products/cauliflower.png'),
    // bell_pepper: require('../assets/images/products/bell_pepper.png'),
    // chili: require('../assets/images/products/chili.png'),
    // cucumber: require('../assets/images/products/cucumber.png'),
    // eggplant: require('../assets/images/products/eggplant.png'),
    // okra: require('../assets/images/products/okra.png'),
    // green_beans: require('../assets/images/products/green_beans.png'),
    // pumpkin: require('../assets/images/products/pumpkin.png'),
    // beetroot: require('../assets/images/products/beetroot.png'),
    // radish: require('../assets/images/products/radish.png'),
    // ginger: require('../assets/images/products/ginger.png'),
    // garlic: require('../assets/images/products/garlic.png'),

    // Default fallback image
    default: require('../assets/images/products/default.png'),
} as const;

export const getProductImage = (productName: string) => {
    const normalizedName = productName.toLowerCase().replace(/\s+/g, '_');
    return PRODUCT_IMAGES[normalizedName as keyof typeof PRODUCT_IMAGES] || PRODUCT_IMAGES.default;
};

export type ProductImageKey = keyof typeof PRODUCT_IMAGES;