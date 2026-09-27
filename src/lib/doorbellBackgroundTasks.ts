import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';

/**
 * Tareas en segundo plano del timbre.
 *
 * Cuando el usuario toca la notificación, la app navega a "Mis Servicios" y
 * pinta la fotografía de inmediato. Las acciones derivadas (marcar quién tocó
 * la notificación, refrescar la snapshot, etc.) se ejecutan AQUÍ, fuera del
 * ciclo de navegación/render, para que nunca bloqueen ni interrumpan al
 * usuario: sin spinners, sin alertas y con reintentos silenciosos.
 */

export type DoorbellReceiptTarget =
    | { type: 'event'; id: string }
    | { type: 'snapshot'; id: string };

interface PendingReceipt {
    type: string;
    id: string;
    attempts: number;
}

const PENDING_KEY = '@TuQuotaAdmin:doorbellPendingReceipts';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

let pending: PendingReceipt[] | null = null;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const targetKey = (t: { type: string; id: string }) => `${t.type}:${t.id}`;

/**
 * Ejecuta una tarea en segundo plano, diferida un tick para no competir con la
 * navegación ni con el render. Cualquier error se traga (solo log): el usuario
 * nunca ve fallas de estos procesos.
 */
export function runInBackground(label: string, task: () => Promise<void> | void): void {
    setTimeout(() => {
        Promise.resolve()
            .then(task)
            .catch((err) => console.warn(`[doorbellBackground] ${label}:`, err));
    }, 0);
}

async function loadPending(): Promise<PendingReceipt[]> {
    if (pending) return pending;
    try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        pending = Array.isArray(parsed)
            ? parsed.filter((t: any) => t && typeof t.id === 'string' && typeof t.type === 'string')
            : [];
    } catch {
        pending = [];
    }
    return pending;
}

async function persistPending(): Promise<void> {
    try {
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending || []));
    } catch (e) {
        console.warn('[doorbellBackground] No se pudo persistir la cola de receipts:', e);
    }
}

async function sendReceipt(token: string, task: PendingReceipt): Promise<boolean> {
    try {
        const response = await fetch(`${Config.API_URL}/resident-services/doorbell/receipt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ type: task.type, id: task.id }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

function scheduleRetry(token: string): void {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        flushDoorbellReceipts(token);
    }, RETRY_DELAY_MS);
}

/**
 * Reenvía los receipts pendientes (cola persistida). Nunca lanza excepciones
 * ni bloquea al usuario; si un receipt supera los reintentos se descarta (el
 * backend es idempotente y la UI vuelve a marcarlo al abrir el detalle del
 * evento desde el historial).
 */
export async function flushDoorbellReceipts(token: string | null): Promise<void> {
    if (!token || flushing) return;
    flushing = true;
    try {
        const list = await loadPending();
        for (const task of [...list]) {
            const ok = await sendReceipt(token, task);
            if (ok) {
                pending = (pending || []).filter(t => targetKey(t) !== targetKey(task));
                continue;
            }
            task.attempts = (task.attempts || 0) + 1;
            if (task.attempts >= MAX_ATTEMPTS) {
                pending = (pending || []).filter(t => targetKey(t) !== targetKey(task));
                console.warn('[doorbellBackground] Receipt descartado tras reintentos:', targetKey(task));
            }
        }
        await persistPending();
        if ((pending || []).length > 0) scheduleRetry(token);
    } finally {
        flushing = false;
    }
}

/**
 * Encola la marca "vio la notificación" (quién tocó el timbre) para que se
 * envíe en segundo plano, con reintentos y persistencia local (sobrevive a
 * cierres de la app). Devuelve de inmediato: no espera la respuesta del
 * servidor ni retrasa la navegación.
 */
export function enqueueDoorbellReceipt(
    token: string | null,
    target: DoorbellReceiptTarget | null | undefined,
): void {
    if (!token || !target || !target.id) return;
    runInBackground('receipt', async () => {
        const list = await loadPending();
        if (!list.some(t => targetKey(t) === targetKey(target))) {
            list.push({ type: target.type, id: target.id, attempts: 0 });
        }
        await persistPending();
        await flushDoorbellReceipts(token);
    });
}
