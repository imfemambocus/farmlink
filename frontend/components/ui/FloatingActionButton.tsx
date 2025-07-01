import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';
import VoiceInput from '@/components/ui/VoiceInput';
import CustomAlert from '@/components/ui/CustomAlert';

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

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
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
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    const isCustomer = user?.role === 'individual' || user?.role === 'business';
    const shouldShowVoice = showVoice && isCustomer;

    if (shouldShowVoice) {
        return (
            <>
                <VoiceInput
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
                <CustomAlert
                    visible={alert.visible}
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    buttons={alert.buttons}
                    onClose={hideAlert}
                />
            </>
        );
    }

    return (
        <>
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
            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onClose={hideAlert}
            />
        </>
    );
}