const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.alias = {
    '@react-native-voice/voice': require.resolve('@react-native-voice/voice'),
};

module.exports = withNativeWind(config, { input: './app/globals.css' });