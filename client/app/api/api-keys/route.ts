export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";

// GET /api/api-keys — list all API keys for the user
export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const keys = await prisma.apiKey.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                prefix: true,
                createdAt: true,
                lastUsed: true,
                isActive: true,
            },
        });

        return Response.json(keys);
    } catch (error) {
        console.error("List API keys error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/api-keys — generate a new API key
export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const { name } = await request.json();

        if (!name) {
            return Response.json(
                { error: "Key name is required" },
                { status: 400 }
            );
        }

        // Generate a secure API key
        const rawKey = randomBytes(32).toString("hex");
        const prefix = "pk_" + rawKey.slice(0, 8);
        const fullKey = "pk_" + rawKey;

        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                key: fullKey,
                prefix,
                userId: user.userId,
            },
        });

        // Return the full key only on creation - won't be shown again
        return Response.json(
            {
                id: apiKey.id,
                name: apiKey.name,
                key: fullKey,
                prefix: apiKey.prefix,
                createdAt: apiKey.createdAt,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create API key error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
