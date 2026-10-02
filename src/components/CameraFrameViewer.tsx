import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    AppState,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { Maximize, Pause, Play } from 'lucide-react-native';

interface CameraFrameViewerProps {
    /**
     * URL relativa del fotograma (…/resident-services/cameras-center/frame/<serviceId>).
     * Cameras Center sólo publica MJPEG y JPEG: MJPEG no es reproducible con
     * expo-video ni con <Image> de React Native, así que se refresca el último
     * fotograma por polling.
     */
    frameUrl: string;
    /**
     * Captura previa (JPEG) que se muestra DETRÁS de los fotogramas en vivo
     * mientras carga el primero: el residente reconoce la cámara al instante
     * y no se ve pantalla negra durante el calentamiento del polling.
     */
    snapshotUrl?: string | null;
    /** JWT del residente: el backend también lo acepta en la query `?token=`. */
    token: string;
    serviceName: string;
    /** Detalle del último error del backend (si lo hubo al obtener el stream). */
    errorDetail?: string | null;
    /**
     * Vuelve a pedir el stream al backend antes de reintentar (misma
     * convención que CameraStreamViewer): devuelve la nueva URL o null si ya
     * no hay transmisión disponible.
     */
    onRefresh?: () => Promise<string | null> | string | null;
    /**
     * Pausa tras cada fotograma en ms. Con la caché de frames del backend la
     * respuesta suele salir en ~250 ms; 300 ms de pausa da ~2 fps.
     */
    intervalMs?: number;
    /** Llena el contenedor padre (modal de pantalla completa). */
    expanded?: boolean;
    /** Muestra el botón de pantalla completa (la pantalla reubica el visor). */
    onFullscreen?: () => void;
}

/** Fotogramas fallidos seguidos antes de pasar al estado de error. */
const MAX_CONSECUTIVE_ERRORS = 3;
/**
 * Si una petición no dispara onLoad/onError en este tiempo se cuenta como
 * fallo: evita el spinner infinito cuando una petición se queda colgada.
 */
const REQUEST_TIMEOUT_MS = 15000;
/**
 * Pausa automática: a los 2 minutos de transmisión continua se corta el
 * polling y la sonda (una pantalla olvidada deja de tirar ~16 KB/s) y hay
 * que pulsar "Reanudar" para volver a consumir.
 */
const AUTO_PAUSE_MS = 120_000;

export const CameraFrameViewer: React.FC<CameraFrameViewerProps> = ({
    frameUrl,
    snapshotUrl,
    token,
    serviceName,
    errorDetail,
    onRefresh,
    intervalMs = 300,
    expanded = false,
    onFullscreen,
}) => {
    // Doble buffer: capa 0 y capa 1 se alternan. La capa "front" muestra el
    // último fotograma bueno y NO se toca; la nueva carga en la capa de
    // fondo y sólo se pone al frente al terminar, así nunca se ve pantalla
    // negra entre fotogramas (Fresco borra la imagen al cambiar la URI).
    const [uris, setUris] = useState<(string | null)[]>([null, null]);
    const [frontIdx, setFrontIdx] = useState<0 | 1>(0);
    /** Capa que recibe el próximo fotograma (la que no está al frente). */
    const backRef = useRef<0 | 1>(0);
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [snapshotFailed, setSnapshotFailed] = useState(false);
    // Último fotograma cargado con éxito: si hace más de 10 s que no llega
    // ninguno, se pinta SIN SEÑAL aunque la cadena de polling siga viva
    // (peticiones lentas/colgadas se detectan aquí, antes de los 3 reintentos
    // del estado de error).
    const lastOkRef = useRef(Date.now());
    const [activityStale, setActivityStale] = useState(false);
    // Resultado de la sonda de frescura (X-Frame-Age-Ms): false = la API no
    // responde o la cámara lleva >10 s sin producir fotogramas nuevos.
    const [fresh, setFresh] = useState<boolean | null>(null);
    // Telemetría real para el overlay discreto: resolución del JPEG
    // (cabecera X-Frame-Size) y fps medidos en el propio polling.
    const [frameSize, setFrameSize] = useState<string | null>(null);
    const [measuredFps, setMeasuredFps] = useState(0);
    const frameTimesRef = useRef<number[]>([]);
    // Al subirlo se reinicia la cadena de polling (botón "Reiniciar").
    const [restartNonce, setRestartNonce] = useState(0);
    // Pausa automática a los 2 min: con `paused` en las dependencias de los
    // efectos de polling y sonda, ponerlo a true los detiene (cleanup) y
    // ponerlo a false los vuelve a lanzar (arranque inmediato).
    const [paused, setPaused] = useState(false);
    const pauseDeadlineRef = useRef(Date.now() + AUTO_PAUSE_MS);
    const errorCountRef = useRef(0);
    const appActiveRef = useRef(true);
    // Callbacks del <Image> expuestos al bucle de polling vía ref, para que
    // el efecto no capture closures obsoletas entre renderizaciones.
    const onLoadRef = useRef<(layer: number) => void>(() => {});
    const onErrorRef = useRef<(layer: number) => void>(() => {});

    // URL absoluta con el JWT y un cache-buster: cada fotograma es una
    // petición nueva (el backend responde con Cache-Control: no-store).
    const buildUri = useCallback(
        (url: string) => {
            const base = Config.API_URL.replace(/\/+$/, '');
            const absolute = url.startsWith('http') ? url : `${base}${url}`;
            const sep = absolute.includes('?') ? '&' : '?';
            return `${absolute}${sep}token=${encodeURIComponent(token)}&_=${Date.now()}`;
        },
        [token],
    );

    // Captura previa: se memoriza para que su URI no cambie en cada render
    // (Date.now() sólo al montar o cambiar la fuente) y no recargue la imagen.
    useEffect(() => {
        setSnapshotFailed(false);
    }, [snapshotUrl]);

    const snapshotUri = useMemo(
        () => (snapshotUrl && !snapshotFailed ? buildUri(snapshotUrl) : null),
        [snapshotUrl, snapshotFailed, buildUri],
    );

    // Al cambiar la fuente (reintento) se limpia todo el estado del intento
    // anterior. DEBE DECLARARSE ANTES del bucle de polling: los efectos se
    // ejecutan en orden y así backRef/uris quedan reiniciados antes de que
    // el bucle dispare su primer fotograma.
    useEffect(() => {
        errorCountRef.current = 0;
        backRef.current = 0;
        lastOkRef.current = Date.now();
        frameTimesRef.current = [];
        setMeasuredFps(0);
        setFrameSize(null);
        setUris([null, null]);
        setFrontIdx(0);
        setLoaded(false);
        setHasError(false);
    }, [frameUrl]);

    // Bucle de polling EN CADENA: sólo se pide el siguiente fotograma cuando
    // el anterior terminó (onLoad, onError o watchdog). Un intervalo fijo
    // cancelaba las peticiones en vuelo (cada frame tarda ~1.7 s), el <Image>
    // nunca disparaba onLoad y el visor se quedaba en "Cargando..." eterno.
    useEffect(() => {
        if (hasError || paused) return;

        let stopped = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;
        let next: ReturnType<typeof setTimeout> | null = null;

        const clearWatchdog = () => {
            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }
        };

        const requestFrame = () => {
            if (stopped) return;
            // Sin peticiones en segundo plano: la cadena queda detenida y el
            // listener de AppState la reanuda al volver a 'active'.
            if (!appActiveRef.current) return;
            clearWatchdog();
            const uri = buildUri(frameUrl);
            const target = backRef.current;
            // La capa de fondo se carga (y se borra) sin afectar a la capa
            // que el usuario está viendo.
            setUris(prev => {
                const updated = [...prev];
                updated[target] = uri;
                return updated;
            });
            watchdog = setTimeout(() => {
                // Petición colgada sin onLoad/onError: cuenta como fallo.
                watchdog = null;
                handleFail();
            }, REQUEST_TIMEOUT_MS);
        };

        const scheduleNext = (delay: number) => {
            if (stopped) return;
            if (next) clearTimeout(next);
            next = setTimeout(requestFrame, delay);
        };

        const handleOk = (layer: number) => {
            if (stopped) return;
            // Cargas llegadas tarde de otra ronda: se ignoran.
            if (layer !== backRef.current) return;
            clearWatchdog();
            errorCountRef.current = 0;
            lastOkRef.current = Date.now();
            // Marca para el medidor de fps reales (ventana deslizante).
            frameTimesRef.current.push(Date.now());
            // Intercambio de capas: la recién cargada pasa al frente (ya
            // tiene el bitmap decodificado, el cambio es instantáneo) y la
            // anterior queda de fondo para recibir el próximo fotograma.
            setFrontIdx(layer as 0 | 1);
            backRef.current = (layer === 0 ? 1 : 0) as 0 | 1;
            setLoaded(true);
            scheduleNext(intervalMs);
        };

        const handleFail = () => {
            if (stopped) return;
            clearWatchdog();
            errorCountRef.current += 1;
            if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
                setHasError(true);
            } else {
                // Se reintenta en la MISMA capa de fondo; la capa al frente
                // sigue mostrando el último fotograma bueno.
                scheduleNext(intervalMs);
            }
        };

        onLoadRef.current = handleOk;
        onErrorRef.current = layer => {
            if (layer !== backRef.current) return;
            handleFail();
        };

        const subscription = AppState.addEventListener('change', state => {
            appActiveRef.current = state === 'active';
            if (state === 'active') {
                // Margen al volver de segundo plano: la cadena tarda unos
                // fotogramas en reanudarse y el badge no debe parpadear.
                lastOkRef.current = Date.now();
                // Reanuda la cadena si quedó detenida en segundo plano (sin
                // petición en vuelo ni siguiente fotograma programado).
                if (!watchdog && !next) scheduleNext(0);
            }
        });

        requestFrame(); // primer fotograma sin esperar

        return () => {
            stopped = true;
            clearWatchdog();
            if (next) clearTimeout(next);
            subscription.remove();
        };
    }, [hasError, paused, frameUrl, buildUri, intervalMs, restartNonce]);

    // Sonda de frescura: cada 5 s pide el fotograma (HEAD: sólo interesan
    // las cabeceras, sin cuerpo se ahorra el JPEG completo por sondeo) y lee
    // X-Frame-Age-Ms. Un 200 con la cámara muerta devuelve el último frame
    // para siempre (edad creciente) y el polling seguiría "funcionando" sobre
    // una imagen congelada: esta sonda es la que marca SIN SEÑAL en ese caso.
    const STALE_MS = 10_000;
    useEffect(() => {
        if (hasError || paused) return;
        let cancelled = false;
        const probe = async () => {
            let ok = false;
            let size: string | null = null;
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 8000);
                const resp = await fetch(buildUri(frameUrl), { method: 'HEAD', signal: ctrl.signal });
                clearTimeout(timer);
                if (resp.ok) {
                    const raw = resp.headers.get('x-frame-age-ms');
                    const age = raw === null ? NaN : Number(raw);
                    // Cabecera ausente → sólo vale que responda 200.
                    ok = Number.isNaN(age) || age <= STALE_MS;
                    size = resp.headers.get('x-frame-size');
                }
            } catch {
                ok = false;
            }
            if (!cancelled) {
                setFresh(ok);
                setFrameSize(size);
            }
        };
        probe();
        const iv = setInterval(probe, 5000);
        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, [frameUrl, buildUri, hasError, paused, restartNonce]);

    // FPS reales recibidos: fotogramas completados en ventana de 5 s.
    useEffect(() => {
        const iv = setInterval(() => {
            const now = Date.now();
            const times = frameTimesRef.current.filter(t => now - t <= 5000);
            frameTimesRef.current = times;
            const fps = Math.round((times.length / 5) * 10) / 10;
            setMeasuredFps(prev => (prev === fps ? prev : fps));
        }, 2000);
        return () => clearInterval(iv);
    }, []);

    // Vigilancia de actividad: si entre fotogramas pasan más de 10 s, la
    // cadena está colgada o muy lenta → SIN SEÑAL sin esperar a los 3 fallos
    // consecutivos del estado de error (~45 s en el peor caso).
    useEffect(() => {
        const iv = setInterval(() => {
            const stale = Date.now() - lastOkRef.current > STALE_MS;
            setActivityStale(prev => (prev === stale ? prev : stale));
        }, 2000);
        return () => clearInterval(iv);
    }, []);

    // Cuenta atrás de la pausa automática: revisa el plazo cada 2 s y, si se
    // venció, pone `paused` (los efectos de polling y sonda salen solos por
    // sus dependencias). Mientras está pausado el efecto no corre, así que la
    // bandera no se repite.
    useEffect(() => {
        if (paused) return;
        const iv = setInterval(() => {
            if (Date.now() >= pauseDeadlineRef.current) setPaused(true);
        }, 2000);
        return () => clearInterval(iv);
    }, [paused]);

    // Reinicio manual desde el badge: limpia contadores, reanuda la cadena de
    // polling de inmediato y refresca el contrato por si cambió la URL.
    const handleRestart = () => {
        errorCountRef.current = 0;
        lastOkRef.current = Date.now();
        frameTimesRef.current = [];
        setMeasuredFps(0);
        setActivityStale(false);
        setFresh(null);
        setHasError(false);
        setRetrying(false);
        setRestartNonce(n => n + 1);
        void onRefresh?.();
    };

    // Reanudación manual tras la pausa automática: plazo nuevo de 2 minutos,
    // indicadores a cero y `paused=false` que remonta polling y sonda.
    const handleResume = () => {
        pauseDeadlineRef.current = Date.now() + AUTO_PAUSE_MS;
        errorCountRef.current = 0;
        lastOkRef.current = Date.now();
        frameTimesRef.current = [];
        setMeasuredFps(0);
        setActivityStale(false);
        setFresh(null);
        setPaused(false);
    };

    const handleRetry = async () => {
        if (!onRefresh) {
            errorCountRef.current = 0;
            setHasError(false);
            return;
        }
        setRetrying(true);
        try {
            const newUrl = await onRefresh();
            if (!newUrl) {
                // El backend devolvió un error nuevo: se muestra vía errorDetail.
                setHasError(true);
                return;
            }
            errorCountRef.current = 0;
            setLoaded(false);
            // No se construye la URI con newUrl (es el stream): el polling se
            // reinicia solo con el prop frameUrl, ya actualizado por el refresh.
            setHasError(false);
        } catch {
            setHasError(true);
        } finally {
            setRetrying(false);
        }
    };

    // Señal de corte: sin fotograma reciente o sonda con la cámara fría.
    const signalOff = activityStale || fresh === false;

    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>No se pudo cargar la transmisión</Text>
                {!!errorDetail && <Text style={styles.errorDetail}>{errorDetail}</Text>}
                <TouchableOpacity
                    style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
                    onPress={handleRetry}
                    disabled={retrying}
                >
                    {retrying ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text style={styles.retryBtnText}>Reintentar</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, expanded && styles.containerExpanded]}>
            {/* Captura previa como capa de fondo (zIndex bajo las capas del
                doble buffer): se ve hasta que el primer fotograma la tapa. */}
            {snapshotUri ? (
                <Image
                    source={{ uri: snapshotUri }}
                    style={[styles.image, expanded && styles.imageExpanded, { zIndex: 0 }]}
                    resizeMode="contain"
                    accessibilityLabel={`${serviceName} (captura)`}
                    onError={() => setSnapshotFailed(true)}
                />
            ) : null}
            {uris.map((uri, idx) =>
                uri ? (
                    <Image
                        key={idx}
                        source={{ uri }}
                        style={[styles.image, expanded && styles.imageExpanded, { zIndex: frontIdx === idx ? 2 : 1 }]}
                        resizeMode="contain"
                        accessibilityLabel={serviceName}
                        onLoad={() => onLoadRef.current(idx)}
                        onError={() => onErrorRef.current(idx)}
                    />
                ) : null
            )}
            {!loaded && !paused && (
                <View style={[styles.loadingOverlay, { zIndex: 3 }]}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.loadingText}>Cargando transmisión...</Text>
                </View>
            )}
            {/* Badge de salud: punto verde EN VIVO / punto rojo SIN SEÑAL con
                "Reiniciar", para que un corte silencioso sea visible. Oculto
                mientras dura la pausa (el overlay lo sustituye). */}
            {loaded && !paused && (
                <View style={[styles.badge, signalOff ? styles.badgeOff : null]}>
                    <View style={[styles.badgeDot, signalOff ? styles.badgeDotOff : styles.badgeDotLive]} />
                    <Text style={styles.badgeText}>{signalOff ? 'SIN SEÑAL' : 'EN VIVO'}</Text>
                    {signalOff && (
                        <TouchableOpacity
                            style={styles.badgeRestart}
                            onPress={handleRestart}
                            accessibilityLabel="Reiniciar transmisión"
                        >
                            <Text style={styles.badgeRestartText}>Reiniciar</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
            {/* Controles: pausar y pantalla completa (arriba a la derecha). */}
            {loaded && !paused && (
                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() => setPaused(true)}
                        accessibilityLabel="Pausar transmisión"
                    >
                        <Pause size={14} color="#ffffff" />
                    </TouchableOpacity>
                    {!!onFullscreen && (
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={onFullscreen}
                            accessibilityLabel="Ver en pantalla completa"
                        >
                            <Maximize size={14} color="#ffffff" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
            {/* Telemetría discreta: resolución y fps reales recibidos. */}
            {loaded && !paused && (frameSize || measuredFps > 0) && (
                <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>
                        {[frameSize, measuredFps > 0 ? `${measuredFps.toFixed(1)} fps` : null]
                            .filter((p): p is string => p !== null)
                            .join(' · ')}
                    </Text>
                </View>
            )}
            {/* Pausa automática a los 2 min: velo sobre el último fotograma
                (sigue reconociéndose la cámara) y el botón Reanudar. */}
            {paused && (
                <View style={styles.pausedOverlay}>
                    <Pause size={26} color="#ffffff" />
                    <Text style={styles.pausedTitle}>Transmisión pausada</Text>
                    <Text style={styles.pausedHint}>
                        Se detuvo a los 2 minutos para no consumir datos sin que estés mirando.
                    </Text>
                    <TouchableOpacity
                        style={styles.pausedBtn}
                        onPress={handleResume}
                        accessibilityLabel="Reanudar transmisión"
                    >
                        <Play size={14} color="#ffffff" />
                        <Text style={styles.pausedBtnText}>Reanudar transmisión</Text>
                    </TouchableOpacity>
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
        minHeight: 200,
    },
    // Capas absolutas apiladas (doble buffer): la capa frontal lleva zIndex
    // mayor y la de fondo recibe la siguiente carga sin parpadear.
    image: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 200,
    },
    containerExpanded: {
        flex: 1,
        minHeight: undefined,
    },
    imageExpanded: {
        height: '100%',
    },
    // Controles de reproducción (pausar / pantalla completa).
    controlsRow: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 4,
        flexDirection: 'row',
        gap: 6,
    },
    controlBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
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
    // Badge de salud del stream (punto + texto), por encima de las capas.
    badge: {
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 4,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    badgeOff: {
        backgroundColor: 'rgba(127, 29, 29, 0.92)',
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    badgeDotLive: {
        backgroundColor: '#22c55e',
    },
    badgeDotOff: {
        backgroundColor: '#fecaca',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    badgeRestart: {
        marginLeft: 8,
        backgroundColor: '#ef4444',
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    badgeRestartText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    // Pastilla de telemetría (resolución · fps), discreta abajo a la derecha.
    metaPill: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        zIndex: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    metaPillText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 10,
        fontWeight: '600',
    },
    // Overlay de pausa automática (por encima del badge: zIndex 5).
    pausedOverlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 5,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
    },
    pausedTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },
    pausedHint: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 6,
        maxWidth: 260,
    },
    pausedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2563eb',
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 999,
        marginTop: 12,
    },
    pausedBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    errorContainer: {
        minHeight: 150,
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
        marginBottom: 6,
    },
    errorDetail: {
        fontSize: 12,
        color: '#b91c1c',
        textAlign: 'center',
        marginBottom: 10,
    },
    retryBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryBtnDisabled: {
        opacity: 0.7,
    },
    retryBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
