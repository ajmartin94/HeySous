import { randomBytes } from "node:crypto";

/** Generate a Telegram deep link URL for an invite token. */
export function generateDeepLink(
  botUsername: string,
  token: string,
): string {
  return `https://t.me/${botUsername}?start=${token}`;
}

/**
 * Generate a cryptographically secure, URL-safe invite token.
 * Uses 24 random bytes encoded as base64url (32 characters).
 * Characters: A-Z, a-z, 0-9, -, _ (compatible with Telegram deep link params).
 */
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}
