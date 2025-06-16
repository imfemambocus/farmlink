import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import Homepage from '@/components/Homepage';
import Dashboard from '@/app/(auth)/farmer/dashboard';

export default function AuthIndex() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    // Route to appropriate homepage based on user role
    if (user.role === 'farmer') {
        return <Dashboard />;
    }

    // Business and Individual users get the same homepage
    return <Homepage />;
}