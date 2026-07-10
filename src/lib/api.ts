import { Config } from '../constants/Config';

interface StorageProvider {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}

let storage: StorageProvider = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {},
};

export function setStorageProvider(provider: StorageProvider) {
    storage = provider;
}

export function getStorage() {
    return storage;
}

const API_URL = Config.API_URL;

class Api {
    private tokenCache: string | null = null;

    private async getHeaders(headers: any = {}) {
        try {
            if (!this.tokenCache) {
                const storageToken = await storage.getItem('@TuQuotaAdmin:token');
                this.tokenCache = storageToken;
            }

            const token = this.tokenCache;
            const defaultHeaders: any = {
                'Content-Type': 'application/json',
            };

            if (token) {
                defaultHeaders['Authorization'] = `Bearer ${token}`;
            }

            return { ...defaultHeaders, ...headers };
        } catch (error) {
            console.error('[Api] Error in getHeaders:', error);
            return { 'Content-Type': 'application/json', ...headers };
        }
    }

    clearCache() {
        this.tokenCache = null;
    }

    setToken(token: string) {
        this.tokenCache = token;
    }

    async get(endpoint: string, options: any = {}) {
        const headers = await this.getHeaders(options.headers);
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            method: 'GET',
            headers,
        });
        if (response.status === 401) {
            console.error(`[Api] 401 Unauthorized at GET ${endpoint}`);
        }
        return response;
    }

    async post(endpoint: string, body: any, options: any = {}) {
        const headers = await this.getHeaders(options.headers);
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (response.status === 401) {
            console.error(`[Api] 401 Unauthorized at POST ${endpoint}`);
        }
        return response;
    }

    async patch(endpoint: string, body: any, options: any = {}) {
        const headers = await this.getHeaders(options.headers);
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });
        if (response.status === 401) {
            console.error(`[Api] 401 Unauthorized at PATCH ${endpoint}`);
        }
        return response;
    }

    async put(endpoint: string, body: any, options: any = {}) {
        const headers = await this.getHeaders(options.headers);
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
        });
        if (response.status === 401) {
            console.error(`[Api] 401 Unauthorized at PUT ${endpoint}`);
        }
        return response;
    }

    async delete(endpoint: string, options: any = {}) {
        const headers = await this.getHeaders(options.headers);
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            method: 'DELETE',
            headers,
        });
        if (response.status === 401) {
            console.error(`[Api] 401 Unauthorized at DELETE ${endpoint}`);
        }
        return response;
    }

    getApiUrl() {
        return API_URL;
    }
}

export default new Api();
