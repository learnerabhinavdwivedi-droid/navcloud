/**
 * NavCloud Premium — Core Encryption Utilities
 * AES-256-GCM encryption/decryption for client-side file protection.
 */

/**
 * Generate a random AES-256 encryption key using the Web Crypto API.
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Export a CryptoKey to a base64 string for storage.
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/**
 * Import a base64-encoded key back into a CryptoKey.
 */
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

/**
 * Encrypt data using AES-256-GCM.
 * Returns { iv, ciphertext } both as Uint8Arrays.
 */
export async function encrypt(
  key: CryptoKey,
  data: ArrayBuffer
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

/**
 * Decrypt AES-256-GCM encrypted data.
 */
export async function decrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

/**
 * SHA-256 hash of a string (for integrity checks).
 */
export async function sha256(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
