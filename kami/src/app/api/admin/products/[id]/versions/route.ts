import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 创建新版本
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id: productId } = await params;

    try {
        const body = await req.json();
        const { version, channel, scriptContent, releaseNotes, forceUpdate } = body;

        if (!version) {
            return NextResponse.json({ error: "版本号不能为空" }, { status: 400 });
        }

        // 检查版本号是否已存在
        const existing = await prisma.productVersion.findFirst({
            where: {
                productId,
                version,
                channel
            }
        });

        if (existing) {
            return NextResponse.json({ error: "该渠道下此版本号已存在" }, { status: 400 });
        }

        const newVersion = await prisma.productVersion.create({
            data: {
                productId,
                version,
                channel,
                scriptContent,
                releaseNotes,
                forceUpdate,
                isActive: true
            }
        });

        return NextResponse.json(newVersion);
    } catch (error) {
        console.error("创建版本失败:", error);
        return NextResponse.json({ error: "创建失败" }, { status: 500 });
    }
}
