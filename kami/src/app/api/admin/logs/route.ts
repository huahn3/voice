import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        const [total, logs] = await Promise.all([
            prisma.auditLog.count(),
            prisma.auditLog.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Failed to fetch logs:", error);
        return NextResponse.json({ error: "获取日志失败" }, { status: 500 });
    }
}
