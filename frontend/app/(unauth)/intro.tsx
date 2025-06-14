import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function IntroScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 justify-center items-center bg-white px-6">
            <Text className="text-3xl font-bold mb-8 text-green-700">Welcome to FarmLink 👋</Text>

            <TouchableOpacity
                onPress={() => router.push('/login')}
                className="bg-green-600 px-6 py-3 rounded-2xl mb-4 w-full items-center"
            >
                <Text className="text-white font-semibold text-lg">Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push('/register')}
                className="border border-green-600 px-6 py-3 rounded-2xl w-full items-center"
            >
                <Text className="text-green-600 font-semibold text-lg">Register</Text>
            </TouchableOpacity>
        </View>
    );
}
