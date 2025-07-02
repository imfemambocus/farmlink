import { useState, useContext } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView, Dimensions
} from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/ui/Header';
import CustomAlert from '@/components/ui/CustomAlert';
import { useTranslation } from '@/context/LanguageContext';

interface FormErrors {
    [key: string]: string;
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const { login } = useContext(AuthContext);
    const router = useRouter();
    const { t, tAuth, tValidation, tCommon, getErrorMessage } = useTranslation();

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!email.trim()) {
            newErrors.email = tValidation('emailRequired');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = tValidation('validEmail');
        }

        if (!password.trim()) {
            newErrors.password = tValidation('passwordRequired');
        } else if (password.length < 6) {
            newErrors.password = tValidation('passwordMinLength');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            showAlert(
                'error',
                tAuth('loginFailed'),
                getErrorMessage(err),
                [{
                    text: tCommon('ok'),
                    style: 'default',
                    onPress: hideAlert
                }]
            );
        } finally {
            setLoading(false);
        }
    };

    const clearError = (field: string) => {
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    return (
        <View className="flex-1 bg-surface">
            <View className="absolute top-0 left-0 right-0 z-10">
                <Header
                    title={tAuth('welcomeBack')}
                    showBackButton={true}
                />
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: Dimensions.get('window').height * 0.2 }}
            >
                <View className="flex-1 justify-center px-6 pt-8">
                    <View className="mb-8">
                        <Text className="text-lg text-gray-600 font-sans">
                            {tAuth('signInToAccount')}
                        </Text>
                    </View>

                    <View className="mb-8">
                        <View className="mb-5">
                            <Text className="text-base font-medium mb-2 text-black">
                                {tAuth('email')}
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className={`
                                    border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black leading-[1.2]
                                    ${errors.email ? 'border-red-500 text-red-500' : ''}
                                `}
                                    style={{
                                        height: 48,
                                        paddingVertical: 0,
                                        textAlignVertical: 'center'
                                    }}
                                    placeholder={tAuth('enterEmail')}
                                    placeholderTextColor="#666666"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        clearError('email');
                                    }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <View className="absolute right-4" style={{ top: 14 }}>
                                    <Ionicons
                                        name="mail-outline"
                                        size={20}
                                        color={errors.email ? '#EF4444' : '#000000'}
                                    />
                                </View>
                            </View>
                            {errors.email && (
                                <Text className="text-error text-sm mt-1 ml-1 font-sans">
                                    {errors.email}
                                </Text>
                            )}
                        </View>

                        <View className="mb-6">
                            <Text className="text-base font-medium mb-2 text-black">
                                {tAuth('password')}
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className={`
                                    border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black leading-[1.2]
                                    ${errors.password ? 'border-red-500 text-red-500' : ''}
                                `}
                                    style={{
                                        height: 48,
                                        paddingVertical: 0,
                                        textAlignVertical: 'center'
                                    }}
                                    placeholder={tAuth('enterPassword')}
                                    placeholderTextColor="#666666"
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        clearError('password');
                                    }}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity
                                    className="absolute right-4"
                                    style={{ top: 14 }}
                                    onPress={() => setShowPassword(!showPassword)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={errors.password ? '#EF4444' : '#000000'}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && (
                                <Text className="text-error text-sm mt-1 ml-1 font-sans">
                                    {errors.password}
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity
                            className={`
                            rounded-xl py-4 px-6 flex-row justify-center items-center
                            ${loading ? 'bg-gray-400' : 'bg-black'}
                        `}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text className="text-white text-lg font-medium ml-2">
                                        {tAuth('signingIn')}
                                    </Text>
                                </>
                            ) : (
                                <Text className="text-white text-lg font-semibold">
                                    {t('intro.login')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View className="items-center mb-8">
                        <TouchableOpacity
                            onPress={() => router.push('/register')}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base font-sans text-gray-600">
                                {tAuth('dontHaveAccount')}{' '}
                                <Text className="text-success font-medium">
                                    {t('intro.register')}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="items-center pb-8">
                        <Text className="text-xs text-gray-400 font-sans">
                            {t('intro.copyright')}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}