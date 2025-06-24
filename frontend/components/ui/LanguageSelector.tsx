import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    FlatList,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, Language } from '@/context/LanguageContext';

interface LanguageSelectorProps {
    style?: 'button' | 'minimal';
    showLabel?: boolean;
    containerStyle?: any;
}

interface LanguageOption {
    code: Language;
    name: string;
    nativeName: string;
    flag: string;
}

const languages: LanguageOption[] = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
    },
    {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
    },
];

const { height: screenHeight } = Dimensions.get('window');

export default function LanguageSelector({
     style = 'button',
     showLabel = true,
     containerStyle
 }: LanguageSelectorProps) {
    const { language, setLanguage, t } = useLanguage();
    const [modalVisible, setModalVisible] = useState(false);
    const slideAnim = React.useRef(new Animated.Value(screenHeight)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

    const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

    const openModal = () => {
        setModalVisible(true);
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
    };

    const closeModal = () => {
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
        ]).start(() => {
            setModalVisible(false);
        });
    };

    const handleLanguageSelect = async (langCode: Language) => {
        await setLanguage(langCode);
        closeModal();
    };

    const renderLanguageOption = ({ item }: { item: LanguageOption }) => (
        <TouchableOpacity
            onPress={() => handleLanguageSelect(item.code)}
            className={`p-4 rounded-2xl ${
                item.code === language ? 'bg-background' : 'bg-white'
            }`}
            activeOpacity={0.7}
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-3">{item.flag}</Text>
                    <View className="flex-1">
                        <Text className={`text-base font-medium ${
                            item.code === language ? 'text-black' : 'text-gray-700'
                        }`}>
                            {item.name}
                        </Text>
                        <Text className={`text-sm ${
                            item.code === language ? 'text-gray-600' : 'text-gray-500'
                        }`}>
                            {item.nativeName}
                        </Text>
                    </View>
                </View>
                {item.code === language && (
                    <Ionicons name="checkmark" size={20} color="#000000" />
                )}
            </View>
        </TouchableOpacity>
    );

    if (style === 'minimal') {
        return (
            <>
                <TouchableOpacity
                    onPress={openModal}
                    style={containerStyle}
                    className="flex-row items-center p-2"
                    activeOpacity={0.7}
                >
                    <Text className="text-lg mr-1">{currentLanguage.flag}</Text>
                    <Ionicons name="chevron-down" size={14} color="#666666" />
                </TouchableOpacity>

                <Modal
                    transparent
                    visible={modalVisible}
                    animationType="none"
                    onRequestClose={closeModal}
                >
                    <View className="flex-1">
                        <TouchableWithoutFeedback onPress={closeModal}>
                            <Animated.View
                                className="flex-1 bg-black"
                                style={{ opacity: opacityAnim }}
                            />
                        </TouchableWithoutFeedback>

                        <Animated.View
                            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
                            style={{
                                transform: [{ translateY: slideAnim }],
                                maxHeight: screenHeight * 0.6,
                            }}
                        >
                            <View className="p-4">
                                <View className="items-center mb-4">
                                    <View className="w-12 h-1 bg-gray-300 rounded-full" />
                                </View>

                                <Text className="text-lg font-semibold text-black text-center mb-4">
                                    {t('common.language')}
                                </Text>

                                <FlatList
                                    data={languages}
                                    renderItem={renderLanguageOption}
                                    keyExtractor={(item) => item.code}
                                    scrollEnabled={false}
                                />

                                <View className="mt-4">
                                    <TouchableOpacity
                                        onPress={closeModal}
                                        className="bg-gray-200 py-4 rounded-xl"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-center font-medium text-gray-700">
                                            {t('common.close')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="h-6" />
                        </Animated.View>
                    </View>
                </Modal>
            </>
        );
    }

    if (style === 'button') {
        return (
            <>
                <TouchableOpacity
                    onPress={openModal}
                    style={containerStyle}
                    className="flex-row items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3"
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center flex-1">
                        <Text className="text-lg mr-3">{currentLanguage.flag}</Text>
                        <View className="flex-1">
                            {showLabel && (
                                <Text className="text-xs text-gray-500 mb-1">
                                    {t('common.language')}
                                </Text>
                            )}
                            <Text className="text-base font-medium text-black">
                                {currentLanguage.nativeName}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#666666" />
                </TouchableOpacity>

                <Modal
                    transparent
                    visible={modalVisible}
                    animationType="none"
                    onRequestClose={closeModal}
                >
                    <View className="flex-1">
                        <TouchableWithoutFeedback onPress={closeModal}>
                            <Animated.View
                                className="flex-1 bg-black"
                                style={{ opacity: opacityAnim }}
                            />
                        </TouchableWithoutFeedback>

                        <Animated.View
                            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
                            style={{
                                transform: [{ translateY: slideAnim }],
                                maxHeight: screenHeight * 0.6,
                            }}
                        >
                            <View className="p-4">
                                <View className="items-center mb-4">
                                    <View className="w-12 h-1 bg-gray-300 rounded-full" />
                                </View>

                                <Text className="text-lg font-semibold text-black text-center mb-4">
                                    {t('common.language')}
                                </Text>

                                <FlatList
                                    data={languages}
                                    renderItem={renderLanguageOption}
                                    keyExtractor={(item) => item.code}
                                    scrollEnabled={false}
                                />

                                <View className="mt-4">
                                    <TouchableOpacity
                                        onPress={closeModal}
                                        className="bg-gray-200 py-4 rounded-xl"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-center font-medium text-gray-700">
                                            {t('common.close')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="h-6" />
                        </Animated.View>
                    </View>
                </Modal>
            </>
        );
    }

    return null;
}