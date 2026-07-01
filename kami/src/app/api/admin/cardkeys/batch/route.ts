import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 批量操作卡密
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { ids, action, status } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "请选择卡密" }, { status: 400 });
        }

        let result;

        switch (action) {
            case "updateStatus":
                if (!status) {
                    return NextResponse.json({ error: "请指定状态" }, { status: 400 });
                }
                result = await prisma.cardKey.updateMany({
                    where: { id: { in: ids } },
                    data: { status },
                });
                break;

            case "delete":
                result = await prisma.cardKey.deleteMany({
                    where: { id: { in: ids } },
                });
                break;

            case "freeze":
                result = await prisma.cardKey.updateMany({
                    where: { id: { in: ids } },
                    data: { status: "FROZEN" },
                });
                break;

            case "unfreeze":
                result = await prisma.cardKey.updateMany({
                    where: {
                        id: { in: ids },
                        status: "FROZEN",
                    },
                    data: { status: "ACTIVE" },
                });
                break;

            case "ban":
                result = await prisma.cardKey.updateMany({
                    where: { id: { in: ids } },
                    data: { status: "BANNED" },
                });
                break;

            default:
                return NextResponse.json({ error: "未知操作" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            affected: result.count,
        });
    } catch (error) {
        console.error("批量操作失败:", error);
        return NextResponse.json({ error: "操作失败" }, { status: 500 });
    }
}
