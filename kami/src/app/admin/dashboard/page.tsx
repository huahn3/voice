import prisma from "@/lib/prisma";
import {
    Package,
    Key,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Activity,
} from "lucide-react";

async function getStats() {
    const [
        productCount,
        totalCardKeys,
        activeCardKeys,
        unusedCardKeys,
        todayLogs,
        recentLogs,
        activeDevicesCount,
    ] = await Promise.all([
        prisma.product.count(),
        prisma.cardKey.count(),
        prisma.cardKey.count({ where: { status: "ACTIVE" } }),
        prisma.cardKey.count({ where: { status: "UNUSED" } }),
        prisma.verifyLog.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
        prisma.verifyLog.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: { cardKey: { include: { product: true } } },
        }),
        prisma.verifyLog.groupBy({
            by: ['hwid'],
            where: {
                action: 'HEARTBEAT',
                createdAt: {
                    gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours (Daily Active Users)
                }
            },
        }).then(res => res.length),
    ]);

    return {
        productCount,
        totalCardKeys,
        activeCardKeys,
        unusedCardKeys,
        todayLogs,
        recentLogs,
        activeDevicesCount,
    };
}

export default async function DashboardPage() {
    const stats = await getStats();

    const statCards = [
        {
            title: "在线设备",
            value: stats.activeDevicesCount,
            icon: Activity,
            color: "from-indigo-500 to-violet-500",
            shadowColor: "shadow-indigo-500/20",
        },
        {
            title: "产品数量",
            value: stats.productCount,
            icon: Package,
            color: "from-blue-500 to-cyan-500",
            shadowColor: "shadow-blue-500/20",
        },
        {
            title: "卡密总数",
            value: stats.totalCardKeys,
            icon: Key,
            color: "from-purple-500 to-pink-500",
            shadowColor: "shadow-purple-500/20",
        },
        {
            title: "已激活",
            value: stats.activeCardKeys,
            icon: CheckCircle,
            color: "from-green-500 to-emerald-500",
            shadowColor: "shadow-green-500/20",
        },
        {
            title: "未使用",
            value: stats.unusedCardKeys,
            icon: AlertCircle,
            color: "from-yellow-500 to-orange-500",
            shadowColor: "shadow-yellow-500/20",
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">数据看板</h1>
                <p className="text-gray-400 mt-1">系统运行概览</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <div
                        key={stat.title}
                        className={`relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-lg ${stat.shadowColor}`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">{stat.title}</p>
                                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                            </div>
                            <div
                                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                            >
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div
                            className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl`}
                        />
                    </div>
                ))}
            </div>

            {/* Today's Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">今日验证</h2>
                            <p className="text-sm text-gray-400">24小时内的验证请求</p>
                        </div>
                    </div>
                    <div className="text-center py-8">
                        <p className="text-5xl font-bold text-white">{stats.todayLogs}</p>
                        <p className="text-gray-400 mt-2">次验证请求</p>
                    </div>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">最近活动</h2>
                            <p className="text-sm text-gray-400">最近的验证记录</p>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {stats.recentLogs.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">暂无记录</p>
                        ) : (
                            stats.recentLogs.map((log: any) => (
                                <div
                                    key={log.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-2 h-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"
                                                }`}
                                        />
                                        <div>
                                            <p className="text-sm text-white">
                                                {log.cardKey?.product?.name || "未知产品"}
                                            </p>
                                            <p className="text-xs text-gray-500">{log.ip}</p>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${log.success
                                            ? "bg-green-500/10 text-green-400"
                                            : "bg-red-500/10 text-red-400"
                                            }`}
                                    >
                                        {log.action}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
