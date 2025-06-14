import { useState, useContext } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const router = useRouter();

    const handleLogin = async () => {
        try {
            await login(email, password);
        } catch (err: any) {
            Alert.alert('Login Failed', err.response?.data?.detail || 'Invalid credentials');
        }
    };

    return (
        <View className="flex-1 justify-center px-4 bg-white">
            <Text className="text-2xl font-bold mb-4">Login</Text>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                className="border rounded-lg p-3 mb-4"
            />
            <TextInput
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                className="border rounded-lg p-3 mb-4"
            />
            <Button title="Login" onPress={handleLogin} />
            <Text className="text-center mt-4 text-blue-500" onPress={() => router.push('/register')}>
                Don&#39;t have an account? Register
            </Text>
        </View>
    );
}
