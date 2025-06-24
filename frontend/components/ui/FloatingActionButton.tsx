import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import VoiceInput from '@/components/ui/VoiceInput';

interface FloatingActionButtonProps {
    onPress?: () => void;
    icon?: string;
    size?: number;
    backgroundColor?: string;
    iconColor?: string;
    showVoice?: boolean;
    onResult?: (data: any) => void;
    onError?: (error: string) => void;
}

export default function FloatingActionButton({
     onPress,
     icon = 'add',
     size = 56,
     backgroundColor = '#EAF3D0',
     iconColor = '#000000',
     showVoice = false,
     onResult,
     onError
 }: FloatingActionButtonProps) {
    const { user } = useContext(AuthContext);
    const router = useRouter();

    const isCustomer = user?.role === 'individual' || user?.role === 'business';
    const shouldShowVoice = showVoice && isCustomer;

    const handleVoiceResult = onResult || ((data: any) => {
        if (data?.products) {
            router.push({
                pathname: '/(auth)/customer/products',
                params: { searchTerm: data.searchTerm || '' }
            });
        }
    });

    const handleVoiceError = onError || ((error: string) => {
        Alert.alert('Voice Command Error', error);
    });

    if (shouldShowVoice) {
        return (
            <VoiceInput
                onResult={handleVoiceResult}
                onError={handleVoiceError}
                style={{
                    position: 'absolute',
                    bottom: 48,
                    right: 24,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#EAF3D0',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                iconSize={size * 0.4}
                iconColor="black"
            />
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            className="absolute bottom-12 right-6 rounded-full shadow-lg elevation-8"
            style={{
                width: size,
                height: size,
                backgroundColor,
                justifyContent: 'center',
                alignItems: 'center',
            }}
            activeOpacity={0.8}
        >
            <Ionicons
                name={icon as any}
                size={size * 0.4}
                color={iconColor}
            />
        </TouchableOpacity>
    );
}