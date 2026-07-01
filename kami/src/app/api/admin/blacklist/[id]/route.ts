import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
        await prisma.blacklistRule.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("删除黑名单失败:", error);
        return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }
}
