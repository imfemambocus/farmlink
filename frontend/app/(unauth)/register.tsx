import { useState } from 'react';
import { View, Text, TextInput, Button, Alert, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import api from '@/services/api';

const roles = [
    { label: 'Farmer', value: 'farmer' },
    { label: 'Individual', value: 'individual' },
    { label: 'Business', value: 'business' },
];

export default function Register() {
    const router = useRouter();

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
        try {
            const payload = buildPayload();
            await api.post('/auth/register', payload);
            Alert.alert('Success', 'Account created. Please log in.');
            router.replace('/login');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Registration failed');
        }
    };

    return (
        <ScrollView className="flex-1 bg-white px-4 py-8">
            <Text className="text-3xl font-bold text-center mb-6">Register</Text>

            {/* Email */}
            <TextInput
                placeholder="Email"
                value={form.email}
                onChangeText={(text) => handleChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                placeholderTextColor="#999"
            />

            {/* Password */}
            <TextInput
                placeholder="Password"
                value={form.password}
                onChangeText={(text) => handleChange('password', text)}
                secureTextEntry
                className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                placeholderTextColor="#999"
            />

            {/* Role selector */}
            <Text className="text-base font-semibold mb-2">Select Role:</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
                {roles.map((role) => (
                    <Pressable
                        key={role.value}
                        onPress={() => handleChange('role', role.value)}
                        className={`flex-row items-center px-4 py-2 rounded-full border ${
                            form.role === role.value ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
                        }`}
                    >
                        <View
                            className={`w-4 h-4 rounded-full mr-2 ${
                                form.role === role.value ? 'bg-blue-500' : 'bg-white border border-gray-400'
                            }`}
                        />
                        <Text className="text-sm">{role.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Conditionally render role-specific fields */}

            {form.role === 'farmer' && (
                <>
                    <TextInput
                        placeholder="First Name"
                        value={form.first_name}
                        onChangeText={(text) => handleChange('first_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Last Name"
                        value={form.last_name}
                        onChangeText={(text) => handleChange('last_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Phone Number"
                        value={form.phone_number}
                        onChangeText={(text) => handleChange('phone_number', text)}
                        keyboardType="phone-pad"
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="District"
                        value={form.district}
                        onChangeText={(text) => handleChange('district', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                        placeholderTextColor="#999"
                    />
                </>
            )}

            {form.role === 'individual' && (
                <>
                    <TextInput
                        placeholder="First Name"
                        value={form.first_name}
                        onChangeText={(text) => handleChange('first_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Last Name"
                        value={form.last_name}
                        onChangeText={(text) => handleChange('last_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Date of Birth (YYYY-MM-DD)"
                        value={form.date_of_birth}
                        onChangeText={(text) => handleChange('date_of_birth', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Phone Number"
                        value={form.phone_number}
                        onChangeText={(text) => handleChange('phone_number', text)}
                        keyboardType="phone-pad"
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Street"
                        value={form.street}
                        onChangeText={(text) => handleChange('street', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="City/Town"
                        value={form.city_town}
                        onChangeText={(text) => handleChange('city_town', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Post Code"
                        value={form.post_code}
                        onChangeText={(text) => handleChange('post_code', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                        placeholderTextColor="#999"
                    />
                </>
            )}

            {form.role === 'business' && (
                <>
                    <TextInput
                        placeholder="Business Name"
                        value={form.business_name}
                        onChangeText={(text) => handleChange('business_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Contact Name"
                        value={form.contact_name}
                        onChangeText={(text) => handleChange('contact_name', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Phone Number"
                        value={form.phone_number}
                        onChangeText={(text) => handleChange('phone_number', text)}
                        keyboardType="phone-pad"
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Street"
                        value={form.street}
                        onChangeText={(text) => handleChange('street', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="City/Town"
                        value={form.city_town}
                        onChangeText={(text) => handleChange('city_town', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Post Code"
                        value={form.post_code}
                        onChangeText={(text) => handleChange('post_code', text)}
                        className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                        placeholderTextColor="#999"
                    />
                </>
            )}

            <Button title="Register" onPress={handleRegister} />

            <TouchableOpacity onPress={() => router.push('/login')} className="mt-4">
                <Text className="text-center text-blue-500">Already have an account? Log in</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
