/**
 * Upstash Redis Connection and Utilities
 * 
 * Provides Redis client, rate limiting, and distributed locking functionality.
 * Uses Upstash REST API (no persistent connections needed).
 */

import { Redis } from "@upstash/redis";

// Lazy initialization pattern
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

// Singleton pattern via Proxy
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedisClient()[prop as keyof Redis];
  },
});

/**
 * Rate limiting: Check if request is allowed (10 requests/hour per IP)
 * 
 * @param ip - IP address to check rate limit for
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `rate_limit:anonymous:${ip}`;
  const limit = 10; // 10 requests per hour
  const ttl = 3600; // 1 hour in seconds

  try {
    // Get current count
    const current = await redis.get<number>(key);
    const count = current || 0;

    if (count >= limit) {
      // Rate limit exceeded
      const ttlRemaining = await redis.ttl(key);
      const resetAt = Math.floor(Date.now() / 1000) + (ttlRemaining > 0 ? ttlRemaining : ttl);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment counter
    const newCount = await redis.incr(key);
    
    // Set TTL if this is the first request
    if (newCount === 1) {
      await redis.expire(key, ttl);
    }

    const remaining = Math.max(0, limit - newCount);
    const resetAt = Math.floor(Date.now() / 1000) + ttl;

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetAt: Math.floor(Date.now() / 1000) + ttl,
    };
  }
}

/**
 * Acquire distributed lock for a URL
 * Prevents duplicate job processing for the same URL
 * 
 * @param url - Normalized URL to lock
 * @returns true if lock was acquired, false if already locked
 */
export async function acquireLock(url: string): Promise<boolean> {
  const key = `lock:url:${url}`;
  const ttl = 420; // 7 minutes (420 seconds) - safely exceeds max worker window

  try {
    // SET key "1" EX 420 NX - only set if key doesn't exist
    const result = await redis.set(key, "1", {
      ex: ttl,
      nx: true, // Only set if key doesn't exist
    });

    return result === "OK";
  } catch (error) {
    console.error("Lock acquisition error:", error);
    // On error, assume lock failed (fail closed)
    return false;
  }
}

/**
 * Release distributed lock for a URL
 * 
 * @param url - Normalized URL to unlock
 */
export async function releaseLock(url: string): Promise<void> {
  const key = `lock:url:${url}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error("Lock release error:", error);
    // Ignore errors on release - lock will expire naturally
  }
}

