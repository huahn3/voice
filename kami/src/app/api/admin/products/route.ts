import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

// 获取产品列表
export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: {
                    cardKeys: true,
                    versions: true,
                },
            },
        },
    });

    return NextResponse.json(products);
}

// 创建产品
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { name, slug, description, deliveryType, downloadUrl, webhookUrl, encryptionKey, remoteConfig } = body;

        if (!name || !slug) {
            return NextResponse.json({ error: "名称和标识不能为空" }, { status: 400 });
        }

        // 检查 slug 是否已存在
        const existing = await prisma.product.findUnique({
            where: { slug },
        });

        if (existing) {
            return NextResponse.json({ error: "该标识已被使用" }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                name,
                slug,
                description,
                deliveryType,
                downloadUrl,
                webhookUrl,
                encryptionKey,
                remoteConfig,
            },
        });

        await logAdminAction("CREATE_PRODUCT", product.id, { name, slug }, req);

        return NextResponse.json(product);
    } catch (error) {
        console.error("创建产品失败:", error);
        return NextResponse.json({ error: "创建失败" }, { status: 500 });
    }
}
