// Updated FloatingActionButton with Voice Command for customers
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
    showVoice?: boolean; // NEW: Option to show voice instead of default action
    onResult?: (data: any) => void; // NEW: Voice result handler
    onError?: (error: string) => void; // NEW: Voice error handler
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

    // Check if should show voice button (only for customers)
    const isCustomer = user?.role === 'individual' || user?.role === 'business';
    const shouldShowVoice = showVoice && isCustomer;

    // Default voice input handlers if not provided
    const handleVoiceResult = onResult || ((data: any) => {
        if (data?.products) {
            // Navigate to products page with search results
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
        // Return voice input component styled as floating button
        return (
            <VoiceInput
                onResult={handleVoiceResult}
                onError={handleVoiceError}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    right: 24,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#EAF3D0',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                }}
                iconSize={size * 0.4}
                iconColor="black"
            />
        );
    }

    // Default floating action button (for farmers or when voice is disabled)
    return (
        <TouchableOpacity
            onPress={onPress}
            className="absolute bottom-6 right-6 rounded-full shadow-lg elevation-8"
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