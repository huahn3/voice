import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 心跳 API - 保持在线状态
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    try {
        const body = await req.json();
        const { key, hwid } = body;

        if (!key) {
            return NextResponse.json({ success: false, message: "卡密不能为空" }, { status: 400 });
        }

        const cardKey = await prisma.cardKey.findUnique({
            where: { key },
            include: {
                product: {
                    include: {
                        announcements: {
                            where: {
                                isActive: true,
                                type: "CRITICAL", // 心跳只返回紧急公告
                            },
                        },
                    },
                },
            },
        });

        if (!cardKey) {
            return NextResponse.json({ success: false, message: "卡密不存在" }, { status: 404 });
        }

        // 检查状态
        if (cardKey.status !== "ACTIVE") {
            await logHeartbeat(cardKey.id, key, ip, hwid, userAgent, false, `状态异常: ${cardKey.status}`, startTime);
            return NextResponse.json({
                success: false,
                message: "卡密状态异常",
                status: cardKey.status,
            }, { status: 400 });
        }

        // 检查过期
        if (cardKey.expiresAt && new Date(cardKey.expiresAt) < new Date()) {
            await prisma.cardKey.update({
                where: { id: cardKey.id },
                data: { status: "EXPIRED" },
            });
            await logHeartbeat(cardKey.id, key, ip, hwid, userAgent, false, "已过期", startTime);
            return NextResponse.json({
                success: false,
                message: "卡密已过期",
                status: "EXPIRED",
            }, { status: 400 });
        }

        // 检查设备
        if (cardKey.bindHwid && cardKey.boundHwid && hwid !== cardKey.boundHwid) {
            await logHeartbeat(cardKey.id, key, ip, hwid, userAgent, false, "设备不匹配", startTime);
            return NextResponse.json({
                success: false,
                message: "设备不匹配",
            }, { status: 400 });
        }

        // 记录心跳
        await logHeartbeat(cardKey.id, key, ip, hwid, userAgent, true, null, startTime);

        // Parse remote config
        let remoteConfigObj = {};
        try {
            remoteConfigObj = JSON.parse(cardKey.product.remoteConfig || '{}');
        } catch (e) {
            console.error("Failed to parse remote config:", e);
        }

        // 返回状态
        return NextResponse.json({
            success: true,
            data: {
                status: cardKey.status,
                expiresAt: cardKey.expiresAt,
                remainingSeconds: cardKey.expiresAt
                    ? Math.max(0, Math.floor((new Date(cardKey.expiresAt).getTime() - Date.now()) / 1000))
                    : null,
                criticalAnnouncements: cardKey.product.announcements.map((a: any) => ({
                    title: a.title,
                    content: a.content,
                })),
                remoteConfig: remoteConfigObj,
            },
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime,
        });
    } catch (error) {
        console.error("心跳失败:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
    }
}

async function logHeartbeat(
    cardKeyId: string,
    cardKeyValue: string,
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
            action: "HEARTBEAT",
            ip,
            hwid,
            userAgent,
            success,
            failReason,
            responseTime: Date.now() - startTime,
        },
    });
}
