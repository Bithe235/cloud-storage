export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { hash } from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return Response.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return Response.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return Response.json(
                { error: "Email already registered" },
                { status: 409 }
            );
        }

        const passwordHash = await hash(password, 12);
        const user = await prisma.user.create({
            data: { email, passwordHash },
        });

        const token = await signToken({ userId: user.id, email: user.email });

        return Response.json(
            {
                token,
                user: { id: user.id, email: user.email, createdAt: user.createdAt },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Register error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
