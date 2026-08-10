import { randomUUID, createHash, timingSafeEqual } from "crypto";

export function generateDeleteToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(providedToken: string, storedHash: string): boolean {
  const providedHash = hashToken(providedToken);
  const a = Buffer.from(providedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
