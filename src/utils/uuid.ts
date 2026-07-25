/**
 * Safe UUID generator.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS) AND on
 * newer engines — notably iOS Safari 15.4+. On older iOS devices, in insecure
 * contexts, or inside some in-app webviews, `crypto.randomUUID` is `undefined`
 * and calling it throws a `TypeError`. When that happens inside a module-level
 * singleton (e.g. the monitoring/analytics services instantiated at startup),
 * the error is thrown during module evaluation and the entire app fails to
 * mount — a blank white screen. Android Chrome ships `crypto.randomUUID`
 * broadly, which is why the same build works there but not on iOS.
 *
 * This helper prefers the native implementation when present, falls back to
 * `crypto.getRandomValues` for a spec-compliant v4 UUID, and finally to
 * `Math.random()` when no crypto is available at all.
 */
export function safeRandomUUID(): string {
  const c: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // fall through to the manual implementations below
    }
  }

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    // Per RFC 4122 §4.4: set version (4) and variant bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex: string[] = [];
    for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
    return (
      hex[bytes[0]] + hex[bytes[1]] + hex[bytes[2]] + hex[bytes[3]] + '-' +
      hex[bytes[4]] + hex[bytes[5]] + '-' +
      hex[bytes[6]] + hex[bytes[7]] + '-' +
      hex[bytes[8]] + hex[bytes[9]] + '-' +
      hex[bytes[10]] + hex[bytes[11]] + hex[bytes[12]] +
      hex[bytes[13]] + hex[bytes[14]] + hex[bytes[15]]
    );
  }

  // Last-resort fallback: not cryptographically strong, but collision-safe
  // enough for client-side ids and guaranteed never to throw.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
