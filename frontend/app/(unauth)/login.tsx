import { useState, useContext } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    ScrollView
} from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/ui/Header';

interface FormErrors {
    [key: string]: string;
}

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useContext(AuthContext);
    const router = useRouter();

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        // Email validation
        if (!email.trim()) {
            newErrors.email = 'email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = 'please enter a valid email address';
        }

        // Password validation
        if (!password.trim()) {
            newErrors.password = 'password is required';
        } else if (password.length < 6) {
            newErrors.password = 'password must be at least 6 characters';
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
            Alert.alert(
                'login failed',
                err.response?.data?.detail || 'invalid credentials',
                [{ text: 'ok', style: 'default' }]
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
            <Header
                title="welcome back"
                showBackButton={true}
                showLogoutButton={false}
            />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="flex-1 justify-center px-6 pt-8">
                    {/* Form Header */}
                    <View className="mb-8">
                        <Text className="text-lg text-gray-600 font-sans">
                            sign in to your account
                        </Text>
                    </View>

                    {/* Form */}
                    <View className="mb-8">
                        {/* Email Input */}
                        <View className="mb-5">
                            <Text className="text-base font-medium mb-2 text-black">
                                email
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className={`
                                    border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black
                                    ${errors.email ? 'border-red-500 text-red-500' : ''}
                                `}
                                    style={{
                                        height: 48,
                                        paddingVertical: 0,
                                        textAlignVertical: 'center'
                                    }}
                                    placeholder="enter your email"
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

                        {/* Password Input */}
                        <View className="mb-6">
                            <Text className="text-base font-medium mb-2 text-black">
                                password
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className={`
                                    border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black
                                    ${errors.password ? 'border-red-500 text-red-500' : ''}
                                `}
                                    style={{
                                        height: 48,
                                        paddingVertical: 0,
                                        textAlignVertical: 'center'
                                    }}
                                    placeholder="enter your password"
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

                        {/* Login Button */}
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
                                        signing in...
                                    </Text>
                                </>
                            ) : (
                                <Text className="text-white text-lg font-semibold">
                                    log in
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Register Link */}
                    <View className="items-center mb-8">
                        <TouchableOpacity
                            onPress={() => router.push('/register')}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base font-sans text-gray-600">
                                don't have an account?{' '}
                                <Text className="text-success font-medium">
                                    register
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View className="items-center pb-8">
                        <Text className="text-xs text-gray-400 font-sans">
                            © IMFE Studio
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}