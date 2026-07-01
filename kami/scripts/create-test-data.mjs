// 创建测试数据脚本
// 运行: node scripts/create-test-data.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "prisma", "dev.db");

const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    // 1. 创建测试产品
    const productSlug = "test-product";
    let product = await prisma.product.findUnique({
        where: { slug: productSlug },
    });

    if (!product) {
        product = await prisma.product.create({
            data: {
                name: "测试产品",
                slug: productSlug,
                deliveryType: "SCRIPT_DISPLAY",
                isActive: true,
            },
        });
        console.log(`✅ 创建测试产品: ${product.name}`);
    } else {
        console.log(`ℹ️ 测试产品已存在: ${product.name}`);
    }

    // 2. 创建测试版本
    await prisma.productVersion.upsert({
        where: {
            productId_version_channel: {
                productId: product.id,
                version: "1.0.0",
                channel: "STABLE",
            },
        },
        update: {},
        create: {
            productId: product.id,
            version: "1.0.0",
            channel: "STABLE",
            isActive: true,
            scriptContent: "U2FsdGVkX19...", // 模拟加密内容
        },
    });

    // 3. 创建测试卡密
    const key = "TEST-KEY-123456";
    const existingKey = await prisma.cardKey.findUnique({
        where: { key },
    });

    if (existingKey) {
        await prisma.cardKey.delete({ where: { key } });
        console.log("ℹ️ 删除旧测试卡密");
    }

    await prisma.cardKey.create({
        data: {
            productId: product.id,
            key: key,
            type: "TIME",
            duration: 3600 * 24, // 1天
            status: "UNUSED",
            bindHwid: true,
            bindIp: true,
        },
    });

    console.log(`✅ 创建测试卡密: ${key}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
