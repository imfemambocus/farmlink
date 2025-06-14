import { useEffect } from 'react';
import { Text, ImageBackground } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    withSequence,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// Optional: background image stored locally or online
const backgroundImage = { uri: 'https://images.unsplash.com/photo-1564417947365-8dbc9d0e718e?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' };

export default function SplashScreen() {
    const router = useRouter();
    const scale = useSharedValue(0.5);
    const opacity = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    useEffect(() => {
        // Start logo animation
        scale.value = withSequence(
            withTiming(1.2, { duration: 800, easing: Easing.out(Easing.exp) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
        );

        opacity.value = withTiming(1, { duration: 1200 });

        const checkAuth = async () => {
            const token = await AsyncStorage.getItem('token');

            setTimeout(() => {
                if (token) {
                    router.replace('/profile');
                } else {
                    router.replace('/intro');
                }
            }, 3000); // gives time for animation to finish
        };

        checkAuth();
    }, []);

    return (
        <ImageBackground
            source={backgroundImage}
            resizeMode="cover"
            className="flex-1 justify-center items-center"
        >
            <Animated.View style={[animatedStyle]}>
                <Text className="text-4xl font-bold text-white tracking-wide">FarmLink 🌾</Text>
            </Animated.View>
        </ImageBackground>
    );
}
