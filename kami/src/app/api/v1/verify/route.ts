import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendNotification } from "@/lib/notify";

// 卡密验证 API
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    try {
        const body = await req.json();
        const { key, product: productSlug, hwid, version } = body;


        if (!key) {
            return createResponse(false, "卡密不能为空", null, startTime, ip, userAgent);
        }

        // 1. 限流检查 (60次/分钟)
        const recentLogs = await prisma.verifyLog.count({
            where: {
                ip,
                createdAt: { gt: new Date(Date.now() - 60 * 1000) }
            }
        });

        if (recentLogs > 60) {
            // Trigger Attack Notification
            if (recentLogs === 61 || recentLogs % 100 === 0) { // Limit notification frequency
                sendNotification(
                    "system_attack",
                    "⚠️ 系统高频请求告警",
                    `检测到来自 IP ${ip} 的高频请求攻击。\n频率: >60次/分钟\nUserAgent: ${userAgent || "N/A"}`
                ).catch(console.error);
            }
            return createResponse(false, "请求过于频繁，请稍后再试", null, startTime, ip, userAgent);
        }

        // 检查黑名单
        // 检查黑名单
        const orConditions: any[] = [{ type: "IP", value: ip }];
        if (hwid) {
            orConditions.push({ type: "HWID", value: hwid });
        }

        const blacklisted = await prisma.blacklistRule.findFirst({
            where: {
                AND: [
                    { OR: orConditions },
                    { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                ],
            },
        });

        if (blacklisted) {
            return createResponse(false, "访问已被限制", null, startTime, ip, userAgent);
        }

        // 查找卡密
        const cardKey = await prisma.cardKey.findUnique({
            where: { key },
            include: {
                product: {
                    include: {
                        versions: {
                            where: { isActive: true },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                        announcements: {
                            where: {
                                isActive: true,
                                AND: [
                                    { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
                                    { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
                                ],
                            },
                        },
                    },
                },
            },
        });

        if (!cardKey) {
            await logVerify(null, key, "VERIFY", ip, hwid, userAgent, false, "卡密不存在", startTime);
            return createResponse(false, "卡密不存在", null, startTime, ip, userAgent);
        }

        // 检查产品匹配
        if (productSlug && cardKey.product.slug !== productSlug) {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "产品不匹配", startTime);
            return createResponse(false, "卡密与产品不匹配", null, startTime, ip, userAgent);
        }

        // 2. 检查强制更新
        const checkVersion = cardKey.product.versions[0];
        if (checkVersion && checkVersion.forceUpdate && checkVersion.version !== version) {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "版本过低强制更新", startTime);

            // 返回 200 但 valid=false，并附带更新信息
            const updateData = {
                valid: false,
                product: {
                    name: cardKey.product.name,
                    slug: cardKey.product.slug,
                    latestVersion: checkVersion.version,
                    forceUpdate: true,
                    downloadUrl: cardKey.product.downloadUrl
                }
            };
            return createResponse(true, "版本过低，请强制更新", updateData, startTime, ip, userAgent);
        }

        // 检查产品是否启用
        if (!cardKey.product.isActive) {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "产品已禁用", startTime);
            return createResponse(false, "产品已禁用", null, startTime, ip, userAgent);
        }

        // 检查卡密状态
        if (cardKey.status === "BANNED") {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "卡密已封禁", startTime);
            return createResponse(false, "卡密已被封禁", null, startTime, ip, userAgent);
        }

        if (cardKey.status === "FROZEN") {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "卡密已冻结", startTime);
            return createResponse(false, "卡密已被冻结", null, startTime, ip, userAgent);
        }

        // 检查是否需要先激活
        if (cardKey.status === "UNUSED") {
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "卡密未激活", startTime);
            return createResponse(false, "卡密未激活，请先激活", { needActivate: true }, startTime, ip, userAgent);
        }

        // 检查过期时间
        if (cardKey.expiresAt && new Date(cardKey.expiresAt) < new Date()) {
            await prisma.cardKey.update({
                where: { id: cardKey.id },
                data: { status: "EXPIRED" },
            });
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "卡密已过期", startTime);
            return createResponse(false, "卡密已过期", null, startTime, ip, userAgent);
        }

        // 检查次数卡
        if (cardKey.type === "COUNT" && cardKey.maxUses && cardKey.usedCount >= cardKey.maxUses) {
            await prisma.cardKey.update({
                where: { id: cardKey.id },
                data: { status: "EXPIRED" },
            });
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "使用次数已用完", startTime);
            return createResponse(false, "使用次数已用完", null, startTime, ip, userAgent);
        }

        // 检查额度卡
        if (cardKey.type === "CREDIT" && cardKey.credits !== null && cardKey.credits <= 0) {
            await prisma.cardKey.update({
                where: { id: cardKey.id },
                data: { status: "EXPIRED" },
            });
            await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "额度已用完", startTime);
            return createResponse(false, "额度已用完", null, startTime, ip, userAgent);
        }

        // 检查设备绑定
        if (cardKey.bindHwid && cardKey.boundHwid) {
            if (hwid !== cardKey.boundHwid) {
                await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "设备不匹配", startTime);
                return createResponse(false, "设备不匹配，此卡密已绑定其他设备", null, startTime, ip, userAgent);
            }
        }

        // 检查 IP 绑定
        if (cardKey.bindIp && cardKey.boundIp) {
            if (ip !== cardKey.boundIp) {
                await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, false, "IP不匹配", startTime);
                return createResponse(false, "IP不匹配，此卡密已绑定其他IP", null, startTime, ip, userAgent);
            }
        }

        // 更新使用次数（次数卡）
        if (cardKey.type === "COUNT") {
            await prisma.cardKey.update({
                where: { id: cardKey.id },
                data: { usedCount: { increment: 1 } },
            });
        }

        // 验证成功，记录日志
        await logVerify(cardKey.id, key, "VERIFY", ip, hwid, userAgent, true, null, startTime);

        // Parse remote config
        let remoteConfigObj = {};
        try {
            remoteConfigObj = JSON.parse(cardKey.product.remoteConfig || '{}');
        } catch (e) {
            console.error("Failed to parse remote config:", e);
        }

        // 准备返回数据
        const latestVersion = cardKey.product.versions[0];
        const announcements = cardKey.product.announcements.map((a: any) => ({
            title: a.title,
            content: a.content,
            type: a.type,
        }));

        const responseData: any = {
            valid: true,
            cardKey: {
                type: cardKey.type,
                status: cardKey.status,
                expiresAt: cardKey.expiresAt,
                remainingUses: cardKey.type === "COUNT" && cardKey.maxUses ? cardKey.maxUses - cardKey.usedCount - 1 : null,
                remainingCredits: cardKey.type === "CREDIT" ? cardKey.credits : null,
            },
            product: {
                name: cardKey.product.name,
                slug: cardKey.product.slug,
                latestVersion: latestVersion?.version || null,
                forceUpdate: latestVersion?.forceUpdate || false,
                currentVersion: version || null,
                needUpdate: latestVersion && version ? latestVersion.version !== version : false,
                remoteConfig: remoteConfigObj,
            },
            announcements,
        };

        // 处理交付内容
        const deliveryType = cardKey.product.deliveryType;
        if (deliveryType === "SCRIPT_DISPLAY" && latestVersion?.scriptContent) {
            let content = latestVersion.scriptContent;

            // 3. 加密交付
            if (cardKey.product.encryptionKey) {
                try {
                    const iv = crypto.randomBytes(16);
                    // 确保 key 是 32 字节 (256 bit)
                    // 如果 key 不够长，可以用 hash 处理，这里假设管理员输入的是合适的 key，或者是简单 string
                    // 为了健壮性，我们可以 hash 一下 key 得到 32 bytes
                    const keyHash = crypto.createHash('sha256').update(cardKey.product.encryptionKey).digest();

                    const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
                    let encrypted = cipher.update(content, 'utf8');
                    encrypted = Buffer.concat([encrypted, cipher.final()]);

                    // 格式: base64(iv + encrypted)
                    const finalBuffer = Buffer.concat([iv, encrypted]);
                    content = finalBuffer.toString('base64');
                } catch (e) {
                    console.error("Encryption failed:", e);
                    return createResponse(false, "服务端加密失败", null, startTime, ip, userAgent);
                }
            }

            responseData.delivery = {
                type: "SCRIPT",
                data: content,
                encrypted: !!cardKey.product.encryptionKey
            };
        } else if (deliveryType === "DOWNLOAD_LINK" && cardKey.product.downloadUrl) {
            responseData.delivery = {
                type: "DOWNLOAD",
                data: cardKey.product.downloadUrl
            };
        } else if (deliveryType === "API_PULL") {
            responseData.delivery = {
                type: "API_PULL",
                data: null
            };
        } else if (deliveryType === "WEBHOOK") {
            responseData.delivery = {
                type: "WEBHOOK",
                data: null
            };

            // 异步触发 Webhook (不阻塞返回)
            if (cardKey.product.webhookUrl) {
                fetch(cardKey.product.webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        event: "verify_success",
                        key: key,
                        product: productSlug,
                        ip: ip,
                        hwid: hwid,
                        timestamp: Date.now()
                    })
                }).catch(err => console.error("Webhook trigger failed:", err));
            }
        }

        return NextResponse.json({
            success: true,
            data: responseData,
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime,
        });
    } catch (error) {
        console.error("验证失败:", error);
        return createResponse(false, "服务器错误", null, startTime, ip, userAgent);
    }
}

async function logVerify(
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

function createResponse(
    success: boolean,
    message: string,
    data: unknown,
    startTime: number,
    ip: string,
    userAgent: string | undefined
) {
    return NextResponse.json({
        success,
        message,
        data,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
    }, { status: success ? 200 : 400 });
}
