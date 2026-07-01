import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

export async function sendNotification(eventType: string, title: string, content: string) {
    try {
        console.log(`[Notification] Preparing to send (${eventType}): ${title}`);

        // 1. Fetch configuration
        const configs = await prisma.systemConfig.findMany({
            where: {
                key: { in: ["notify.channels", "notify.events", "notify.email", "notify.wecom", "notify.gotify"] }
            }
        });

        const configMap = configs.reduce((acc, item) => {
            try {
                acc[item.key] = JSON.parse(item.value);
            } catch (e) {
                console.error(`Failed to parse config for ${item.key}`, e);
            }
            return acc;
        }, {} as Record<string, any>);

        const channels = configMap["notify.channels"] || [];
        const enabledEvents = configMap["notify.events"] || [];

        if (channels.length === 0) {
            console.log("[Notification] No channels enabled");
            return;
        }

        // Check if event is enabled (bypass for "test" event)
        if (eventType !== "test" && !enabledEvents.includes(eventType)) {
            console.log(`[Notification] Event '${eventType}' is disabled, skipping.`);
            return;
        }

        const promises = [];

        // 2. Send via Email
        if (channels.includes("email") && configMap["notify.email"]) {
            promises.push(sendEmail(configMap["notify.email"], title, content));
        }

        // 3. Send via Enterprise WeChat
        if (channels.includes("wecom") && configMap["notify.wecom"]) {
            promises.push(sendWeCom(configMap["notify.wecom"], title, content));
        }

        // 4. Send via Gotify
        if (channels.includes("gotify") && configMap["notify.gotify"]) {
            promises.push(sendGotify(configMap["notify.gotify"], title, content));
        }

        const results = await Promise.allSettled(promises);

        results.forEach((res, index) => {
            if (res.status === "rejected") {
                console.error(`[Notification] Channel ${index} failed:`, res.reason);
            } else {
                console.log(`[Notification] Channel ${index} success`);
            }
        });

    } catch (error) {
        console.error("[Notification] System Error:", error);
    }
}

async function sendEmail(config: any, title: string, content: string) {
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.port === 465, // true for 465, false for other ports
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });

    await transporter.sendMail({
        from: config.from,
        to: config.to,
        subject: `[Kami] ${title}`,
        text: content,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #333;">${title}</h2>
            <p style="white-space: pre-wrap; color: #555;">${content}</p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">Sent by Kami System</p>
        </div>`
    });
}

async function sendWeCom(config: any, title: string, content: string) {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${config.key}`;
    const payload = {
        msgtype: "text",
        text: {
            content: `${title}\n\n${content}`
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`WeCom failed: ${res.statusText}`);
    const data = await res.json();
    if (data.errcode !== 0) throw new Error(`WeCom error: ${data.errmsg}`);
}

async function sendGotify(config: any, title: string, content: string) {
    const url = `${config.url}/message?token=${config.token}`;
    const payload = {
        title: title,
        message: content,
        priority: 5
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Gotify failed: ${res.statusText}`);
}
