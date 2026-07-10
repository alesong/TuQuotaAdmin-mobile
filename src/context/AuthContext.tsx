import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { getStorage } from '../lib/api';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    photo_url?: string;
    phone?: string;
    document?: string;
    viviendas?: any[];
    email_verified?: boolean;
    google_id?: string | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface AuthContextData {
    user: User | null;
    token: string | null;
    loading: boolean;
    signIn: (user: User, token: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStorageData() {
            const storage = getStorage();
            console.log('[AuthContext] Iniciando carga de datos...');
            try {
                const storageUser = await storage.getItem('@TuQuotaAdmin:user');
                const storageToken = await storage.getItem('@TuQuotaAdmin:token');
                
                console.log('[AuthContext] Datos cargados:', { hasUser: !!storageUser, hasToken: !!storageToken });

                if (storageUser && storageToken) {
                    setUser(JSON.parse(storageUser));
                    setToken(storageToken);
                    api.setToken(storageToken);
                }
            } catch (error) {
                console.error('[AuthContext] Error loading storage data:', error);
            } finally {
                console.log('[AuthContext] Finalizado intento de carga.');
                setLoading(false);
            }
        }

        loadStorageData();
    }, []);

    const signIn = async (userData: User, userToken: string) => {
        const storage = getStorage();
        await storage.setItem('@TuQuotaAdmin:user', JSON.stringify(userData));
        await storage.setItem('@TuQuotaAdmin:token', userToken);

        setToken(userToken);
        setUser(userData);
        api.setToken(userToken);
    };

    const signOut = async () => {
        const storage = getStorage();
        try {
            await storage.removeItem('@TuQuotaAdmin:user');
            await storage.removeItem('@TuQuotaAdmin:token');
            api.clearCache();
            await storage.clear();
        } catch (e) {
            console.error('Error clearing storage:', e);
        }
        setUser(null);
        setToken(null);
    };

    const updateUser = async (userData: Partial<User>) => {
        setUser(prevUser => {
            if (!prevUser) return userData as User;

            const updates = Object.fromEntries(
                Object.entries(userData).filter(([key, value]) => {
                    if (value === undefined) return false;
                    if (key === 'viviendas' && value === null) return false;
                    return true;
                })
            );

            const newUser = { ...prevUser, ...updates } as User;
            getStorage().setItem('@TuQuotaAdmin:user', JSON.stringify(newUser));
            return newUser;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, signIn, signOut, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}
