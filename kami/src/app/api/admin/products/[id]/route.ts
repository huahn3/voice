import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

// 获取单个产品
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            versions: {
                orderBy: { createdAt: "desc" },
            },
            _count: {
                select: {
                    cardKeys: true,
                },
            },
        },
    });

    if (!product) {
        return NextResponse.json({ error: "产品不存在" }, { status: 404 });
    }

    return NextResponse.json(product);
}

// 更新产品
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
        const { name, slug, description, deliveryType, downloadUrl, webhookUrl, isActive, encryptionKey, remoteConfig } = body;

        // 如果修改了 slug，检查是否重复
        if (slug) {
            const existing = await prisma.product.findFirst({
                where: {
                    slug,
                    NOT: { id },
                },
            });

            if (existing) {
                return NextResponse.json({ error: "该标识已被使用" }, { status: 400 });
            }
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                slug,
                description,
                deliveryType,
                downloadUrl,
                webhookUrl,
                isActive,
                encryptionKey,
                remoteConfig,
            },
        });

        await logAdminAction("UPDATE_PRODUCT", product.id, { name, slug }, req);

        return NextResponse.json(product);
    } catch (error) {
        console.error("更新产品失败:", error);
        return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }
}

// 删除产品
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
        await prisma.product.delete({
            where: { id },
        });

        await logAdminAction("DELETE_PRODUCT", id, {}, req);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("删除产品失败:", error);
        return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }
}
