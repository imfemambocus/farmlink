import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { animations } from "@/constants/animations";

export default function IntroScreen() {
    const router = useRouter();
    const animationRef = useRef<LottieView>(null);
    const [showContent, setShowContent] = useState(false);
    const [showMainContent, setShowMainContent] = useState(false);

    // Splash animations
    const logoScale = useSharedValue(0.5);
    const logoOpacity = useSharedValue(0);

    // Background transition
    const splashBackgroundOpacity = useSharedValue(1);
    const introBackgroundOpacity = useSharedValue(0);

    // Logo sliding animations
    const logoTranslateX = useSharedValue(0);
    const logoTranslateY = useSharedValue(0);
    const logoFinalScale = useSharedValue(1);
    const headerTextOpacity = useSharedValue(0);
    const headerGroupTranslateY = useSharedValue(0);

    // Main content animations
    const taglineOpacity = useSharedValue(0);
    const taglineTranslateY = useSharedValue(30);
    const buttonsOpacity = useSharedValue(0);
    const buttonsTranslateY = useSharedValue(20);
    const footerOpacity = useSharedValue(0);

    const logoAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: logoScale.value * logoFinalScale.value },
            { translateX: logoTranslateX.value },
            { translateY: logoTranslateY.value }
        ],
        opacity: logoOpacity.value,
    }));

    const splashBackgroundStyle = useAnimatedStyle(() => ({
        opacity: splashBackgroundOpacity.value,
    }));

    const introBackgroundStyle = useAnimatedStyle(() => ({
        opacity: introBackgroundOpacity.value,
    }));

    const headerTextAnimatedStyle = useAnimatedStyle(() => ({
        opacity: headerTextOpacity.value,
    }));

    const headerGroupAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: headerGroupTranslateY.value }],
    }));

    const taglineAnimatedStyle = useAnimatedStyle(() => ({
        opacity: taglineOpacity.value,
        transform: [{ translateY: taglineTranslateY.value }],
    }));

    const buttonsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
        transform: [{ translateY: buttonsTranslateY.value }],
    }));

    const footerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: footerOpacity.value,
    }));

    useEffect(() => {
        const startAnimationSequence = async () => {
            // Check auth status
            const token = await AsyncStorage.getItem('token');

            // Start initial logo animation (splash phase)
            animationRef.current?.play(0, 90);
            logoScale.value = withSequence(
                withTiming(1.2, { duration: 800, easing: Easing.out(Easing.exp) }),
                withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
            );
            logoOpacity.value = withTiming(1, { duration: 1200 });

            // After splash animation completes, decide next action
            setTimeout(() => {
                if (token) {
                    // User is authenticated - navigate to auth area
                    router.replace('/(auth)');
                } else {
                    // No token - start transition sequence
                    // 1. Background transition
                    splashBackgroundOpacity.value = withTiming(0, {
                        duration: 600,
                        easing: Easing.out(Easing.ease)
                    });
                    introBackgroundOpacity.value = withTiming(1, {
                        duration: 600,
                        easing: Easing.out(Easing.ease)
                    });

                    setShowContent(true);

                    // 2. Smooth logo transition sequence
                    setTimeout(() => {
                        // Step A: Logo slides left and scales down smoothly
                        logoTranslateX.value = withTiming(-125, {
                            duration: 1000,
                            easing: Easing.out(Easing.cubic)
                        });
                        logoFinalScale.value = withTiming(0.5, {
                            duration: 1000,
                            easing: Easing.out(Easing.cubic)
                        });

                        // Step B: Show farmlink text next to logo
                        headerTextOpacity.value = withDelay(
                            500,
                            withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
                        );

                        // Step C: Slide the whole header group up to make space
                        headerGroupTranslateY.value = withDelay(
                            900,
                            withTiming(-100, { duration: 800, easing: Easing.out(Easing.cubic) })
                        );

                        // 3. Show main content after header settles
                        setTimeout(() => {
                            setShowMainContent(true);

                            // Animate main content in
                            taglineOpacity.value = withTiming(1, {
                                duration: 800,
                                easing: Easing.out(Easing.ease)
                            });
                            taglineTranslateY.value = withTiming(0, {
                                duration: 800,
                                easing: Easing.out(Easing.ease)
                            });

                            buttonsOpacity.value = withDelay(
                                300,
                                withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
                            );
                            buttonsTranslateY.value = withDelay(
                                300,
                                withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
                            );

                            footerOpacity.value = withDelay(
                                600,
                                withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
                            );
                        }, 1200);
                    }, 300);
                }
            }, 2500); // Wait for initial animation to complete
        };

        startAnimationSequence();
    }, []);

    return (
        <SafeAreaView className="flex-1">
            <StatusBar hidden={true} />

            {/* Splash Background */}
            <Animated.View
                style={[splashBackgroundStyle, { backgroundColor: '#F2FBE0' }]}
                className="absolute inset-0"
            />

            {/* Intro Background */}
            <Animated.View
                style={[introBackgroundStyle, { backgroundColor: '#FFFFFF' }]}
                className="absolute inset-0"
            />

            <View className="flex-1">
                {/* Header Section - Logo stays in absolute position */}
                <Animated.View style={[headerGroupAnimatedStyle]} className="absolute top-1/3 left-0 right-0">
                    {/* Logo - stays in same absolute position, then slides */}
                    <View className="items-center">
                        <Animated.View style={[logoAnimatedStyle]}>
                            <LottieView
                                ref={animationRef}
                                source={animations.leaf}
                                autoPlay
                                loop={false}
                                style={{ width: 150, height: 150 }}
                            />
                        </Animated.View>
                    </View>

                    {/* Text appears next to logo after it slides */}
                    {showContent && (
                        <Animated.View
                            style={[headerTextAnimatedStyle, {
                                position: 'absolute',
                                left: '43%',
                                top: '50%',
                                marginLeft: 10,
                                marginTop: -10
                            }]}
                        >
                            <Text className="text-3xl font-bold text-black">
                                farmlink
                            </Text>
                        </Animated.View>
                    )}
                </Animated.View>

                {/* Main Content */}
                {showMainContent && (
                    <View className="flex-1 justify-center items-center px-6">
                        {/* Main Tagline */}
                        <Animated.View style={[taglineAnimatedStyle]} className="items-center mb-16">
                            <Text className="text-lg text-gray-700 text-center font-sans px-4 leading-6">
                                connecting consumers directly with farmers for fresh, local produce
                            </Text>
                        </Animated.View>

                        {/* Buttons */}
                        <Animated.View style={[buttonsAnimatedStyle]} className="w-full max-w-sm">
                            <TouchableOpacity
                                onPress={() => router.push('/login')}
                                className="bg-black rounded-xl py-4 px-6 mb-4 items-center"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-lg font-semibold">
                                    log in
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => router.push('/register')}
                                className="border border-black rounded-xl py-4 px-6 items-center"
                                activeOpacity={0.8}
                            >
                                <Text className="text-black text-lg font-semibold">
                                    register
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}

                {/* Footer with trademark */}
                {showMainContent && (
                    <Animated.View style={[footerAnimatedStyle]} className="absolute bottom-8 left-0 right-0 items-center">
                        <Text className="text-sm text-gray-500 font-sans mb-2">
                            fresh produce, fair prices, direct from farm
                        </Text>
                        <Text className="text-xs text-gray-400 font-sans">
                            © IMFE Studio
                        </Text>
                    </Animated.View>
                )}
            </View>
        </SafeAreaView>
    );
}