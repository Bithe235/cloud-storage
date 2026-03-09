import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isRateLimited } from './lib/rateLimit';

export function middleware(request: NextRequest) {
    // Only apply to /api routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        const { limited, type } = isRateLimited(request);

        if (limited) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Too many requests',
                    message: `You've exceeded the ${type} rate limit. Please slow down.`,
                    retry: true
                }),
                {
                    status: 429,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    }

    return NextResponse.next();
}

// Config to run on API only for efficiency
export const config = {
    matcher: '/api/:path*',
};
