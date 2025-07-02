const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Safely merge resolver configuration
config.resolver = {
    ...config.resolver,
    alias: {
        ...config.resolver?.alias,
        '@react-native-voice/voice': require.resolve('@react-native-voice/voice'),
    },
    blockList: [
        ...(config.resolver?.blockList || []),
        new RegExp(`${__dirname}/node_modules/react-native-voice-enhanced/node_modules/@react-native-voice/voice/.*`),
    ],
};

module.exports = withNativeWind(config, { input: './app/globals.css' });