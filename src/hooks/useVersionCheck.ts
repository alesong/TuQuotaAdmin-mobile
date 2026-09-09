import { useState, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import Api from '../lib/api';
import Constants from 'expo-constants';

interface VersionInfo {
    version: string;
    forceUpdate: boolean;
    downloadUrl: string;
    releaseNotes: string;
}

export const useVersionCheck = () => {
    const [checking, setChecking] = useState(true);

    const checkVersion = async () => {
        try {
            const response = await Api.get('/app-version');
            if (!response.ok) {
                console.warn('[VersionCheck] API version check failed');
                return;
            }

            const data: VersionInfo = await response.json();
            const currentVersion = Constants.expoConfig?.version || '1.0.0';

            if (isNewerVersion(data.version, currentVersion)) {
                showUpdateAlert(data);
            }
        } catch (error) {
            console.error('[VersionCheck] Error checking version:', error);
        } finally {
            setChecking(false);
        }
    };

    const isNewerVersion = (latest: string, current: string) => {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const v1 = latestParts[i] || 0;
            const v2 = currentParts[i] || 0;
            if (v1 > v2) return true;
            if (v1 < v2) return false;
        }
        return false;
    };

    const showUpdateAlert = (info: VersionInfo) => {
        const buttons: any[] = [
            {
                text: 'Actualizar ahora',
                onPress: () => Linking.openURL(info.downloadUrl),
            },
        ];

        if (!info.forceUpdate) {
            buttons.push({
                text: 'Más tarde',
                style: 'cancel',
            });
        }

        Alert.alert(
            'Actualización Disponible',
            `Una nueva versión (${info.version}) está disponible.\n\n${info.releaseNotes}`,
            buttons,
            { cancelable: !info.forceUpdate }
        );
    };

    useEffect(() => {
        checkVersion();
    }, []);

    return { checking };
};
