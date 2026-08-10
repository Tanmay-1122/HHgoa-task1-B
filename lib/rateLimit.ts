// Deliberately simple: an in-memory sliding-window counter per IP. This does
// NOT share state across serverless instances/regions, so it's a soft
// deterrent against casual spam/scripted abuse, not a hard guarantee — good
// enough for a hackathon submission page. If this project grows real traffic,
// replace with Vercel Edge Config or Upstash Redis for a shared counter.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

const hits = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);

  // opportunistic cleanup so this map doesn't grow unbounded over the
  // lifetime of a warm serverless instance
  if (hits.size > 5000) {
    for (const [key, arr] of hits) {
      if (arr.every((t) => now - t > WINDOW_MS)) hits.delete(key);
    }
  }

  return timestamps.length > MAX_PER_WINDOW;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
