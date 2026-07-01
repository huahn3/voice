import { NextRequest, NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, content } = body;

        await sendNotification("test", title || "Test Notification", content || "This is a test message from Kami System.");

        return NextResponse.json({ success: true, message: "Notification sent (check server logs for details)" });
    } catch (error) {
        console.error("Test notification failed:", error);
        return NextResponse.json({ success: false, message: "Failed to send notification" }, { status: 500 });
    }
}
