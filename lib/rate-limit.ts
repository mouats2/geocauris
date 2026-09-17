type Entry = { count: number; resetAt: number };

const entries = new Map<string, Entry>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  return checkRateLimitAsync(key, limit, windowMs);
}

export async function checkRateLimitAsync(key: string, limit: number, windowMs: number) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      const response = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" }, body: JSON.stringify([["INCR", `geocauris:ratelimit:${key}`], ["EXPIRE", `geocauris:ratelimit:${key}`, windowSeconds]]), signal: AbortSignal.timeout(2000), cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const count = Number(payload?.[0]?.result ?? 0);
        return { allowed: count <= limit, retryAfterSeconds: windowSeconds };
      }
    } catch { /* Le repli mémoire protège encore les instances isolées. */ }
  }
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  if (current.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  return { allowed: true, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
}
