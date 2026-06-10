export interface AppBridgeContext {
  sourceApp: string;
  topic: string;
  seedText?: string;
  companionId?: string;
}

const STORAGE_KEY = 'velvet_app_bridge';

export function setAppBridgeContext(ctx: AppBridgeContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage unavailable
  }
}

export function getAppBridgeContext(): AppBridgeContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppBridgeContext;
  } catch {
    return null;
  }
}

export function clearAppBridgeContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
