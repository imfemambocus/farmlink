import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import Homepage from '@/components/Homepage';
import FarmerDashboard from '@/components/FarmerDashboard';

export default function AuthIndex() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    // Route to appropriate homepage based on user role
    if (user.role === 'farmer') {
        return <FarmerDashboard />;
    }

    // Business and Individual users get the same homepage
    return <Homepage />;
}