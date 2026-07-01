import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, message: "密码不能为空" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json({ success: false, message: "用户不存在" }, { status: 404 });
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

        if (!isValid) {
            return NextResponse.json({ success: false, message: "当前密码错误" }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        return NextResponse.json({ success: true, message: "密码修改成功" });
    } catch (error) {
        console.error("修改密码失败:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
    }
}
