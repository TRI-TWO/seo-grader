/**
 * Upstash Redis Client Initialization
 * 
 * Creates a singleton Upstash Redis client for queue operations,
 * caching, and rate limiting.
 */

import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL environment variable");
  }

  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Missing UPSTASH_REDIS_REST_TOKEN environment variable");
  }

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redisClient;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedisClient()[prop as keyof Redis];
  },
});

/**
 * Rate Limiting Utilities
 */

const RATE_LIMIT_PREFIX = "rate_limit:";
const LOCK_PREFIX = "lock:url:";
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per hour for anonymous users
const LOCK_TTL = 300; // 5 minutes for single-flight locks

/**
 * Check and increment rate limit for an IP address
 * Returns true if within limit, false if rate limited
 */
export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `${RATE_LIMIT_PREFIX}anonymous:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Get current count
  const count = await redis.get<number>(key) || 0;

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limited - get TTL to know when it resets
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + (ttl > 0 ? ttl : RATE_LIMIT_WINDOW),
    };
  }

  // Increment counter
  const newCount = await redis.incr(key);
  if (newCount === 1) {
    // First request in window, set TTL
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - newCount,
    resetAt: now + RATE_LIMIT_WINDOW,
  };
}

/**
 * Acquire a single-flight lock for a URL
 * Returns true if lock acquired, false if already locked
 */
export async function acquireLock(normalizedUrl: string): Promise<boolean> {
  const key = `${LOCK_PREFIX}${normalizedUrl}`;
  const result = await redis.set(key, "1", { ex: LOCK_TTL, nx: true });
  return result === "OK";
}

/**
 * Release a single-flight lock for a URL
 */
export async function releaseLock(normalizedUrl: string): Promise<void> {
  const key = `${LOCK_PREFIX}${normalizedUrl}`;
  await redis.del(key);
}

