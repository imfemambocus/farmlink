import {View, Text, Button} from 'react-native';
import {useContext, useEffect, useState} from "react";
import {AuthContext} from "@/context/AuthContext";
import {useRouter} from "expo-router";

export default function Profile() {
    const { user, logout } = useContext(AuthContext);
    const router = useRouter();
    const [userName, setUserName] = useState('');

    const getUserName = (user: any) => {
        switch (user.role) {
            case "farmer":
                return user.farmer_profile.first_name;
            case "individual":
                return user.individual_profile.first_name;
            default:
                return user.business_profile.business_name;
        }
    }

    useEffect(() => {
        if (user === null) {
            router.replace('/login');
        } else {
            setUserName(getUserName(user));
        }
    }, [user]);

    if (!user) return null;

    return (
        <View className="flex-1 justify-center items-center bg-white">
            <Text className="text-xl font-bold">Welcome {userName}</Text>
            <Button title="Logout" onPress={logout} />
        </View>
    );
}
