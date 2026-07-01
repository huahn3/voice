import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            product: {
                select: { name: true },
            },
        },
    });

    return NextResponse.json(announcements);
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { productId, title, content, type, isActive, startsAt, endsAt } = body;

        const announcement = await prisma.announcement.create({
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
        console.error("创建公告失败:", error);
        return NextResponse.json({ error: "创建失败" }, { status: 500 });
    }
}
