import prisma from "./prisma";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * 检查 IP 是否被锁定
 */
export async function checkLoginLimit(ip: string) {
    const attempt = await prisma.loginAttempt.findUnique({
        where: { ip }
    });

    if (!attempt) return { locked: false };

    if (attempt.isLocked && attempt.lockedUntil) {
        if (new Date() < attempt.lockedUntil) {
            return {
                locked: true,
                minutesLeft: Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60000)
            };
        } else {
            // 时间已到，自动解锁
            await prisma.loginAttempt.update({
                where: { ip },
                data: { isLocked: false, lockedUntil: null, attempts: 0 }
            });
            return { locked: false };
        }
    }

    return { locked: false };
}

/**
 * 记录登录尝试
 */
export async function recordLoginAttempt(ip: string, username: string, success: boolean) {
    const attempt = await prisma.loginAttempt.findUnique({
        where: { ip }
    });

    if (success) {
        // 成功时重置计数
        if (attempt) {
            await prisma.loginAttempt.update({
                where: { ip },
                data: { attempts: 0, isLocked: false, lockedUntil: null }
            });
        }
    } else {
        // 失败时增加计数
        if (!attempt) {
            await prisma.loginAttempt.create({
                data: { ip, username, attempts: 1 }
            });
        } else {
            const newAttempts = attempt.attempts + 1;
            const isLocked = newAttempts >= MAX_ATTEMPTS;
            const lockedUntil = isLocked ? new Date(Date.now() + LOCK_DURATION) : null;

            await prisma.loginAttempt.update({
                where: { ip },
                data: {
                    username,
                    attempts: newAttempts,
                    isLocked,
                    lockedUntil
                }
            });
        }
    }
}
