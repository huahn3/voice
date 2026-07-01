import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptScript, encryptWithDerivedKey, deriveKeyFromCardKey } from "@/lib/crypto";

// 获取脚本内容 API
export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    try {
        const body = await req.json();
        const { key, product: productSlug, hwid, version, channel = "STABLE" } = body;

        if (!key) {
            return NextResponse.json({ success: false, message: "卡密不能为空" }, { status: 400 });
        }

        // 查找卡密
        const cardKey = await prisma.cardKey.findUnique({
            where: { key },
            include: { product: true },
        });

        if (!cardKey) {
            return NextResponse.json({ success: false, message: "卡密不存在" }, { status: 404 });
        }

        // 验证状态
        if (cardKey.status !== "ACTIVE") {
            return NextResponse.json({ success: false, message: "卡密状态异常" }, { status: 400 });
        }

        // 验证产品
        if (productSlug && cardKey.product.slug !== productSlug) {
            return NextResponse.json({ success: false, message: "产品不匹配" }, { status: 400 });
        }

        // 验证设备
        if (cardKey.bindHwid && cardKey.boundHwid && hwid !== cardKey.boundHwid) {
            return NextResponse.json({ success: false, message: "设备不匹配" }, { status: 400 });
        }

        // 获取指定版本的脚本内容
        const productVersion = await prisma.productVersion.findFirst({
            where: {
                productId: cardKey.productId,
                channel,
                isActive: true,
            },
            orderBy: { createdAt: "desc" },
        });

        if (!productVersion || !productVersion.scriptContent) {
            return NextResponse.json({ success: false, message: "脚本内容不存在" }, { status: 404 });
        }

        // 解密存储的脚本内容
        const decryptedContent = decryptScript(productVersion.scriptContent);

        // 使用卡密派生密钥进行二次加密（防止传输泄露）
        const derivedKey = deriveKeyFromCardKey(key, ip);
        const { encrypted, iv } = encryptWithDerivedKey(decryptedContent, derivedKey);

        return NextResponse.json({
            success: true,
            data: {
                version: productVersion.version,
                channel: productVersion.channel,
                encrypted,
                iv,
                // 客户端需要使用相同的密钥派生方式解密
                hint: "使用卡密 + 请求IP 派生密钥解密",
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("获取脚本失败:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
    }
}
