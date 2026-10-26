import { supabase } from '../shared/supabase/client';

// Phone notifications (web push). The browser keeps the subscription; a copy of its address goes to the
// account so the server can send. See supabase/functions/push-notify.

export type PushSupport =
  | 'ok'
  | 'unsupported'      // this browser can't do push
  | 'needs-install'    // iPhone/iPad: only works once the app is on the home screen
  | 'blocked'          // the person said no in the browser; only they can undo that
  | 'not-configured';  // no VAPID key in this build

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | 'unsupported';
  hasKey: boolean;
}

export function classifyPushSupport(e: PushEnv): PushSupport {
  // iOS only exposes push to installed web apps, so before that the APIs are simply missing.
  if (e.isIOS && !e.isStandalone) return 'needs-install';
  if (!e.hasServiceWorker || !e.hasPushManager || !e.hasNotification) return 'unsupported';
  if (!e.hasKey) return 'not-configured';
  if (e.permission === 'denied') return 'blocked';
  return 'ok';
}

export function readPushEnv(): PushEnv {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  return {
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasNotification: typeof window !== 'undefined' && 'Notification' in window,
    isIOS,
    isStandalone: !!standalone,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    hasKey: !!import.meta.env.VITE_VAPID_PUBLIC_KEY,
  };
}

/** The key a browser wants is raw bytes; the one we keep is URL-safe base64. */
export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupport(): PushSupport {
  return classifyPushSupport(readPushEnv());
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Whether this device is subscribed right now (the browser is the source of truth). */
export async function isPushSubscribed(): Promise<boolean> {
  try { return !!(await currentSubscription()); } catch { return false; }
}

export type EnableResult = { ok: true } | { ok: false; reason: PushSupport | 'declined' | 'failed' };

/** Asks for permission (from a tap), subscribes this device, and saves it to the account. */
export async function enablePush(): Promise<EnableResult> {
  const support = pushSupport();
  if (support !== 'ok') return { ok: false, reason: support };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission === 'denied' ? 'blocked' : 'declined' };
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string) as unknown as BufferSource,
      });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, reason: 'failed' };
    const { error } = await supabase.rpc('register_push_subscription', {
      p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth, p_user_agent: navigator.userAgent,
    });
    if (error) return { ok: false, reason: 'failed' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Turns notifications off for this device: unsubscribes it and removes it from the account. */
export async function disablePush(): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch { /* nothing more to do */ }
}
