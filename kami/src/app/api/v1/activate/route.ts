import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notify";

// 卡密激活 API
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    try {
        const body = await req.json();
        const { key, product: productSlug, hwid } = body;

        if (!key) {
            return NextResponse.json({ success: false, message: "卡密不能为空" }, { status: 400 });
        }

        // 查找卡密
        const cardKey = await prisma.cardKey.findUnique({
            where: { key },
            include: { product: true },
        });

        if (!cardKey) {
            await logAction(null, key, "ACTIVATE", ip, hwid, userAgent, false, "卡密不存在", startTime);
            return NextResponse.json({ success: false, message: "卡密不存在" }, { status: 404 });
        }

        // 检查产品匹配
        if (productSlug && cardKey.product.slug !== productSlug) {
            await logAction(cardKey.id, key, "ACTIVATE", ip, hwid, userAgent, false, "产品不匹配", startTime);
            return NextResponse.json({ success: false, message: "卡密与产品不匹配" }, { status: 400 });
        }

        // 检查是否已激活
        if (cardKey.status !== "UNUSED") {
            await logAction(cardKey.id, key, "ACTIVATE", ip, hwid, userAgent, false, "卡密已被使用", startTime);
            return NextResponse.json({
                success: false,
                message: `卡密状态为 ${cardKey.status}，无法激活`
            }, { status: 400 });
        }

        // 计算过期时间
        let expiresAt: Date | null = null;
        if (cardKey.type === "TIME" && cardKey.duration) {
            expiresAt = new Date(Date.now() + cardKey.duration * 1000);
        }

        // 激活卡密
        const updated = await prisma.cardKey.update({
            where: { id: cardKey.id },
            data: {
                status: "ACTIVE",
                activatedAt: new Date(),
                expiresAt,
                boundHwid: cardKey.bindHwid ? hwid : null,
                boundIp: cardKey.bindIp ? ip : null,
            },
        });

        await logAction(cardKey.id, key, "ACTIVATE", ip, hwid, userAgent, true, null, startTime);

        const response = NextResponse.json({
            success: true,
            message: "激活成功",
            data: {
                activatedAt: updated.activatedAt,
                expiresAt: updated.expiresAt,
                type: updated.type,
                boundHwid: updated.boundHwid ? true : false,
                boundIp: updated.boundIp ? true : false,
            },
            responseTime: Date.now() - startTime,
        });

        // Async Notification
        sendNotification(
            "card_activate",
            "卡密激活通知",
            `时间: ${new Date().toLocaleString()}\n卡密: ${key}\n产品: ${cardKey.product.name}\nIP: ${ip}\nHWID: ${hwid || "N/A"}`
        ).catch(console.error);

        return response;
    } catch (error) {
        console.error("激活失败:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
    }
}

async function logAction(
    cardKeyId: string | null,
    cardKeyValue: string,
    action: string,
    ip: string,
    hwid: string | undefined,
    userAgent: string | undefined,
    success: boolean,
    failReason: string | null,
    startTime: number
) {
    await prisma.verifyLog.create({
        data: {
            cardKeyId,
            cardKeyValue,
            action,
            ip,
            hwid,
            userAgent,
            success,
            failReason,
            responseTime: Date.now() - startTime,
        },
    });
}
