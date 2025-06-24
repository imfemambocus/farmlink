import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import Homepage from '@/app/(auth)/customer/homepage';
import Dashboard from '@/app/(auth)/farmer/dashboard';

export default function AuthIndex() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    if (user.role === 'farmer') {
        return <Dashboard />;
    }

    return <Homepage />;
}