/**
 * UUID generation utilities
 * Centralized UUID generation with crypto API support and fallbacks
 */

function uuidv4Fallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() when available, falls back to polyfill
 */
export function generateUUID(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : uuidv4Fallback();
}

/**
 * Generates a short UUID (8 characters)
 * Useful for shorter identifiers where full UUID is not needed
 */
export function generateShortUUID(): string {
  return "xxxxxxxx".replace(/[x]/g, () => {
    const r = (Math.random() * 16) | 0;
    return r.toString(16);
  });
}

/**
 * Generates a UUID with a custom prefix
 */
export function generatePrefixedUUID(
  prefix: string,
  separator: string = "-",
): string {
  return `${prefix}${separator}${generateUUID()}`;
}

/**
 * Validates if a string is a valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === "string" && uuidRegex.test(uuid);
}

// Legacy aliases for backward compatibility
export const uuidv4 = generateUUID;
export default generateUUID;
