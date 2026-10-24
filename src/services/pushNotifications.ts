import { supabase } from '../shared/supabase/client';

// Public half of the VAPID key pair; the private half is the edge secret VAPID_PRIVATE_KEY.
const VAPID_PUBLIC_KEY = 'BOqyxzhZP2hmG5gMi0MyHx19Uw0vLqdakkPW8usVeQWefdQAELLBo8vFEeVojf3T5Oxso_GvplQTtYxXfIDCcZE';

export type PushState = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushState(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    // iPhones only allow web push once Velvet is added to the Home Screen.
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  return Notification.permission as PushState;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask for permission (must run from a tap) and save this device's subscription. */
export async function enablePush(): Promise<PushState> {
  if (pushState() !== 'default' && pushState() !== 'granted') return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushState;
  await syncPushSubscription();
  return 'granted';
}

/** Keep the saved subscription current once permission is granted. */
export async function syncPushSubscription(): Promise<void> {
  if (pushState() !== 'granted') return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' },
  );
}
