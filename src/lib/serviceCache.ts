import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (userId: string) => `@TuQuotaAdmin:residentServices:${userId}`;

export interface ResidentServicesCache {
    services: any[];
    hasServices: boolean;
    updatedAt: number;
}

export async function getResidentServicesCache(userId: string): Promise<ResidentServicesCache | null> {
    if (!userId) return null;
    try {
        const raw = await AsyncStorage.getItem(KEY(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            services: Array.isArray(parsed.services) ? parsed.services : [],
            hasServices: !!parsed.hasServices,
            updatedAt: Number(parsed.updatedAt) || Date.now(),
        };
    } catch (e) {
        console.error('[serviceCache] Error reading cache:', e);
        return null;
    }
}

export async function setResidentServicesCache(userId: string, data: ResidentServicesCache): Promise<void> {
    if (!userId) return;
    try {
        await AsyncStorage.setItem(KEY(userId), JSON.stringify(data));
    } catch (e) {
        console.error('[serviceCache] Error writing cache:', e);
    }
}