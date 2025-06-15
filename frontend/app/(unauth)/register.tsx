import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Alert,
    TouchableOpacity,
    Pressable,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/Header';
import api from '@/services/api';

const roles = [
    { label: 'Farmer', value: 'farmer' },
    { label: 'Individual', value: 'individual' },
    { label: 'Business', value: 'business' },
];

interface FormErrors {
    [key: string]: string;
}

export default function Register() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [showPassword, setShowPassword] = useState(false);

    // Use separate state for form fields, default empty strings
    const [form, setForm] = useState({
        email: '',
        password: '',
        role: 'individual',

        // Farmer fields
        first_name: '',
        last_name: '',
        phone_number: '',
        district: '',

        // Individual fields
        date_of_birth: '',
        street: '',
        city_town: '',
        post_code: '',

        // Business fields
        business_name: '',
        contact_name: '',
    });

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        // Email validation
        if (!form.email.trim()) {
            newErrors.email = 'email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = 'please enter a valid email address';
        }

        // Password validation
        if (!form.password.trim()) {
            newErrors.password = 'password is required';
        } else if (form.password.length < 6) {
            newErrors.password = 'password must be at least 6 characters';
        }

        // Role-specific validations
        if (form.role === 'farmer') {
            if (!form.first_name.trim()) newErrors.first_name = 'first name is required';
            if (!form.last_name.trim()) newErrors.last_name = 'last name is required';
            if (!form.phone_number.trim()) {
                newErrors.phone_number = 'phone number is required';
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = 'please enter a valid phone number';
            }
            if (!form.district.trim()) newErrors.district = 'district is required';
        } else if (form.role === 'individual') {
            if (!form.first_name.trim()) newErrors.first_name = 'first name is required';
            if (!form.last_name.trim()) newErrors.last_name = 'last name is required';
            if (!form.date_of_birth.trim()) newErrors.date_of_birth = 'date of birth is required';
            if (!form.phone_number.trim()) {
                newErrors.phone_number = 'phone number is required';
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = 'please enter a valid phone number';
            }
            if (!form.street.trim()) newErrors.street = 'street address is required';
            if (!form.city_town.trim()) newErrors.city_town = 'city/town is required';
            if (!form.post_code.trim()) newErrors.post_code = 'post code is required';
        } else if (form.role === 'business') {
            if (!form.business_name.trim()) newErrors.business_name = 'business name is required';
            if (!form.contact_name.trim()) newErrors.contact_name = 'contact name is required';
            if (!form.phone_number.trim()) {
                newErrors.phone_number = 'phone number is required';
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = 'please enter a valid phone number';
            }
            if (!form.street.trim()) newErrors.street = 'street address is required';
            if (!form.city_town.trim()) newErrors.city_town = 'city/town is required';
            if (!form.post_code.trim()) newErrors.post_code = 'post code is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Build payload dynamically based on role
    const buildPayload = () => {
        const base = {
            email: form.email,
            password: form.password,
            role: form.role,
        };

        if (form.role === 'farmer') {
            return {
                ...base,
                first_name: form.first_name,
                last_name: form.last_name,
                phone_number: form.phone_number,
                district: form.district,
            };
        } else if (form.role === 'individual') {
            return {
                ...base,
                first_name: form.first_name,
                last_name: form.last_name,
                date_of_birth: form.date_of_birth,
                phone_number: form.phone_number,
                street: form.street,
                city_town: form.city_town,
                post_code: form.post_code,
            };
        } else if (form.role === 'business') {
            return {
                ...base,
                business_name: form.business_name,
                contact_name: form.contact_name,
                phone_number: form.phone_number,
                street: form.street,
                city_town: form.city_town,
                post_code: form.post_code,
            };
        }
    };

    const handleRegister = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const payload = buildPayload();
            await api.post('/auth/register', payload);
            Alert.alert(
                'success',
                'account created successfully! please log in.',
                [{ text: 'ok', style: 'default' }]
            );
            router.replace('/login');
        } catch (err: any) {
            Alert.alert(
                'registration failed',
                err.response?.data?.detail || 'registration failed',
                [{ text: 'ok', style: 'default' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (
        field: string,
        label: string,
        placeholder?: string,
        keyboardType: 'default' | 'numeric' | 'email-address' | 'phone-pad' = 'default',
        icon?: string,
        secureTextEntry?: boolean
    ) => (
        <View className="mb-5">
            <Text className="text-base font-medium mb-2 text-black">
                {label}
            </Text>
            <View className="relative">
                <TextInput
                    className={`
                        border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black
                        ${errors[field] ? 'border-red-500 text-red-500' : ''}
                    `}
                    style={{
                        height: 48,
                        paddingVertical: 0,
                        textAlignVertical: 'center'
                    }}
                    value={form[field as keyof typeof form] || ''}
                    onChangeText={(value) => handleChange(field, value)}
                    placeholder={placeholder || label}
                    placeholderTextColor="#666666"
                    keyboardType={keyboardType}
                    secureTextEntry={secureTextEntry && !showPassword}
                    autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
                    autoCorrect={false}
                />
                {secureTextEntry ? (
                    <TouchableOpacity
                        className="absolute right-4"
                        style={{ top: 14 }}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color={errors[field] ? '#EF4444' : '#000000'}
                        />
                    </TouchableOpacity>
                ) : icon ? (
                    <View className="absolute right-4" style={{ top: 14 }}>
                        <Ionicons
                            name={icon as any}
                            size={20}
                            color={errors[field] ? '#EF4444' : '#000000'}
                        />
                    </View>
                ) : null}
            </View>
            {errors[field] && (
                <Text className="text-error text-sm mt-1 ml-1 font-sans">
                    {errors[field]}
                </Text>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="create account"
                showBackButton={true}
                showLogoutButton={false}
            />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="px-6 pt-6 pb-8">
                    {/* Form Header */}
                    <View className="mb-8">
                        <Text className="text-lg text-gray-600 font-sans">
                            join the farmlink community
                        </Text>
                    </View>

                    {/* Basic Fields */}
                    {renderInput('email', 'email', 'enter your email', 'email-address', 'mail-outline')}
                    {renderInput('password', 'password', 'enter your password', 'default', undefined, true)}

                    {/* Role Selector */}
                    <View className="mb-6">
                        <Text className="text-base font-medium mb-3 text-black">
                            account type
                        </Text>
                        <View className="flex-row flex-wrap gap-3">
                            {roles.map((role) => (
                                <Pressable
                                    key={role.value}
                                    onPress={() => handleChange('role', role.value)}
                                    className={`flex-row items-center px-4 py-3 rounded-xl border-2 ${
                                        form.role === role.value
                                            ? 'border-success bg-light-100'
                                            : 'border-gray-300 bg-surface'
                                    }`}
                                    style={{ minWidth: 100 }}
                                >
                                    <View
                                        className={`w-4 h-4 rounded-full mr-3 ${
                                            form.role === role.value
                                                ? 'bg-success'
                                                : 'bg-white border-2 border-gray-400'
                                        }`}
                                    />
                                    <Text className={`text-sm font-medium ${
                                        form.role === role.value ? 'text-success' : 'text-black'
                                    }`}>
                                        {role.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Role-specific Fields */}
                    {form.role === 'farmer' && (
                        <>
                            {renderInput('first_name', 'first name', 'enter your first name', 'default', 'person-outline')}
                            {renderInput('last_name', 'last name', 'enter your last name', 'default', 'id-card-outline')}
                            {renderInput('phone_number', 'phone number', '+1234567890', 'phone-pad', 'call-outline')}
                            {renderInput('district', 'district', 'enter your district', 'default', 'location-outline')}
                        </>
                    )}

                    {form.role === 'individual' && (
                        <>
                            {renderInput('first_name', 'first name', 'enter your first name', 'default', 'person-outline')}
                            {renderInput('last_name', 'last name', 'enter your last name', 'default', 'id-card-outline')}
                            {renderInput('date_of_birth', 'date of birth', 'yyyy-mm-dd', 'default', 'calendar-outline')}
                            {renderInput('phone_number', 'phone number', '+1234567890', 'phone-pad', 'call-outline')}
                            {renderInput('street', 'street address', 'enter your street address', 'default', 'home-outline')}
                            {renderInput('city_town', 'city/town', 'enter your city or town', 'default', 'location-outline')}
                            {renderInput('post_code', 'post code', 'enter your post code', 'default', 'mail-outline')}
                        </>
                    )}

                    {form.role === 'business' && (
                        <>
                            {renderInput('business_name', 'business name', 'enter your business name', 'default', 'business-outline')}
                            {renderInput('contact_name', 'contact name', 'enter contact person name', 'default', 'person-outline')}
                            {renderInput('phone_number', 'phone number', '+1234567890', 'phone-pad', 'call-outline')}
                            {renderInput('street', 'street address', 'enter business address', 'default', 'home-outline')}
                            {renderInput('city_town', 'city/town', 'enter city or town', 'default', 'location-outline')}
                            {renderInput('post_code', 'post code', 'enter post code', 'default', 'mail-outline')}
                        </>
                    )}

                    {/* Register Button */}
                    <TouchableOpacity
                        className={`
                            rounded-xl py-4 px-6 mt-6 mb-6 flex-row justify-center items-center
                            ${loading ? 'bg-gray-400' : 'bg-black'}
                        `}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text className="text-white text-lg font-medium ml-2">
                                    creating account...
                                </Text>
                            </>
                        ) : (
                            <Text className="text-white text-lg font-semibold">
                                create account
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <View className="items-center">
                        <TouchableOpacity
                            onPress={() => router.push('/login')}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base font-sans text-gray-600">
                                already have an account?{' '}
                                <Text className="text-success font-medium">
                                    log in
                                </Text>
                            </Text>
                        </TouchableOpacity>

                        <Text className="text-xs mt-4 text-gray-400 font-sans">
                            © IMFE Studio
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}