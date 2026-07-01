import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// 生成随机卡密
export function generateCardKey(length: number = 24): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除容易混淆的字符
    let result = "";
    for (let i = 0; i < length; i++) {
        if (i > 0 && i % 4 === 0) {
            result += "-";
        }
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 格式化日期
export function formatDate(date: Date | string | null): string {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// 格式化时长
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
    return `${Math.floor(seconds / 86400)}天`;
}

// 获取卡密类型显示名称
export function getCardTypeLabel(type: string): string {
    const map: Record<string, string> = {
        TIME: "时长卡",
        COUNT: "次数卡",
        CREDIT: "额度卡",
    };
    return map[type] || type;
}

// 获取卡密状态显示名称和颜色
export function getCardStatusInfo(status: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        UNUSED: { label: "未使用", color: "bg-gray-500" },
        ACTIVE: { label: "已激活", color: "bg-green-500" },
        FROZEN: { label: "已冻结", color: "bg-blue-500" },
        EXPIRED: { label: "已过期", color: "bg-yellow-500" },
        BANNED: { label: "已封禁", color: "bg-red-500" },
    };
    return map[status] || { label: status, color: "bg-gray-500" };
}

// 获取交付类型显示名称
export function getDeliveryTypeLabel(type: string): string {
    const map: Record<string, string> = {
        DOWNLOAD_LINK: "下载链接",
        API_PULL: "API拉取",
        WEBHOOK: "Webhook推送",
        SCRIPT_DISPLAY: "脚本展示",
    };
    return map[type] || type;
}
