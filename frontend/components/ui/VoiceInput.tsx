// Updated VoiceInput.tsx with improved design and floating button capability
import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Animated,
    Dimensions,
    Alert,
    ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'expo-router';
import VoiceInputService from '@/services/voiceService';

interface VoiceInputProps {
    onResult?: (result: any) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    style?: ViewStyle; // NEW: Allow custom styling for floating button
    iconSize?: number; // NEW: Custom icon size
    iconColor?: string; // NEW: Custom icon color
}

export default function VoiceInput({
                                       onResult,
                                       onError,
                                       disabled = false,
                                       style,
                                       iconSize = 20,
                                       iconColor = "black"
                                   }: VoiceInputProps) {
    const { user } = useContext(AuthContext);
    const { refreshCartCount } = useCart();
    const router = useRouter();

    const [isVisible, setIsVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [result, setResult] = useState<string>('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [pulseAnim] = useState(new Animated.Value(1));
    const [waveAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        return () => {
            VoiceInputService.cleanup();
        };
    }, []);

    useEffect(() => {
        if (isListening) {
            startPulseAnimation();
            startWaveAnimation();
        } else {
            stopAnimations();
        }
    }, [isListening]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const startWaveAnimation = () => {
        Animated.loop(
            Animated.timing(waveAnim, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    };

    const stopAnimations = () => {
        pulseAnim.stopAnimation();
        waveAnim.stopAnimation();
        pulseAnim.setValue(1);
        waveAnim.setValue(0);
    };

    const handleVoicePress = async () => {
        if (disabled) return;

        try {
            // Check permissions first
            const hasPermission = await VoiceInputService.checkPermissions();
            if (!hasPermission) {
                Alert.alert(
                    'Microphone Permission',
                    'Please enable microphone permission in your device settings to use voice commands.',
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsVisible(true);
            setIsListening(false);
            setIsProcessing(false);
            setRecognizedText('');
            setResult('');
            setSuggestions([]);

            await startVoiceRecognition();
        } catch (error) {
            console.error('Voice input error:', error);
            setIsVisible(false);
            onError?.('Failed to start voice recognition. Please try again.');
        }
    };

    const startVoiceRecognition = async () => {
        try {
            setIsListening(true);
            await VoiceInputService.startListening();

            // Auto-stop after 10 seconds
            setTimeout(async () => {
                if (isListening) {
                    await stopVoiceRecognition();
                }
            }, 10000);

        } catch (error) {
            console.error('Start listening error:', error);
            setIsListening(false);
            setResult('Failed to start voice recognition.');
        }
    };

    const stopVoiceRecognition = async () => {
        try {
            setIsListening(false);
            const recognizedText = await VoiceInputService.stopListening();

            if (recognizedText.trim()) {
                setRecognizedText(recognizedText);
                await processVoiceCommand(recognizedText);
            } else {
                setResult("I didn't hear anything. Please try again.");
                setSuggestions([
                    "Make sure your microphone is working",
                    "Speak clearly and try again",
                    "Check your device volume"
                ]);
            }
        } catch (error) {
            console.error('Stop listening error:', error);
            setResult('Error processing your voice command.');
        }
    };

    const processVoiceCommand = async (text: string) => {
        try {
            setIsProcessing(true);

            const customerType = user?.role as 'individual' | 'business';
            const result = await VoiceInputService.processVoiceCommand(text, customerType);

            setResult(result.message);
            setSuggestions(result.suggestions || []);

            if (result.success) {
                // Handle successful commands
                if (result.data?.action === 'navigate_to_checkout') {
                    // Navigate to checkout after a brief delay
                    setTimeout(() => {
                        setIsVisible(false);
                        router.push('/(auth)/customer/checkout');
                    }, 2000);
                } else if (result.data?.products) {
                    // For search results, could navigate to products page with search term
                    onResult?.(result.data);
                } else {
                    // For add to cart, refresh cart count
                    await refreshCartCount();
                    onResult?.(result.data);
                }
            }

        } catch (error) {
            console.error('Process command error:', error);
            setResult('Sorry, there was an error processing your command.');
            setSuggestions(['Please try again']);
        } finally {
            setIsProcessing(false);
        }
    };

    const retryVoiceInput = async () => {
        setRecognizedText('');
        setResult('');
        setSuggestions([]);
        await startVoiceRecognition();
    };

    const closeModal = () => {
        setIsVisible(false);
        setIsListening(false);
        setIsProcessing(false);
        VoiceInputService.stopListening().catch(console.error);
    };

    const trySuggestion = (suggestion: string) => {
        setRecognizedText(suggestion);
        processVoiceCommand(suggestion);
    };

    if (!user || (user.role !== 'individual' && user.role !== 'business')) {
        return null;
    }

    return (
        <>
            {/* Voice Input Button */}
            <TouchableOpacity
                onPress={handleVoicePress}
                disabled={disabled}
                style={style || {
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#EAF3D0',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="mic"
                    size={iconSize}
                    color={disabled ? "#999" : iconColor}
                />
            </TouchableOpacity>

            {/* Voice Input Modal - UPDATED DESIGN */}
            <Modal
                visible={isVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View
                    className="flex-1 bg-black bg-opacity-50 justify-center items-center"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                >
                    <View className="bg-white rounded-2xl p-6 mx-6 w-full max-w-sm">

                        {/* Voice Visualization */}
                        <View className="items-center mb-6">
                            {isListening ? (
                                <View className="relative items-center justify-center my-8">
                                    {/* Outer pulse ring - Better green ripple */}
                                    <Animated.View
                                        className="absolute w-32 h-32 rounded-full"
                                        style={{
                                            backgroundColor: '#EAF3D0',
                                            opacity: 0.55,
                                            transform: [{ scale: pulseAnim }],
                                        }}
                                    />

                                    {/* Wave rings - Better green */}
                                    <Animated.View
                                        className="absolute w-24 h-24 rounded-full border-2"
                                        style={{
                                            borderColor: '#000000',
                                            opacity: waveAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.8, 0],
                                            }),
                                            transform: [{
                                                scale: waveAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [1, 1.5],
                                                }),
                                            }],
                                        }}
                                    />

                                    {/* Center microphone with green background */}
                                    <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                        <Ionicons name="mic" size={32} color="black" />
                                    </View>
                                </View>
                            ) : isProcessing ? (
                                <View className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center">
                                    <ActivityIndicator size="large" color="white" />
                                </View>
                            ) : (
                                // CHANGED: Mic icon instead of checkmark, bg-background with black icon
                                <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                    <Ionicons name="mic" size={32} color="black" />
                                </View>
                            )}
                        </View>

                        {/* Status Text */}
                        <View className="mb-4">
                            {isListening ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        listening...
                                    </Text>
                                    <Text className="text-xs text-gray-600 text-center my-4">
                                        Try saying: &#34;Add 2 kg tomatoes to cart&#34; or &#34;Search for vegetables from Curepipe&#34;
                                    </Text>
                                </View>
                            ) : isProcessing ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        Processing...
                                    </Text>
                                    {recognizedText && (
                                        <Text className="text-sm text-gray-600 text-center italic">
                                            &#34;{recognizedText}&#34;
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {recognizedText && (
                                        <View className="mb-3">
                                            <Text className="text-sm text-gray-500 mb-1">You said:</Text>
                                            <Text className="text-base italic text-gray-700">
                                                &#34;{recognizedText}&#34;
                                            </Text>
                                        </View>
                                    )}

                                    {result && (
                                        <View className="mb-3">
                                            <Text className="text-base text-black leading-5">
                                                {result}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Suggestions */}
                        {suggestions.length > 0 && !isListening && !isProcessing && (
                            <View className="mb-4">
                                <Text className="text-sm font-medium text-gray-700 mb-2">
                                    Try these commands:
                                </Text>
                                {suggestions.map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => trySuggestion(suggestion)}
                                        className="bg-gray-100 rounded-lg p-3 mb-2"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-sm text-gray-700">
                                            &#34;{suggestion}&#34;
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View className="flex-row gap-3">
                            {!isListening && !isProcessing && (
                                <TouchableOpacity
                                    onPress={retryVoiceInput}
                                    className="flex-1 bg-background py-3 rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-black font-medium text-center">
                                        try again
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {isListening && (
                                <TouchableOpacity
                                    onPress={stopVoiceRecognition}
                                    className="flex-1 bg-red-500 py-3 rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-white font-medium text-center">
                                        stop listening
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={closeModal}
                                className="flex-1 bg-gray-200 py-3 rounded-lg"
                                activeOpacity={0.7}
                                disabled={isProcessing}
                            >
                                <Text className="text-black font-medium text-center">
                                    {isProcessing ? 'processing...' : 'close'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Help Text */}
                        {!isListening && !isProcessing && !result && (
                            <View className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <Text className="text-xs text-blue-700 text-center">
                                    <Text className="font-semibold">Voice Commands:</Text>
                                    {'\n'}• &#34;Search for tomatoes&#34;
                                    {'\n'}• &#34;Add 2 kg potatoes to cart&#34;
                                    {'\n'}• &#34;Find carrots from Curepipe&#34;
                                    {'\n'}• &#34;Checkout my items&#34;
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}