export interface BaseUser {
    id: number;
    email: string;
    role: 'farmer' | 'individual' | 'business';
}

export interface FarmerUser extends BaseUser {
    role: 'farmer';
    first_name: string;
    last_name: string;
    phone_number: string;
    district: string;
}

export interface IndividualUser extends BaseUser {
    role: 'individual';
    first_name: string;
    last_name: string;
    date_of_birth: string;  // ISO date string, e.g. "1990-01-01"
    phone_number: string;
    street: string;
    city_town: string;
    post_code: string;
}

export interface BusinessUser extends BaseUser {
    role: 'business';
    business_name: string;
    contact_name: string;
    phone_number: string;
    street: string;
    city_town: string;
    post_code: string;
}

export type User = FarmerUser | IndividualUser | BusinessUser;

export interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}
