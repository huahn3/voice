import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 快速切换产品状态
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const product = await prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            return NextResponse.json({ error: "产品不存在" }, { status: 404 });
        }

        const updated = await prisma.product.update({
            where: { id },
            data: {
                isActive: !product.isActive,
            },
        });

        // 如果禁用产品，同时冻结所有相关卡密
        if (!updated.isActive) {
            await prisma.cardKey.updateMany({
                where: {
                    productId: id,
                    status: "ACTIVE",
                },
                data: {
                    status: "FROZEN",
                },
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("切换产品状态失败:", error);
        return NextResponse.json({ error: "操作失败" }, { status: 500 });
    }
}
