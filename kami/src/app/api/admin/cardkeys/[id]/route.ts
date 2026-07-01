import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 获取单个卡密
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    const cardKey = await prisma.cardKey.findUnique({
        where: { id },
        include: {
            product: true,
            verifyLogs: {
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });

    if (!cardKey) {
        return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
    }

    return NextResponse.json(cardKey);
}

// 更新卡密
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const { status, remark, duration, maxUses, credits, expiresAt } = body;

        const cardKey = await prisma.cardKey.update({
            where: { id },
            data: {
                status,
                remark,
                duration,
                maxUses,
                credits,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            },
        });

        return NextResponse.json(cardKey);
    } catch (error) {
        console.error("更新卡密失败:", error);
        return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }
}

// 删除卡密
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    try {
        await prisma.cardKey.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("删除卡密失败:", error);
        return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }
}
