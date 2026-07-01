import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const rules = await prisma.blacklistRule.findMany({
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, value, reason, expiresAt } = body;

        if (!type || !value) {
            return NextResponse.json({ error: "类型和值不能为空" }, { status: 400 });
        }

        const rule = await prisma.blacklistRule.create({
            data: {
                type,
                value,
                reason,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });

        return NextResponse.json(rule);
    } catch (error) {
        console.error("添加黑名单失败:", error);
        return NextResponse.json({ error: "添加失败" }, { status: 500 });
    }
}
