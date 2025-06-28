export default {
  expo: {
    name: "Farmlink",
    slug: "farmlink",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "farmlink",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.imfestudio.farmlink",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription: "Farmlink needs microphone access for voice commands to search products and add items to cart",
        NSSpeechRecognitionUsageDescription: "Farmlink uses speech recognition to process your voice commands for easier shopping"
      }
    },
    android: {
      package: "com.imfestudio.farmlink",
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#F2FBE0",
      },
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK",
        "INTERNET",
        "SYSTEM_ALERT_WINDOW",
        "RECORD_AUDIO"
      ],
      usesCleartextTraffic: true,
      edgeToEdgeEnabled: true,
      googleServicesFile: "./google-services.json",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/logo.png",
    },
    notification: {
      icon: "./assets/images/logo.png",
      // color: "#4CAF50",
      // sounds: ["./assets/notification.wav"]
    },
    plugins: [
      "expo-router",
      "expo-web-browser",
      "expo-dev-client",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo.png",
          imageWidth: 128,
          resizeMode: "contain",
          backgroundColor: "#F2FBE0",
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/logo.png",
          // color: "#4CAF50",
          // sounds: ["./assets/notification.wav"],
          mode: "development", // or "production"
        }
      ],
      [
        "@react-native-voice/voice",
        {
          microphonePermission: "CUSTOM: Farmlink needs microphone access for voice commands to search products and add items to cart.",
          speechRecognitionPermission: "CUSTOM: Farmlink uses speech recognition to process your voice commands for easier shopping."
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            minSdkVersion: 24
          },
          ios: {
            deploymentTarget: "15.1"
          }
        }
      ]
    ],
    assetBundlePatterns: [
      "assets/fonts/*",
      "assets/images/*",
      "assets/icons/*"
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || "a41102c3-6cc4-4134-a832-4a6db668c1b2"
      },
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_51RbVKCR2koWNU5mYXZLTBS8F2QFV6BNavZXTeL8vi2W84bBMncWqogZCYDdOKZxsLF3sqkOqytjofCnFzk3DTCB100zbpCFyuk",
      MERCHANT_IDENTIFIER: process.env.MERCHANT_IDENTIFIER || "",
      API_BASE_URL: process.env.API_BASE_URL || "https://farmlink-bmiy.onrender.com",
    },
    owner: "imfestudio",
  },
};