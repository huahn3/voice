import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const configs = await prisma.systemConfig.findMany();
        const configMap = configs.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {} as Record<string, string>);

        return NextResponse.json(configMap);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch configs" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const updates = Object.entries(body).map(([key, value]) => {
            return prisma.systemConfig.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
        });

        await prisma.$transaction(updates);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save configs" }, { status: 500 });
    }
}
