import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "pentaract-cloud-storage-secret-key-2024"
);

const TOKEN_EXPIRY = "7d";

export interface JWTPayload {
    userId: string;
    email: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
    return new SignJWT(payload as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

export async function getAuthUser(
    request: NextRequest
): Promise<JWTPayload | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.slice(7);
    return verifyToken(token);
}

export function unauthorized() {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
}
