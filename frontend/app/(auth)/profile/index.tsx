import { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import { useTranslation } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/ui/Header';
import LanguageSelector from '@/components/ui/LanguageSelector';

interface FormErrors {
    [key: string]: string;
}

export default function ProfileEditScreen() {
    const { user, updateProfile } = useContext(AuthContext);
    const { t, tAuth, tValidation, tProfile, tCommon } = useTranslation();

    // Initialize formData with a function to get initial values
    const getInitialFormData = () => {
        if (!user) return {};

        if (user.role === 'farmer' && user.farmer_profile) {
            return {
                first_name: user.farmer_profile.first_name || '',
                last_name: user.farmer_profile.last_name || '',
                phone_number: user.farmer_profile.phone_number || '',
                district: user.farmer_profile.district || '',
            };
        } else if (user.role === 'individual' && user.individual_profile) {
            return {
                first_name: user.individual_profile.first_name || '',
                last_name: user.individual_profile.last_name || '',
                date_of_birth: user.individual_profile.date_of_birth || '',
                phone_number: user.individual_profile.phone_number || '',
                street: user.individual_profile.street || '',
                city_town: user.individual_profile.city_town || '',
                post_code: user.individual_profile.post_code || '',
            };
        } else if (user.role === 'business' && user.business_profile) {
            return {
                business_name: user.business_profile.business_name || '',
                contact_name: user.business_profile.contact_name || '',
                phone_number: user.business_profile.phone_number || '',
                street: user.business_profile.street || '',
                city_town: user.business_profile.city_town || '',
                post_code: user.business_profile.post_code || '',
            };
        }
        return {};
    };

    const [formData, setFormData] = useState<any>(getInitialFormData);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData(getInitialFormData());
        }
    }, [user]);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!user) return false;

        if (user.role === 'farmer' || user.role === 'individual') {
            if (!formData.first_name?.trim()) {
                newErrors.first_name = tValidation('firstNameRequired');
            }
            if (!formData.last_name?.trim()) {
                newErrors.last_name = tValidation('lastNameRequired');
            }
        }

        if (!formData.phone_number?.trim()) {
            newErrors.phone_number = tValidation('phoneRequired');
        } else if (!/^\d{7,15}$/.test(formData.phone_number.replace(/\s+/g, ''))) {
            newErrors.phone_number = tValidation('validPhone');
        }

        // Role-specific validations
        if (user.role === 'farmer') {
            if (!formData.district?.trim()) {
                newErrors.district = tValidation('districtRequired');
            }
        } else if (user.role === 'individual') {
            if (!formData.date_of_birth?.trim()) {
                newErrors.date_of_birth = tValidation('dobRequired');
            }
            if (!formData.street?.trim()) {
                newErrors.street = tValidation('streetRequired');
            }
            if (!formData.city_town?.trim()) {
                newErrors.city_town = tValidation('cityRequired');
            }
            if (!formData.post_code?.trim()) {
                newErrors.post_code = tValidation('postCodeRequired');
            }
        } else if (user.role === 'business') {
            if (!formData.business_name?.trim()) {
                newErrors.business_name = tValidation('businessNameRequired');
            }
            if (!formData.contact_name?.trim()) {
                newErrors.contact_name = tValidation('contactNameRequired');
            }
            if (!formData.street?.trim()) {
                newErrors.street = tValidation('streetRequired');
            }
            if (!formData.city_town?.trim()) {
                newErrors.city_town = tValidation('cityRequired');
            }
            if (!formData.post_code?.trim()) {
                newErrors.post_code = tValidation('postCodeRequired');
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            await updateProfile(formData);
            Alert.alert(
                tCommon('success'),
                tProfile('profileUpdated'),
                [{ text: tCommon('ok'), style: 'default' }]
            );
        } catch (error: any) {
            Alert.alert(
                tCommon('error'),
                error.message || tProfile('failedToUpdate'),
                [{ text: tCommon('ok'), style: 'default' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    const renderInput = (
        field: string,
        label: string,
        placeholder?: string,
        keyboardType: 'default' | 'numeric' | 'email-address' = 'default',
        icon?: string
    ) => (
        <View className="mb-5">
            <Text className="text-base font-medium mb-2 text-black">
                {label}
            </Text>
            <View className="relative">
                <TextInput
                    className={`
            border rounded-xl px-4 text-base bg-surface border-black text-black leading-[1.2]
            ${errors[field] ? 'border-red-500 text-red-500' : ''}
          `}
                    style={{
                        height: 48,
                        paddingVertical: 0,
                        textAlignVertical: 'center'
                    }}
                    value={formData[field] || ''}
                    onChangeText={(value) => updateFormData(field, value)}
                    placeholder={placeholder || label}
                    placeholderTextColor="#666666"
                    keyboardType={keyboardType}
                />
                {icon && (
                    <View className="absolute right-4" style={{ top: 14 }}>
                        <Ionicons
                            name={icon as any}
                            size={20}
                            color={errors[field] ? '#EF4444' : '#000000'}
                        />
                    </View>
                )}
            </View>
            {errors[field] && (
                <Text className="text-error text-sm mt-1 ml-1 font-sans">
                    {errors[field]}
                </Text>
            )}
        </View>
    );

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'farmer': return 'leaf-outline';
            case 'individual': return 'person-outline';
            case 'business': return 'business-outline';
            default: return 'person-outline';
        }
    };

    if (!user) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <View className="flex-1 justify-center items-center">
                    <Text className="text-lg font-sans">{tProfile('noUserData')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={tProfile('profileTitle')}
                showBackButton={true}
                showLogoutButton={true}
            />

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                <View className="pb-6">
                    <View className="mb-4 pb-4 flex-row justify-between items-center">
                        <View className="flex-row items-center">
                            <View className="bg-black rounded-full p-1.5 mr-2">
                                <Ionicons
                                    name={getRoleIcon(user.role) as any}
                                    size={12}
                                    color="#FFFFFF"
                                />
                            </View>
                            <Text className="text-sm text-black font-medium">
                                {t(`auth.${user.role}`)} {tProfile('account')}
                            </Text>
                        </View>
                        <Text className="text-base text-gray-900 font-sans">
                            {user.role === 'business'
                                ? user.business_profile?.business_name
                                : user.role === 'farmer'
                                    ? user.farmer_profile?.first_name
                                    : user.individual_profile?.first_name
                            }
                        </Text>
                    </View>

                    <View className="mb-6">
                        <LanguageSelector
                            style="button"
                            showLabel={true}
                        />
                    </View>

                    {user.role === 'farmer' && (
                        <>
                            {renderInput('first_name', tAuth('firstName'), tAuth('enterFirstName'), 'default', 'person-outline')}
                            {renderInput('last_name', tAuth('lastName'), tAuth('enterLastName'), 'default', 'id-card-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'numeric', 'call-outline')}
                            {renderInput('district', tAuth('district'), tAuth('enterDistrict'), 'default', 'location-outline')}
                        </>
                    )}

                    {user.role === 'individual' && (
                        <>
                            {renderInput('first_name', tAuth('firstName'), tAuth('enterFirstName'), 'default', 'person-outline')}
                            {renderInput('last_name', tAuth('lastName'), tAuth('enterLastName'), 'default', 'id-card-outline')}
                            {renderInput('date_of_birth', tAuth('dateOfBirth'), tAuth('enterDateOfBirth'), 'default', 'calendar-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'numeric', 'call-outline')}
                            {renderInput('street', tAuth('streetAddress'), tAuth('enterStreetAddress'), 'default', 'home-outline')}
                            {renderInput('city_town', tAuth('cityTown'), tAuth('enterCityTown'), 'default', 'location-outline')}
                            {renderInput('post_code', tAuth('postCode'), tAuth('enterPostCode'), 'default', 'mail-outline')}
                        </>
                    )}

                    {user.role === 'business' && (
                        <>
                            {renderInput('business_name', tAuth('businessName'), tAuth('enterBusinessName'), 'default', 'business-outline')}
                            {renderInput('contact_name', tAuth('contactName'), tAuth('enterContactName'), 'default', 'person-outline')}
                            {renderInput('phone_number', tAuth('phoneNumber'), tAuth('enterPhoneNumber'), 'numeric', 'call-outline')}
                            {renderInput('street', tAuth('streetAddress'), tAuth('enterBusinessAddress'), 'default', 'home-outline')}
                            {renderInput('city_town', tAuth('cityTown'), tAuth('enterCityTown'), 'default', 'location-outline')}
                            {renderInput('post_code', tAuth('postCode'), tAuth('enterPostCode'), 'default', 'mail-outline')}
                        </>
                    )}

                    <TouchableOpacity
                        className={`
              rounded-xl py-4 px-6 mt-6 flex-row justify-center items-center
              ${loading ? 'bg-gray-400' : 'bg-black'}
            `}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text className="text-white text-lg font-medium ml-2">
                                    {tProfile('updating')}
                                </Text>
                            </>
                        ) : (
                            <Text className="text-white text-lg font-semibold">
                                {tProfile('updateProfile')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}