import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Colors } from '../constants/Colors';

interface CameraStreamViewerProps {
    streamUrl: string;
    serviceName: string;
}

export const CameraStreamViewer: React.FC<CameraStreamViewerProps> = ({ streamUrl, serviceName }) => {
    const [showVideo, setShowVideo] = useState(false);
    const [hasError, setHasError] = useState(false);

    const player = useVideoPlayer(
        showVideo && streamUrl ? { uri: streamUrl } : null,
        player => {
            if (showVideo && streamUrl) {
                player.play();
            }
        },
    );

    const { status } = useEvent(player, 'statusChange', { status: player.status });

    React.useEffect(() => {
        if (status === 'error') {
            setHasError(true);
        }
    }, [status]);

    if (!showVideo) {
        return (
            <TouchableOpacity
                style={styles.activateBtn}
                onPress={() => setShowVideo(true)}
            >
                <Text style={styles.activateBtnText}>Ver transmisión en vivo</Text>
            </TouchableOpacity>
        );
    }

    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>No se pudo reproducir el stream</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                        setHasError(false);
                        setShowVideo(false);
                        setTimeout(() => setShowVideo(true), 100);
                    }}
                >
                    <Text style={styles.retryBtnText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <VideoView
                style={styles.video}
                player={player}
                nativeControls
                contentFit="contain"
            />
            {status === 'loading' && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.loadingText}>Cargando stream...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        position: 'relative',
    },
    video: {
        width: '100%',
        height: 200,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 12,
        marginTop: 8,
    },
    activateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
    },
    activateBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    errorContainer: {
        height: 150,
        backgroundColor: '#fff1f2',
        borderWidth: 1,
        borderColor: '#ffe4e6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        fontSize: 13,
        color: '#b91c1c',
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 10,
    },
    retryBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
