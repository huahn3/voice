import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * 清理过期日志 API
 */
export async function POST(req: NextRequest) {
    try {
        // 1. 获取保留时长配置
        const config = await prisma.systemConfig.findUnique({
            where: { key: "log.retention_days" }
        });

        const retentionDays = config ? parseInt(config.value) : 30; // 默认 30 天

        if (retentionDays <= 0) {
            return NextResponse.json({
                success: true,
                message: "保留时长设置为永久或无效 (0)，未执行清理"
            });
        }

        // 2. 计算截止日期
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // 3. 执行删除
        const [verifyDeleted, auditDeleted] = await Promise.all([
            prisma.verifyLog.deleteMany({
                where: { createdAt: { lt: cutoffDate } }
            }),
            prisma.auditLog.deleteMany({
                where: { createdAt: { lt: cutoffDate } }
            })
        ]);

        return NextResponse.json({
            success: true,
            message: `清理完成: 已删除 ${retentionDays} 天之前的日志`,
            details: {
                verifyLogsDeleted: verifyDeleted.count,
                auditLogsDeleted: auditDeleted.count,
                retentionDays,
                cutoffDate: cutoffDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Cleanup] Error:", error);
        return NextResponse.json({ error: "清理失败" }, { status: 500 });
    }
}
