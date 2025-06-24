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
import Header from '@/components/ui/Header';
import api from '@/services/api';
import { useTranslation } from '@/context/LanguageContext';

interface FormErrors {
    [key: string]: string;
}

export default function Register() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [showPassword, setShowPassword] = useState(false);
    const { t, tAuth, tValidation, tCommon, getErrorMessage } = useTranslation();

    const roles = [
        { label: tAuth('farmer'), value: 'farmer' },
        { label: tAuth('individual'), value: 'individual' },
        { label: tAuth('business'), value: 'business' },
    ];

    const [form, setForm] = useState({
        email: '',
        password: '',
        role: 'individual',
        first_name: '',
        last_name: '',
        phone_number: '',
        district: '',
        date_of_birth: '',
        street: '',
        city_town: '',
        post_code: '',
        business_name: '',
        contact_name: '',
    });

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!form.email.trim()) {
            newErrors.email = tValidation('emailRequired');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = tValidation('validEmail');
        }

        if (!form.password.trim()) {
            newErrors.password = tValidation('passwordRequired');
        } else if (form.password.length < 6) {
            newErrors.password = tValidation('passwordMinLength');
        }

        if (form.role === 'farmer') {
            if (!form.first_name.trim()) newErrors.first_name = tValidation('firstNameRequired');
            if (!form.last_name.trim()) newErrors.last_name = tValidation('lastNameRequired');
            if (!form.phone_number.trim()) {
                newErrors.phone_number = tValidation('phoneRequired');
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = tValidation('validPhone');
            }
            if (!form.district.trim()) newErrors.district = tValidation('districtRequired');
        } else if (form.role === 'individual') {
            if (!form.first_name.trim()) newErrors.first_name = tValidation('firstNameRequired');
            if (!form.last_name.trim()) newErrors.last_name = tValidation('lastNameRequired');
            if (!form.date_of_birth.trim()) newErrors.date_of_birth = tValidation('dobRequired');
            if (!form.phone_number.trim()) {
                newErrors.phone_number = tValidation('phoneRequired');
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = tValidation('validPhone');
            }
            if (!form.street.trim()) newErrors.street = tValidation('streetRequired');
            if (!form.city_town.trim()) newErrors.city_town = tValidation('cityRequired');
            if (!form.post_code.trim()) newErrors.post_code = tValidation('postCodeRequired');
        } else if (form.role === 'business') {
            if (!form.business_name.trim()) newErrors.business_name = tValidation('businessNameRequired');
            if (!form.contact_name.trim()) newErrors.contact_name = tValidation('contactNameRequired');
            if (!form.phone_number.trim()) {
                newErrors.phone_number = tValidation('phoneRequired');
            } else if (!/^\d{7,15}$/.test(form.phone_number.replace(/\s+/g, ''))) {
                newErrors.phone_number = tValidation('validPhone');
            }
            if (!form.street.trim()) newErrors.street = tValidation('streetRequired');
            if (!form.city_town.trim()) newErrors.city_town = tValidation('cityRequired');
            if (!form.post_code.trim()) newErrors.post_code = tValidation('postCodeRequired');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

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
                tCommon('success'),
                tAuth('accountCreated'),
                [{ text: tCommon('ok'), style: 'default' }]
            );
            router.replace('/login');
        } catch (err: any) {
            Alert.alert(
                tAuth('registrationFailed'),
                getErrorMessage(err),
                [{ text: tCommon('ok'), style: 'default' }]
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
                        border rounded-xl px-4 pr-12 text-base bg-surface border-black text-black leading-[1.2]
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
                title={tAuth('createAccount')}
                showBackButton={true}
                showLogoutButton={false}
            />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="px-6 pt-6 pb-8">
                    <View className="mb-8">
                        <Text className="text-lg text-gray-600 font-sans">
                            {tAuth('joinCommunity')}
                        </Text>
                    </View>

                    {renderInput('email', tAuth('email'), tAuth('enterEmail'), 'email-address', 'mail-outline')}
                    {renderInput('password', tAuth('password'), tAuth('enterPassword'), 'default', undefined, true)}

                    <View className="mb-6">
                        <Text className="text-base font-medium mb-3 text-black">
                            {tAuth('accountType')}
                        </Text>
                        <View className="flex-row gap-2">
                            {roles.map((role) => (
                                <Pressable
                                    key={role.value}
                                    onPress={() => handleChange('role', role.value)}
                                    className={`flex-1 items-center py-3 px-2 rounded-xl ${
                                        form.role === role.value
                                            ? 'bg-background'
                                            : 'bg-gray-100'
                                    }`}
                                >
                                    <Text className={`text-sm font-medium ${
                                        form.role === role.value ? 'text-black' : 'text-gray-600'
                                    }`}>
                                        {role.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {form.role === 'farmer' && (
                        <>
                            {renderInput('first_name', tAuth('firstName'), tAuth('enterFirstName'), 'default', 'person-outline')}
                            {renderInput('last_name', tAuth('lastName'), tAuth('enterLastName'), 'default', 'id-card-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'phone-pad', 'call-outline')}
                            {renderInput('district', tAuth('district'), tAuth('enterDistrict'), 'default', 'location-outline')}
                        </>
                    )}

                    {form.role === 'individual' && (
                        <>
                            {renderInput('first_name', tAuth('firstName'), tAuth('enterFirstName'), 'default', 'person-outline')}
                            {renderInput('last_name', tAuth('lastName'), tAuth('enterLastName'), 'default', 'id-card-outline')}
                            {renderInput('date_of_birth', tAuth('dateOfBirth'), tAuth('enterDateOfBirth'), 'default', 'calendar-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'phone-pad', 'call-outline')}
                            {renderInput('street', tAuth('streetAddress'), tAuth('enterStreetAddress'), 'default', 'home-outline')}
                            {renderInput('city_town', tAuth('cityTown'), tAuth('enterCityTown'), 'default', 'location-outline')}
                            {renderInput('post_code', tAuth('postCode'), tAuth('enterPostCode'), 'default', 'mail-outline')}
                        </>
                    )}

                    {form.role === 'business' && (
                        <>
                            {renderInput('business_name', tAuth('businessName'), tAuth('enterBusinessName'), 'default', 'business-outline')}
                            {renderInput('contact_name', tAuth('contactName'), tAuth('enterContactName'), 'default', 'person-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'phone-pad', 'call-outline')}
                            {renderInput('street', tAuth('streetAddress'), tAuth('enterBusinessAddress'), 'default', 'home-outline')}
                            {renderInput('city_town', tAuth('cityTown'), tAuth('enterCityTown'), 'default', 'location-outline')}
                            {renderInput('post_code', tAuth('postCode'), tAuth('enterPostCode'), 'default', 'mail-outline')}
                        </>
                    )}

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
                                    {tAuth('creatingAccount')}
                                </Text>
                            </>
                        ) : (
                            <Text className="text-white text-lg font-semibold">
                                {tAuth('createAccount')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View className="items-center">
                        <TouchableOpacity
                            onPress={() => router.push('/login')}
                            activeOpacity={0.7}
                        >
                            <Text className="text-base font-sans text-gray-600">
                                {tAuth('alreadyHaveAccount')}{' '}
                                <Text className="text-success font-medium">
                                    {t('intro.login')}
                                </Text>
                            </Text>
                        </TouchableOpacity>

                        <Text className="text-xs mt-4 text-gray-400 font-sans">
                            {t('intro.copyright')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}