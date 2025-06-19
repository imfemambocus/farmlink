export default {
  expo: {
    name: "FarmLink",
    slug: "farm-link",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "movies",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#F2FBE0",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/logo.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo.png",
          imageWidth: 64,
          resizeMode: "contain",
          backgroundColor: "#F2FBE0",
        },
      ],
    ],
    assetBundlePatterns: [
      "assets/fonts/*"
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_51RbVKCR2koWNU5mYXZLTBS8F2QFV6BNavZXTeL8vi2W84bBMncWqogZCYDdOKZxsLF3sqkOqytjofCnFzk3DTCB100zbpCFyuk",
      MERCHANT_IDENTIFIER: process.env.MERCHANT_IDENTIFIER || "",
      API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8000",
    },
  },
};
