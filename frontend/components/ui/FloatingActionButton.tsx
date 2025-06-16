import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingActionButtonProps {
    onPress: () => void;
    icon?: string;
    size?: number;
    backgroundColor?: string;
    iconColor?: string;
}

export default function FloatingActionButton({
     onPress,
     icon = 'add',
     size = 56,
     backgroundColor = '#EAF3D0',
     iconColor = '#000000'
 }: FloatingActionButtonProps) {
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