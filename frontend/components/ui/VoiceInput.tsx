import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Animated,
    ViewStyle,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'expo-router';
import VoiceInputService from '@/services/voiceService';
import CustomAlert from '@/components/ui/CustomAlert';
import {useTranslation} from "@/context/LanguageContext";

interface VoiceInputProps {
    disabled?: boolean;
    style?: ViewStyle;
    iconSize?: number;
    iconColor?: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'result';

export default function VoiceInput({
   disabled = false,
   style,
   iconSize = 20,
   iconColor = "black"
}: VoiceInputProps) {
    const { user } = useContext(AuthContext);
    const { refreshCartCount } = useCart();
    const router = useRouter();
    const { tVoice, tCommon } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [recognizedText, setRecognizedText] = useState('');
    const [resultMessage, setResultMessage] = useState('');
    const [pulseAnim] = useState(new Animated.Value(1));
    const [alertVisible, setAlertVisible] = useState(false);

    useEffect(() => {
        return () => {
            VoiceInputService.cleanup();
        };
    }, []);

    useEffect(() => {
        if (voiceState === 'listening') {
            startPulseAnimation();
        } else {
            stopPulseAnimation();
        }
    }, [voiceState]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const stopPulseAnimation = () => {
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
    };

    const openDeviceSettings = async () => {
        try {
            if (Platform.OS === 'android') {
                await Linking.openSettings();
            } else {
                await Linking.openURL('app-settings:');
            }
        } catch (error) {
            await Linking.openSettings();
        }
    };

    const handleVoicePress = async () => {
        if (disabled) return;

        // Platform-specific permission handling
        if (Platform.OS === 'android') {
            const hasPermission = await VoiceInputService.checkPermissions();
            if (!hasPermission) {
                setAlertVisible(true);
                return;
            }
        }

        // iOS: Skip permission check - iOS will show native prompt when Voice.start() is called

        setIsVisible(true);
        setVoiceState('idle');
        setRecognizedText('');
        setResultMessage('');
    };

    const startListening = async () => {
        try {
            setVoiceState('listening');
            await VoiceInputService.startListening();

            // Auto-stop after 8 seconds
            setTimeout(async () => {
                if (voiceState === 'listening') {
                    await stopListening();
                }
            }, 8000);

        } catch (error: any) {
            console.log('Voice start error:', error);
            setVoiceState('idle');

            if (Platform.OS === 'ios' &&
                (error.message?.includes('permission') ||
                    error.message?.includes('denied') ||
                    error.message?.includes('not granted'))) {
                setAlertVisible(true);
            } else {
                // Android or other iOS errors: Show generic error
                setResultMessage(tVoice('voiceNotAvailable'));
                setVoiceState('result');
                autoCloseModal();
            }
        }
    };

    const stopListening = async () => {
        try {
            const text = await VoiceInputService.stopListening();
            setRecognizedText(text);

            if (text.trim()) {
                setVoiceState('processing');
                await processCommand(text);
            } else {
                setResultMessage(tVoice('didntHear'));
                setVoiceState('result');
            }
        } catch (error) {
            setResultMessage(tVoice('didntUnderstand'));
            setVoiceState('result');
            autoCloseModal();
        }
    };

    const processCommand = async (text: string) => {
        try {
            const customerType = user?.role as 'individual' | 'business';
            const result = await VoiceInputService.processVoiceCommand(text, customerType);

            setResultMessage(result.message);
            setVoiceState('result');

            if (result.success) {
                if (result.data?.action === 'navigate_to_checkout') {
                    setTimeout(() => {
                        closeModal();
                        router.push('/(auth)/customer/checkout');
                    }, 2000);
                } else if (result.data?.products) {
                    setTimeout(() => {
                        closeModal();
                        router.push({
                            pathname: '/(auth)/customer/products',
                            params: { searchTerm: result.data.searchTerm || '' }
                        });
                    }, 2000);
                } else {
                    await refreshCartCount();
                    autoCloseModal();
                }
            } else {
                if (result.message.includes("didn't understand") ||
                    result.message.includes("Try commands like")) {
                    // Command not recognized - keep modal open for retry
                } else {
                    autoCloseModal();
                }
            }

        } catch (error) {
            setResultMessage(tVoice('errorProcessing'));
            setVoiceState('result');
            autoCloseModal();
        }
    };

    const autoCloseModal = () => {
        setTimeout(() => {
            closeModal();
        }, 3000);
    };

    const closeModal = () => {
        setIsVisible(false);
        setVoiceState('idle');
        setRecognizedText('');
        setResultMessage('');
        VoiceInputService.stopListening().catch(console.error);
    };

    const retryListening = async () => {
        setRecognizedText('');
        setResultMessage('');
        await startListening();
    };

    if (!user || (user.role !== 'individual' && user.role !== 'business')) {
        return null;
    }

    const renderModalContent = () => {
        switch (voiceState) {
            case 'listening':
                return (
                    <View className="items-center">
                        <Animated.View
                            className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6"
                            style={{ transform: [{ scale: pulseAnim }] }}
                        >
                            <Ionicons name="mic" size={40} color="#22c55e" />
                        </Animated.View>

                        <Text className="text-lg font-semibold text-center mb-2">
                            {tVoice('listening')}
                        </Text>
                        <Text className="text-sm text-gray-600 text-center mb-6">
                            {tVoice('sayYourCommand')}
                        </Text>

                        <TouchableOpacity
                            onPress={stopListening}
                            className="bg-red-500 px-9 py-3 rounded-lg"
                        >
                            <Text className="text-white font-medium">{tVoice('stopListening')}</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'processing':
                return (
                    <View className="items-center">
                        <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-6">
                            <ActivityIndicator size="large" color="#3b82f6" />
                        </View>

                        <Text className="text-lg font-semibold text-center mb-2">
                            {tVoice('processing')}
                        </Text>
                        {recognizedText && (
                            <Text className="text-sm text-gray-600 text-center italic">
                                &#34;{recognizedText}&#34;
                            </Text>
                        )}
                    </View>
                );

            case 'result':
                return (
                    <View className="items-center">
                        <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
                            <Ionicons name={recognizedText ? 'checkmark-circle' : 'close-circle'} size={40} color="#6b7280" />
                        </View>

                        {recognizedText && (
                            <View className="mb-4">
                                <Text className="text-sm text-gray-500 text-center mb-1">
                                    {tVoice('youSaid')}
                                </Text>
                                <Text className="text-base italic text-gray-700 text-center">
                                    &#34;{recognizedText}&#34;
                                </Text>
                            </View>
                        )}

                        <Text className="text-base text-center mb-6 leading-6">
                            {resultMessage}
                        </Text>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={retryListening}
                                className="bg-background p-3 rounded-lg flex-1"
                            >
                                <Text className="text-black font-medium text-center">{tVoice('tryAgain')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={closeModal}
                                className="bg-gray-500 p-3 rounded-lg flex-1"
                            >
                                <Text className="text-white font-medium text-center">{tVoice('close')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            default:
                return (
                    <View className="items-center">
                        <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
                            <Ionicons name="mic" size={40} color="#6b7280" />
                        </View>

                        <Text className="text-lg font-semibold text-center mb-2">
                            {tVoice('voiceCommand')}
                        </Text>
                        <Text className="text-sm text-gray-600 text-center mb-6">
                            {tVoice('whatToDo')}
                        </Text>

                        <View className="mb-6 p-3 bg-blue-50 rounded-lg w-full">
                            <Text className="font-semibold text-xs text-blue-700 text-center">{tVoice('tryTheseCommands')}</Text>
                            <Text className="text-xs text-blue-700 text-center">
                                {'\n'}&#34;{tVoice('searchForTomatoes')}&#34;
                                {'\n'}&#34;{tVoice('addToCart')}&#34;
                                {'\n'}&#34;{tVoice('checkoutItems')}&#34;
                            </Text>
                        </View>

                        <View className="flex-row gap-3 items-center">
                            <TouchableOpacity
                                onPress={startListening}
                                className="bg-background p-3 rounded-lg flex-1"
                            >
                                <Text className="text-black font-medium text-center">
                                    {tVoice('startListening')}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={closeModal}
                                className="bg-gray-500 p-3 rounded-lg flex-1"
                            >
                                <Text className="text-white font-medium text-center">
                                    {tVoice('close')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
        }
    };

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
                    color={disabled ? "#9ca3af" : iconColor}
                />
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View className="flex-1 bg-black/75 justify-center items-center px-6">
                    <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        {renderModalContent()}
                    </View>
                </View>
            </Modal>

            <CustomAlert
                visible={alertVisible}
                type="warning"
                title={tVoice('microphonePermission')}
                message={tVoice('enableMicrophone')}
                buttons={[
                    {
                        text: tCommon('cancel'),
                        onPress: () => setAlertVisible(false),
                        style: 'cancel'
                    },
                    {
                        text: tCommon('setings'),
                        onPress: () => {
                            setAlertVisible(false);
                            openDeviceSettings();
                        },
                        style: 'default'
                    }
                ]}
                onClose={() => setAlertVisible(false)}
            />
        </>
    );
}