export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'farmer' | 'individual' | 'business';
}

export interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}
