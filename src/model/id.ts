const uuidFrom = (bytes: number[]): string => {
  const value = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join('-');
};

/**
 * crypto.randomUUID is only handed out in a secure context, and a board reached at a plain
 * http address on the network is not one. getRandomValues is, so the id is built by hand there.
 */
export const randomId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  bytes[6] = (((bytes[6] ?? 0) & 0x0f) | 0x40) as number;
  bytes[8] = (((bytes[8] ?? 0) & 0x3f) | 0x80) as number;
  return uuidFrom(bytes);
};
