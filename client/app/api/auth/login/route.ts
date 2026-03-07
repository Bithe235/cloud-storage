export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { compare } from "bcryptjs";
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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return Response.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
            return Response.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        const token = await signToken({ userId: user.id, email: user.email });

        return Response.json({
            token,
            user: { id: user.id, email: user.email, createdAt: user.createdAt },
        });
    } catch (error) {
        console.error("Login error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
