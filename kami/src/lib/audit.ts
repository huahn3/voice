import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function logAdminAction(
    action: string,
    target: string | null,
    details: any,
    req?: Request
) {
    try {
        const session = await auth();
        const adminId = session?.user?.id || "system"; // Should be user ID if available

        let ip = "unknown";
        if (req) {
            ip = req.headers.get("x-forwarded-for") || "unknown";
        } else {
            const heads = await headers();
            ip = heads.get("x-forwarded-for") || "unknown";
        }

        await prisma.auditLog.create({
            data: {
                adminId,
                action,
                target,
                details: JSON.stringify(details),
                ip,
            },
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
        // Don't throw, just log error so main flow isn't interrupted
    }
}
