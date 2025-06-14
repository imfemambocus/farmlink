import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import api from '@/services/api';

const roles = [
    { label: 'Farmer', value: 'farmer' },
    { label: 'Individual', value: 'individual' },
    { label: 'Business', value: 'business' },
];

export default function Register() {
    const router = useRouter();

    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'individual',
    });

    const handleChange = (field: string, value: string) => {
        setForm({ ...form, [field]: value });
    };

    const handleRegister = async () => {
        try {
            await api.post('/auth/register', form);
            Alert.alert('Success', 'Account created. Please log in.');
            router.replace('/auth/login');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Registration failed');
        }
    };

    return (
        <View className="flex-1 justify-center px-4 bg-white">
            <Text className="text-3xl font-bold text-center mb-6">Register</Text>

            <TextInput
                placeholder="Full Name"
                value={form.full_name}
                onChangeText={(text) => handleChange('full_name', text)}
                className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                placeholderTextColor="#999"
            />

            <TextInput
                placeholder="Email"
                value={form.email}
                onChangeText={(text) => handleChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
                placeholderTextColor="#999"
            />

            <TextInput
                placeholder="Password"
                value={form.password}
                onChangeText={(text) => handleChange('password', text)}
                secureTextEntry
                className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                placeholderTextColor="#999"
            />

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

            <Button title="Register" onPress={handleRegister} />

            <TouchableOpacity
                onPress={() => router.replace('/auth/login')}
                className="mt-4"
            >
                <Text className="text-center text-blue-500">Already have an account? Log in</Text>
            </TouchableOpacity>
        </View>
    );
}
