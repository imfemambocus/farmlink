import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertButton {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: AlertButton[];
    onClose?: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

const CustomAlert: React.FC<CustomAlertProps> = ({
                                                     visible,
                                                     type,
                                                     title,
                                                     message,
                                                     buttons,
                                                     onClose,
                                                 }) => {
    const slideAnim = useRef(new Animated.Value(screenHeight)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0.5,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: screenHeight,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'warning':
                return 'warning';
            case 'info':
                return 'information-circle';
            default:
                return 'information-circle';
        }
    };

    const handleBackdropPress = () => {
        return;
    };

    const handleButtonPress = (button: AlertButton) => {
        if (button.style === 'cancel') {
            button.onPress();

            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: screenHeight,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            setTimeout(() => {
                if (onClose) {
                    onClose();
                }
            }, 250);
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: screenHeight,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            setTimeout(() => {
                if (onClose) {
                    onClose();
                }

                setTimeout(() => {
                    button.onPress();
                }, 100);
            }, 250);
        }
    };

    const getButtonStyle = (style?: string) => {
        switch (style) {
            case 'destructive':
                return 'text-red-600';
            case 'cancel':
                return 'text-black';
            default:
                return 'text-black';
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <View className="flex-1">
                <TouchableWithoutFeedback onPress={handleBackdropPress}>
                    <Animated.View
                        className="flex-1 bg-black"
                        style={{
                            opacity: opacityAnim,
                        }}
                    />
                </TouchableWithoutFeedback>

                <Animated.View
                    className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
                    style={{
                        transform: [{ translateY: slideAnim }],
                        minHeight: 200,
                    }}
                >
                    <View className="p-6 pb-8">
                        <View className="items-center mb-4">
                            <View className="w-16 h-16 bg-background rounded-full items-center justify-center">
                                <Ionicons
                                    name={getIcon()}
                                    size={32}
                                    color="#000000"
                                />
                            </View>
                        </View>

                        <Text className="text-xl font-semibold text-black text-center mb-3">
                            {title.toLowerCase()}
                        </Text>

                        <Text className="text-base text-gray-600 text-center mb-6 leading-6">
                            {message.toLowerCase()}
                        </Text>

                        <View className={`gap-3 ${buttons.length > 1 ? 'flex-row' : ''}`}>
                            {buttons.map((button, index) => (
                                <TouchableOpacity
                                    key={index}
                                    className={`py-4 px-6 rounded-xl bg-background ${
                                        buttons.length > 1 ? 'flex-1' : ''
                                    }`}
                                    onPress={() => handleButtonPress(button)}
                                    activeOpacity={0.7}
                                >
                                    <Text className={`text-center font-medium text-base ${getButtonStyle(button.style)}`}>
                                        {button.text.toLowerCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View className="h-6" />
                </Animated.View>
            </View>
        </Modal>
    );
};

export default CustomAlert;