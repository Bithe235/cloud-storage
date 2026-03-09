import { NextRequest } from 'next/server';

// Simple in-memory rate limiter for development/single-server production
// NOTE: On serverless platforms like Vercel, this map resets frequently.
// If you need global rate limiting, use Redis (e.g., Upstash).

type RateLimitEntry = {
    count: number;
    lastReset: number;
};

const limits = {
    READ: { count: 60, window: 60 * 1000 }, // 60 requests per minute
    WRITE: { count: 20, window: 60 * 1000 }, // 20 requests per minute
    DELETE: { count: 5, window: 60 * 1000 }, // 5 requests per minute
};

const store = new Map<string, RateLimitEntry>();

// Cleanup task: remove entries older than 10 minutes to prevent memory leaks
if (typeof global !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of store.entries()) {
            if (now - value.lastReset > 10 * 60 * 1000) {
                store.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

export function isRateLimited(req: NextRequest): { limited: boolean; type?: string } {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const method = req.method;

    let type: keyof typeof limits = 'READ';
    if (method === 'DELETE') {
        type = 'DELETE';
    } else if (['POST', 'PUT', 'PATCH'].includes(method)) {
        type = 'WRITE';
    }

    const key = `${ip}:${type}`;
    const now = Date.now();
    const limit = limits[type];

    let entry = store.get(key);

    if (!entry || (now - entry.lastReset > limit.window)) {
        entry = { count: 1, lastReset: now };
        store.set(key, entry);
        return { limited: false };
    }

    if (entry.count >= limit.count) {
        return { limited: true, type: type.toLowerCase() };
    }

    entry.count++;
    return { limited: false };
}
