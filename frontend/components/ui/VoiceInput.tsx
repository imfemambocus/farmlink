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
import { useTranslation } from '@/context/LanguageContext';

interface VoiceInputProps {
    onResult?: (result: any) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    style?: ViewStyle;
    iconSize?: number;
    iconColor?: string;
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
    const { t, tVoice } = useTranslation();

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
            const hasPermission = await VoiceInputService.checkPermissions();
            if (!hasPermission) {
                Alert.alert(
                    tVoice('microphonePermission'),
                    tVoice('enableMicrophone'),
                    [{ text: t('common.ok') }]
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
            console.error(tVoice('voiceError'), error);
            setIsVisible(false);
            onError?.(tVoice('failedToStart'));
        }
    };

    const startVoiceRecognition = async () => {
        try {
            setIsListening(true);
            await VoiceInputService.startListening();

            setTimeout(async () => {
                if (isListening) {
                    await stopVoiceRecognition();
                }
            }, 10000);

        } catch (error) {
            console.error(tVoice('voiceError'), error);
            setIsListening(false);
            setResult(tVoice('failedToStart'));
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
                setResult(tVoice('didntHear'));
                setSuggestions([
                    tVoice('makesSure'),
                    tVoice('checkPermissions'),
                    tVoice('tryQuieter')
                ]);
            }
        } catch (error) {
            console.error(tVoice('voiceError'), error);
            setResult(tVoice('didntUnderstand'));
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
                if (result.data?.action === 'navigate_to_checkout') {
                    setTimeout(() => {
                        setIsVisible(false);
                        router.push('/(auth)/customer/checkout');
                    }, 2000);
                } else if (result.data?.products) {
                    onResult?.(result.data);
                } else {
                    await refreshCartCount();
                    onResult?.(result.data);
                }
            }

        } catch (error) {
            console.error(tVoice('voiceError'), error);
            setResult(tVoice('didntUnderstand'));
            setSuggestions([tVoice('tryAgain')]);
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
                className="shadow-lg elevation-8"
            >
                <Ionicons
                    name="mic"
                    size={iconSize}
                    color={disabled ? "red" : iconColor}
                />
            </TouchableOpacity>

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

                        <View className="items-center mb-6">
                            {isListening ? (
                                <View className="relative items-center justify-center my-8">
                                    <Animated.View
                                        className="absolute w-32 h-32 rounded-full"
                                        style={{
                                            backgroundColor: '#EAF3D0',
                                            opacity: 0.55,
                                            transform: [{ scale: pulseAnim }],
                                        }}
                                    />

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

                                    <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                        <Ionicons name="mic" size={32} color="black" />
                                    </View>
                                </View>
                            ) : isProcessing ? (
                                <View className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center">
                                    <ActivityIndicator size="large" color="white" />
                                </View>
                            ) : (
                                <View className="w-20 h-20 rounded-full bg-background items-center justify-center">
                                    <Ionicons name="mic" size={32} color="black" />
                                </View>
                            )}
                        </View>

                        <View className="mb-4">
                            {isListening ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        {tVoice('listening')}
                                    </Text>
                                    <Text className="text-xs text-gray-600 text-center my-4">
                                        {tVoice('addToCart')} {tVoice('findCarrots')}
                                    </Text>
                                </View>
                            ) : isProcessing ? (
                                <View className="items-center">
                                    <Text className="text-base font-medium text-black mb-2">
                                        {tVoice('processing')}
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
                                            <Text className="text-sm text-gray-500 mb-1">{tVoice('youSaid')}</Text>
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

                        {suggestions.length > 0 && !isListening && !isProcessing && (
                            <View className="mb-4">
                                <Text className="text-sm font-medium text-gray-700 mb-2">
                                    {tVoice('tryTheseCommands')}
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

                        <View className="flex-row gap-3">
                            {!isListening && !isProcessing && (
                                <TouchableOpacity
                                    onPress={retryVoiceInput}
                                    className="flex-1 bg-background py-3 rounded-lg"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-black font-medium text-center">
                                        {tVoice('tryAgain')}
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
                                        {tVoice('stopListening')}
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
                                    {isProcessing ? tVoice('processing') : tVoice('close')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {!isListening && !isProcessing && !result && (
                            <View className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <Text className="text-xs text-blue-700 text-center">
                                    <Text className="font-semibold">{tVoice('voiceCommands')}</Text>
                                    {'\n'}• &#34;{tVoice('searchForTomatoes')}&#34;
                                    {'\n'}• &#34;{tVoice('addToCart')}&#34;
                                    {'\n'}• &#34;{tVoice('findCarrots')}&#34;
                                    {'\n'}• &#34;{tVoice('checkoutItems')}&#34;
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}