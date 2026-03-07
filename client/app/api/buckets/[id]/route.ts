export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { NextRequest } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/buckets/:id — get bucket details
export async function GET(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const bucket = await prisma.bucket.findFirst({
            where: { id, ownerId: user.userId },
            include: {
                _count: { select: { files: true } },
                files: { select: { size: true } },
            },
        });

        if (!bucket) {
            return Response.json({ error: "Bucket not found" }, { status: 404 });
        }

        return Response.json({
            id: bucket.id,
            name: bucket.name,
            region: bucket.region,
            createdAt: bucket.createdAt,
            updatedAt: bucket.updatedAt,
            filesCount: bucket._count.files,
            totalSize: bucket.files.reduce((acc, f) => acc + f.size, 0),
        });
    } catch (error) {
        console.error("Get bucket error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/buckets/:id — delete a bucket
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const bucket = await prisma.bucket.findFirst({
            where: { id, ownerId: user.userId },
        });

        if (!bucket) {
            return Response.json({ error: "Bucket not found" }, { status: 404 });
        }

        await prisma.bucket.delete({ where: { id } });
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Delete bucket error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
