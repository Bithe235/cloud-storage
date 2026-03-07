export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { NextRequest } from "next/server";

// GET /api/buckets — list all buckets for the authenticated user
export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const buckets = await prisma.bucket.findMany({
            where: { ownerId: user.userId },
            include: {
                _count: { select: { files: true } },
                files: { select: { size: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const result = buckets.map((b) => ({
            id: b.id,
            name: b.name,
            region: b.region,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            filesCount: b._count.files,
            totalSize: b.files.reduce((acc, f) => acc + f.size, 0),
        }));

        return Response.json(result);
    } catch (error) {
        console.error("List buckets error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/buckets — create a new bucket
export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const { name, region } = await request.json();

        if (!name || name.length < 3) {
            return Response.json(
                { error: "Bucket name must be at least 3 characters" },
                { status: 400 }
            );
        }

        // Validate bucket name: lowercase, alphanumeric + hyphens
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 2) {
            return Response.json(
                { error: "Bucket name must be lowercase alphanumeric with hyphens only" },
                { status: 400 }
            );
        }

        const existing = await prisma.bucket.findFirst({
            where: { name, ownerId: user.userId },
        });
        if (existing) {
            return Response.json(
                { error: "Bucket name already exists" },
                { status: 409 }
            );
        }

        const bucket = await prisma.bucket.create({
            data: {
                name,
                region: region || "us-east-1",
                ownerId: user.userId,
            },
        });

        // Create root folder
        await prisma.file.create({
            data: {
                path: "/",
                name: "/",
                isFolder: true,
                bucketId: bucket.id,
            },
        });

        return Response.json(bucket, { status: 201 });
    } catch (error) {
        console.error("Create bucket error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
