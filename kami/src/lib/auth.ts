import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notify";
import { headers } from "next/headers";
import { checkLoginLimit, recordLoginAttempt } from "./login-limit";
import os from "os";

async function getPublicIp() {
    try {
        const res = await fetch("https://api.ipify.org?format=json", { next: { revalidate: 3600 } });
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return "Unknown";
    }
}

function getInternalIps() {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === "IPv4" && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips.length > 0 ? ips.join(", ") : "None";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "用户名", type: "text" },
                password: { label: "密码", type: "password" },
            },
            async authorize(credentials) {
                const headersList = await headers();
                const sourceIp = headersList.get("x-forwarded-for")?.split(",")[0].trim() || headersList.get("x-real-ip") || "unknown";

                // 1. Check Rate Limit
                const limitStatus = await checkLoginLimit(sourceIp);
                if (limitStatus.locked) {
                    throw new Error(`IP_LOCKED:${limitStatus.minutesLeft}`);
                }

                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username as string },
                });

                if (!user) {
                    await recordLoginAttempt(sourceIp, credentials.username as string, false);
                    return null;
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                );

                if (!isValid) {
                    await recordLoginAttempt(sourceIp, credentials.username as string, false);
                    return null;
                }

                // 2. Clear Limit on Success
                await recordLoginAttempt(sourceIp, user.username, true);

                // Trigger Notification
                // Note: This is async but we don't await to avoid blocking login
                Promise.all([getPublicIp(), Promise.resolve(getInternalIps())]).then(([publicIp, internalIps]) => {
                    sendNotification(
                        "admin_login",
                        "管理员登录提示",
                        `监测到管理员账号 ${user.username} 于 ${new Date().toLocaleString()} 成功登录后台。\n` +
                        `------------------\n` +
                        `请求来源 IP: ${sourceIp}\n` +
                        `服务器公网 IP: ${publicIp}\n` +
                        `服务器内网 IP: ${internalIps}`
                    ).catch(err => console.error("Login notify failed:", err));
                });

                return {
                    id: user.id,
                    name: user.username,
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});
