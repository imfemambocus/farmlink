import {View, Text, Button} from 'react-native';
import {useContext, useEffect} from "react";
import {AuthContext} from "@/context/AuthContext";
import {useRouter} from "expo-router";

export default function Profile() {
    const { user, logout } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (user === null) {
            router.replace('/login');
        }
    }, [user]);

    if (!user) return null;

    return (
        <View className="flex-1 justify-center items-center bg-white">
            <Text className="text-xl font-bold">Welcome {user.full_name}</Text>
            <Button title="Logout" onPress={logout} />
        </View>
    );
}
