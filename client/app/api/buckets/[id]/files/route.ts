export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

type RouteParams = { params: Promise<{ id: string }> };

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// GET /api/buckets/:id/files?path=/some/path — list files in a directory
export async function GET(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id: bucketId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dirPath = searchParams.get("path") || "/";
    const search = searchParams.get("search") || "";

    try {
        const bucket = await prisma.bucket.findFirst({
            where: { id: bucketId, ownerId: user.userId },
        });
        if (!bucket) {
            return Response.json({ error: "Bucket not found" }, { status: 404 });
        }

        let files;
        if (search) {
            // Search mode
            files = await prisma.file.findMany({
                where: {
                    bucketId,
                    name: { contains: search },
                    NOT: { path: "/" },
                },
                orderBy: [{ isFolder: "desc" }, { name: "asc" }],
            });
        } else {
            // Tree listing
            const normalizedPath = dirPath.endsWith("/") ? dirPath : dirPath + "/";
            files = await prisma.file.findMany({
                where: {
                    bucketId,
                    path: { startsWith: normalizedPath },
                    NOT: { path: normalizedPath === "/" ? undefined : "/" },
                },
                orderBy: [{ isFolder: "desc" }, { name: "asc" }],
            });

            // Filter to only direct children
            files = (files as any[]).filter((f: any) => {
                const relativePath = f.path.slice(normalizedPath.length);
                // Direct children have no additional slashes (except trailing for folders)
                const parts = relativePath.replace(/\/$/, "").split("/");
                return parts.length === 1 && parts[0] !== "";
            });
        }

        return Response.json({
            path: dirPath,
            files: (files as any[]).map((f: any) => ({
                id: f.id,
                name: f.name,
                path: f.path,
                size: f.size,
                mimeType: f.mimeType,
                isFolder: f.isFolder,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
            })),
        });
    } catch (error) {
        console.error("List files error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/buckets/:id/files — upload file or create folder
export async function POST(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id: bucketId } = await params;

    try {
        const bucket = await prisma.bucket.findFirst({
            where: { id: bucketId, ownerId: user.userId },
        });
        if (!bucket) {
            return Response.json({ error: "Bucket not found" }, { status: 404 });
        }

        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            // Create folder
            const { path: dirPath, folderName } = await request.json();
            if (!folderName) {
                return Response.json(
                    { error: "folderName is required" },
                    { status: 400 }
                );
            }

            const basePath = dirPath && dirPath !== "/" ? dirPath : "/";
            const normalizedBase = basePath.endsWith("/") ? basePath : basePath + "/";
            const folderPath = normalizedBase + folderName + "/";

            const existing = await prisma.file.findFirst({
                where: { path: folderPath, bucketId },
            });
            if (existing) {
                return Response.json(
                    { error: "Folder already exists" },
                    { status: 409 }
                );
            }

            const folder = await prisma.file.create({
                data: {
                    path: folderPath,
                    name: folderName,
                    isFolder: true,
                    bucketId,
                },
            });

            return Response.json(folder, { status: 201 });
        } else {
            // File upload via FormData
            const formData = await request.formData();
            const file = formData.get("file") as globalThis.File | null;
            const uploadPath = (formData.get("path") as string) || "/";

            if (!file) {
                return Response.json({ error: "File is required" }, { status: 400 });
            }

            const normalizedPath = uploadPath.endsWith("/")
                ? uploadPath
                : uploadPath + "/";
            const filePath = normalizedPath + file.name;

            // Save to disk
            const diskDir = path.join(UPLOAD_DIR, bucketId, normalizedPath);
            await mkdir(diskDir, { recursive: true });
            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(path.join(diskDir, file.name), buffer);

            // Check if file already exists (update instead of create)
            const existing = await prisma.file.findFirst({
                where: { path: filePath, bucketId },
            });

            let dbFile;
            if (existing) {
                dbFile = await prisma.file.update({
                    where: { id: existing.id },
                    data: { size: buffer.length, mimeType: file.type || "application/octet-stream" },
                });
            } else {
                dbFile = await prisma.file.create({
                    data: {
                        path: filePath,
                        name: file.name,
                        size: buffer.length,
                        mimeType: file.type || "application/octet-stream",
                        isFolder: false,
                        bucketId,
                    },
                });
            }

            return Response.json(dbFile, { status: 201 });
        }
    } catch (error) {
        console.error("Upload/create error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/buckets/:id/files?path=/some/path/file.txt — delete file or folder
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { id: bucketId } = await params;
    const filePath = request.nextUrl.searchParams.get("path");

    if (!filePath) {
        return Response.json({ error: "path is required" }, { status: 400 });
    }

    try {
        const bucket = await prisma.bucket.findFirst({
            where: { id: bucketId, ownerId: user.userId },
        });
        if (!bucket) {
            return Response.json({ error: "Bucket not found" }, { status: 404 });
        }

        const file = await prisma.file.findFirst({
            where: { path: filePath, bucketId },
        });
        if (!file) {
            return Response.json({ error: "File not found" }, { status: 404 });
        }

        if (file.isFolder) {
            // Delete folder and all contents
            await prisma.file.deleteMany({
                where: {
                    bucketId,
                    path: { startsWith: filePath },
                },
            });
        } else {
            await prisma.file.delete({ where: { id: file.id } });
        }

        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Delete file error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
