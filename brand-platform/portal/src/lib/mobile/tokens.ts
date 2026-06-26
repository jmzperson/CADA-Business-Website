import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const TOKEN_BYTES = 32; // 256 bits entropy (exceeds 128-bit minimum)

export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function buildQrUrl(rawToken: string): string {
  const base = (process.env.REDEEM_BASE_URL || "https://redeem.cada.app").replace(/\/$/, "");
  return `${base}/r/${rawToken}`;
}

function encryptionKey(): Buffer {
  const raw = process.env.REWARD_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("REWARD_TOKEN_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("REWARD_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

/** Encrypt raw token for owner re-fetch via GET (never stored as plaintext). */
export function encryptToken(rawToken: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(rawToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptToken(ciphertext: string): string {
  const key = encryptionKey();
  const buf = Buffer.from(ciphertext, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
