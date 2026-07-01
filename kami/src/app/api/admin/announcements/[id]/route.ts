import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
        const { productId, title, content, type, isActive, startsAt, endsAt } = body;

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                productId,
                title,
                content,
                type,
                isActive,
                startsAt: startsAt ? new Date(startsAt) : null,
                endsAt: endsAt ? new Date(endsAt) : null,
            },
        });

        return NextResponse.json(announcement);
    } catch (error) {
        console.error("更新公告失败:", error);
        return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }
}

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
        await prisma.announcement.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("删除公告失败:", error);
        return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }
}
