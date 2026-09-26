export function createId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

export function isValidId(value) {
  return typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
}
