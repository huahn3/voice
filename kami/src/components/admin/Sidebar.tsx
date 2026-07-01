"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Package,
    Key,
    ScrollText,
    Bell,
    Settings,
    LogOut,
    KeyRound,
    BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "数据看板" },
    { href: "/admin/products", icon: Package, label: "产品管理" },
    { href: "/admin/cardkeys", icon: Key, label: "卡密管理" },
    { href: "/admin/logs", icon: ScrollText, label: "验证日志" },
    { href: "/admin/announcements", icon: Bell, label: "公告管理" },
    { href: "/admin/guide", icon: BookOpen, label: "使用教程" },
    { href: "/admin/settings", icon: Settings, label: "系统设置" },
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <KeyRound className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white">卡密管理</h1>
                        <p className="text-xs text-gray-500">Card Key System</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                                isActive
                                    ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive && "text-purple-400")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={async () => {
                        await signOut({ redirect: false });
                        window.location.href = "/login";
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all w-full"
                >
                    <LogOut className="w-5 h-5" />
                    退出登录
                </button>
            </div>
        </aside>
    );
}
