import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateCardKey } from "@/lib/utils";

// 获取卡密列表
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [cardKeys, total] = await Promise.all([
        prisma.cardKey.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                product: {
                    select: { id: true, name: true, slug: true },
                },
            },
        }),
        prisma.cardKey.count({ where }),
    ]);

    return NextResponse.json({
        data: cardKeys,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}

// 批量生成卡密
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const {
            productId,
            count = 1,
            type = "TIME",
            duration,
            maxUses,
            credits,
            bindHwid = false,
            bindIp = false,
            maxDevices = 1,
            remark,
        } = body;

        if (!productId) {
            return NextResponse.json({ error: "请选择产品" }, { status: 400 });
        }

        // 验证产品存在
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return NextResponse.json({ error: "产品不存在" }, { status: 404 });
        }

        // 生成卡密
        const cardKeys = [];
        for (let i = 0; i < Math.min(count, 100); i++) {
            // 最多一次生成100个
            let key = generateCardKey();
            // 确保唯一性
            let exists = await prisma.cardKey.findUnique({ where: { key } });
            while (exists) {
                key = generateCardKey();
                exists = await prisma.cardKey.findUnique({ where: { key } });
            }

            cardKeys.push({
                productId,
                key,
                type,
                duration: type === "TIME" ? duration : null,
                maxUses: type === "COUNT" ? maxUses : null,
                credits: type === "CREDIT" ? credits : null,
                bindHwid,
                bindIp,
                maxDevices,
                remark,
            });
        }

        const created = await prisma.cardKey.createMany({
            data: cardKeys,
        });

        // 返回新创建的卡密
        const newCardKeys = await prisma.cardKey.findMany({
            where: {
                key: { in: cardKeys.map((c) => c.key) },
            },
            include: {
                product: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });

        return NextResponse.json({
            count: created.count,
            cardKeys: newCardKeys,
        });
    } catch (error) {
        console.error("生成卡密失败:", error);
        return NextResponse.json({ error: "生成失败" }, { status: 500 });
    }
}
