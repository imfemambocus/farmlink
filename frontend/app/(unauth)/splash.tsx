import { useEffect, useRef } from 'react';
import {StatusBar, Text, View} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    withSequence,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import {animations} from "@/constants/animations";

export default function SplashScreen() {
    const router = useRouter();
    const scale = useSharedValue(0.5);
    const opacity = useSharedValue(0);
    const animationRef = useRef<LottieView>(null);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    useEffect(() => {
        // Start logo animation
        animationRef.current?.play(0, 90);
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
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#F2FBE0' }}>
            <StatusBar hidden={true} />
            <LottieView
                ref={animationRef}
                source={animations.leaf}
                autoPlay
                loop={false}
                style={{ width: 200, height: 200 }}
            />

            {/*<Animated.View style={[animatedStyle]}>*/}
            {/*    <Text className="text-3xl font-bold text-green-800 tracking-wide mt-4">*/}
            {/*        FarmLink*/}
            {/*    </Text>*/}
            {/*</Animated.View>*/}
        </View>
    );
}
