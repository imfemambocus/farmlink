export interface BaseUser {
    id: number;
    email: string;
    role: 'farmer' | 'individual' | 'business';
    farmer_profile: FarmerProfile | null;
    individual_profile: IndividualProfile | null;
    business_profile: BusinessProfile | null;
}

export interface FarmerProfile {
    first_name: string;
    last_name: string;
    phone_number: string;
    district: string;
}

export interface IndividualProfile {
    first_name: string;
    last_name: string;
    date_of_birth: string;  // ISO date string, e.g. "1990-01-01"
    phone_number: string;
    street: string;
    city_town: string;
    post_code: string;
}

export interface BusinessProfile {
    business_name: string;
    contact_name: string;
    phone_number: string;
    street: string;
    city_town: string;
    post_code: string;
}

export type User = BaseUser;

export interface ProfileUpdateData {
    // Farmer fields
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    district?: string;
    // Individual additional fields
    date_of_birth?: string;
    street?: string;
    city_town?: string;
    post_code?: string;
    // Business additional fields
    business_name?: string;
    contact_name?: string;
}

export interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    updateProfile: (profileData: ProfileUpdateData) => Promise<void>;
}

export interface UnitPrice {
    id: number;
    unit: string;
    customer_type: 'individual' | 'business';
    price_per_unit: number;
    quantity_available: number;
    minimum_order: number;
}

export interface AlertState {
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
