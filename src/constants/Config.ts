interface ConfigValues {
    API_URL: string;
    APP_NAME: string;
    GOOGLE_CLIENT_ID: string;
}

let config: ConfigValues = {
    APP_NAME: 'TuQuota',
    API_URL: 'https://api.tuquotaadmin.com',
    GOOGLE_CLIENT_ID: '',
};

export function initializeConfig(values: Partial<ConfigValues>) {
    config = { ...config, ...values };
}

export const Config = {
    get APP_NAME() { return config.APP_NAME; },
    get API_URL() { return config.API_URL; },
    get GOOGLE_CLIENT_ID() { return config.GOOGLE_CLIENT_ID; },
};
