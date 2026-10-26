import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shared/supabase/client', () => ({ supabase: {} }));

import { classifyPushSupport, urlBase64ToUint8Array, type PushEnv } from '../pushService';

const env = (over: Partial<PushEnv> = {}): PushEnv => ({
  hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIOS: false, isStandalone: false,
  permission: 'default', hasKey: true, ...over,
});

describe('whether this device can get notifications', () => {
  it('works in an ordinary browser that supports push', () => {
    expect(classifyPushSupport(env())).toBe('ok');
  });
  it('an iPhone has to add the app to the home screen first', () => {
    expect(classifyPushSupport(env({ isIOS: true, hasPushManager: false }))).toBe('needs-install');
    expect(classifyPushSupport(env({ isIOS: true, isStandalone: true }))).toBe('ok');
  });
  it('says so when the browser cannot do it, was told no, or the build has no key', () => {
    expect(classifyPushSupport(env({ hasPushManager: false }))).toBe('unsupported');
    expect(classifyPushSupport(env({ permission: 'denied' }))).toBe('blocked');
    expect(classifyPushSupport(env({ hasKey: false }))).toBe('not-configured');
  });
});

describe('the push key', () => {
  it('turns URL-safe base64 into bytes', () => {
    // "hello" is aGVsbG8 without padding; the dashes and underscores of URL-safe base64 map back to + and /.
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});
