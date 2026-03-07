export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { NextRequest } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/api-keys/:id — revoke an API key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: { id, userId: user.userId },
        });

        if (!apiKey) {
            return Response.json({ error: "API key not found" }, { status: 404 });
        }

        await prisma.apiKey.delete({ where: { id } });
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Delete API key error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
