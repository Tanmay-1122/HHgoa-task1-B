import { headers } from "next/headers";

// Resolves the deployed site's absolute base URL for building og:image /
// og:url values. Prefers an explicit override, then Vercel's own env var,
// then falls back to the incoming request's Host header (works in preview
// deployments and local dev without any env var at all).
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
