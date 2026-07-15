import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    Alert,
    ActivityIndicator,

    ScrollView,
    Platform,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    User as UserIcon,
    LogOut,
    Settings,
    HelpCircle,
    Camera,
    Edit2,
    Check,
    X,
    Maximize,
    Bug
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Cropper from 'react-easy-crop';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

const MenuItem = ({ icon: Icon, title, onPress, danger }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuIcon}>
            <Icon size={20} color={danger ? Colors.error : Colors.text} />
        </View>
        <Text style={[styles.menuTitle, danger && { color: Colors.error }]}>{title}</Text>
    </TouchableOpacity>
);

export const ProfileScreen = ({ navigation }: any) => {
    const { user, token, signOut, updateUser } = useAuth();
    const { showAlert } = useAlert();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [loading, setLoading] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const API_URL = Config.API_URL;

    const handleSignOut = async () => {
        await signOut();
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: Platform.OS !== 'web',
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!(result as any).canceled) {
            const uri = (result as any).assets[0].uri;
            if (Platform.OS === 'web') {
                setImageToCrop(uri);
                setCropModalVisible(true);
            } else {
                setPhotoUri(uri);
                // Si no estamos en modo edición, preguntamos si quiere guardar el cambio de foto
                if (!isEditing) {
                    showAlert({
                        title: 'Subir Foto',
                        message: '¿Deseas actualizar tu foto de perfil?',
                        type: 'info',
                        buttons: [
                            { text: 'Cancelar', style: 'cancel', onPress: () => setPhotoUri(null) },
                            { text: 'Guardar', onPress: () => handleSave(uri) }
                        ]
                    });
                }
            }
        }
    };

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCropSave = async () => {
        if (!imageToCrop || !croppedAreaPixels) return;

        try {
            const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
            if (croppedBlob) {
                const uri = URL.createObjectURL(croppedBlob);
                setPhotoUri(uri);
                setCropModalVisible(false);
                
                if (!isEditing) {
                    handleSave(uri);
                }
            }
        } catch (e) {
            console.error(e);
            showAlert({ title: 'Error', message: 'No se pudo recortar la imagen', type: 'error' });
        }
    };

    const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new (window as any).Image();
            img.addEventListener('load', () => resolve(img));
            img.addEventListener('error', (err: any) => reject(err));
            img.setAttribute('crossOrigin', 'anonymous');
            img.src = imageSrc;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        // Reducir tamaño de la imagen para ahorrar espacio (ej. 400x400 max)
        const targetSize = 400;
        canvas.width = targetSize;
        canvas.height = targetSize;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            targetSize,
            targetSize
        );

        return new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob!);
            }, 'image/jpeg', 0.8);
        });
    };

    const handleSave = async (specificPhotoUri?: string) => {
        setLoading(true);
        try {
            const formData = new FormData();
            if (name !== user?.name) {
                formData.append('name', name);
            }

            const uriToUpload = specificPhotoUri || photoUri;
            if (uriToUpload) {
                const filename = `profile_${Date.now()}.jpg`;
                
                // For web support (blob URLs and direct blobs)
                if (uriToUpload.startsWith('blob:') || uriToUpload.startsWith('data:')) {
                    const blobResponse = await fetch(uriToUpload);
                    const blob = await blobResponse.blob();
                    formData.append('photo', blob, filename);
                } else {
                    const match = /\.(\w+)$/.exec(uriToUpload);
                    const type = match ? `image/${match[1]}` : `image/jpeg`;
                    formData.append('photo', {
                        uri: uriToUpload,
                        name: filename,
                        type,
                    } as any);
                }
            }

            const response = await fetch(`${API_URL}/users/profile`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                await updateUser(data);
                setIsEditing(false);
                setPhotoUri(null);
                showAlert({ title: 'Éxito', message: 'Perfil actualizado correctamente', type: 'success' });
            } else {
                showAlert({ title: 'Error', message: data.message || 'Error al actualizar perfil', type: 'error' });
            }
        } catch (error) {
            console.error('Update profile error:', error);
            showAlert({ title: 'Error', message: 'No se pudo conectar con el servidor', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const cancelEdit = () => {
        setName(user?.name || '');
        setPhotoUri(null);
        setIsEditing(false);
    };

    const userPhoto = user?.photo_url
        ? { uri: `${user.photo_url.startsWith('http') ? user.photo_url : `${API_URL.replace('/api', '')}${user.photo_url}`}${user.photo_url.includes('?') ? '&' : '?' }v=${new Date(user.updated_at || Date.now()).getTime()}` }
        : null;

    const [resending, setResending] = useState(false);

    const handleResendVerification = async () => {
        if (!user?.email) return;
        setResending(true);
        try {
            const response = await fetch(`${API_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: user.email,
                    source: 'mobile'
                }),
            });

            if (response.ok) {
                showAlert({
                    title: '¡Correo Enviado! 📧',
                    message: 'Te hemos enviado un enlace amigable a tu correo. Por favor, revísalo para continuar disfrutando de la App.',
                    type: 'success'
                });
            } else {
                const data = await response.json();
                showAlert({ title: 'Aviso', message: data.message || 'No pudimos enviar el correo en este momento.', type: 'warning' });
            }
        } catch (error) {
            showAlert({ title: 'Error', message: 'Hubo un problema de conexión. Intenta de nuevo más tarde.', type: 'error' });
        } finally {
            setResending(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <ArrowLeft color={Colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Mi Perfil</Text>
                    {isEditing ? (
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={cancelEdit} style={styles.headerAction}>
                                <X color={Colors.error} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSave()} style={styles.headerAction} disabled={loading}>
                                {loading ? (
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                ) : (
                                    <Check color={Colors.success} size={24} />
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => setIsEditing(true)}>
                            <Edit2 color={Colors.primary} size={24} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.profileHeader}>
                    <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
                        <View style={styles.avatar}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri } as any} style={styles.avatarImage} />
                            ) : userPhoto ? (
                                <Image source={userPhoto as any} style={styles.avatarImage} />
                            ) : (
                                <UserIcon size={40} color={Colors.primary} />
                            )}
                        </View>
                        <View style={styles.cameraIcon}>
                            <Camera size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    {isEditing ? (
                        <TextInput
                            style={styles.nameInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Tu nombre"
                            autoFocus
                        />
                    ) : (
                        <Text style={styles.name}>{user?.name || 'Usuario'}</Text>
                    )}

                    <View style={styles.emailWrapper}>
                        <Text style={styles.unit}>{user?.email || 'email@ejemplo.com'}</Text>
                        {user?.email_verified ? (
                            <View style={styles.verifiedBadge}>
                                <Check size={12} color={Colors.success} />
                                <Text style={styles.verifiedText}>Verificado</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.verifyButton}
                                onPress={handleResendVerification}
                                disabled={resending}
                            >
                                {resending ? (
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                ) : (
                                    <Text style={styles.verifyButtonText}>Verificar</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <MenuItem icon={UserIcon} title="Información Personal" onPress={() => navigation.navigate('PersonalInfo')} />
                    <MenuItem icon={Settings} title="Configurar Viviendas" onPress={() => navigation.navigate('Settings')} />
                    <MenuItem icon={HelpCircle} title="Ayuda y Soporte" onPress={() => navigation.navigate('Support')} />
                    <MenuItem icon={Bug} title="Depuración Push" onPress={() => navigation.navigate('DebugPushToken')} />
                </View>

                <View style={styles.section}>
                    <MenuItem
                        icon={LogOut}
                        title="Cerrar Sesión"
                        onPress={handleSignOut}
                        danger
                    />
                </View>

                <Text style={styles.version}>Versión 1.0.0</Text>
            </ScrollView>

            {/* Modal de Recorte (solo Web) */}
            <Modal
                visible={cropModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setCropModalVisible(false)}
            >
                <View style={styles.cropOverlay}>
                    <View style={styles.cropContainer}>
                        <View style={styles.cropHeader}>
                            <Text style={styles.cropTitle}>Recortar Foto</Text>
                            <TouchableOpacity onPress={() => setCropModalVisible(false)}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.cropperWrapper}>
                            {imageToCrop && (
                                <Cropper
                                    image={imageToCrop}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            )}
                        </View>

                        <View style={styles.cropFooter}>
                            <View style={styles.zoomContainer}>
                                <Text style={styles.zoomText}>Zoom</Text>
                                <TextInput
                                    style={styles.zoomInput}
                                    value={zoom.toString()}
                                    onChangeText={(v) => setZoom(parseFloat(v) || 1)}
                                    keyboardType="numeric"
                                />
                            </View>
                            <TouchableOpacity style={styles.cropButton} onPress={handleCropSave}>
                                <Text style={styles.cropButtonText}>Confirmar Recorte</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.secondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.background,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 16,
    },
    headerAction: {
        padding: 4,
    },
    profileHeader: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: Colors.background,
        marginBottom: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: Colors.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.background,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    nameInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
        textAlign: 'center',
        width: '80%',
    },
    unit: {
        fontSize: 14,
        color: Colors.muted,
    },
    emailWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    verifyButton: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    verifyButtonText: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: 'bold',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success + '15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    verifiedText: {
        fontSize: 12,
        color: Colors.success,
        fontWeight: 'bold',
    },
    section: {
        backgroundColor: Colors.background,
        paddingVertical: 8,
        marginBottom: 24,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    menuIcon: {
        marginRight: 16,
    },
    menuTitle: {
        fontSize: 16,
        color: Colors.text,
    },
    version: {
        textAlign: 'center',
        color: Colors.muted,
        fontSize: 12,
    },
    cropOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    cropContainer: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        width: '100%',
        maxWidth: 500,
        height: '80%',
        overflow: 'hidden',
    },
    cropHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    cropTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    cropperWrapper: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#000',
    },
    cropFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.secondary,
        gap: 16,
    },
    zoomContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    zoomText: {
        fontSize: 14,
        color: Colors.muted,
    },
    zoomInput: {
        width: 60,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: Colors.secondary,
        borderRadius: 4,
        padding: 4,
    },
    cropButton: {
        backgroundColor: Colors.primary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cropButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
