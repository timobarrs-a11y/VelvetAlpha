export function safeRandomUUID(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID(); } catch {}
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
