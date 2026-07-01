"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2, Search } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

// 定义 Suspense 边界组件
function AuditLogList() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const page = parseInt(searchParams.get("page") || "1");

    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
    });

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const fetchLogs = async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/logs?page=${p}&limit=20`);
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("加载日志失败", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        router.push(`/admin/logs?page=${newPage}`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-gray-400 text-sm">
                                <th className="p-4 font-medium">时间</th>
                                <th className="p-4 font-medium">操作人</th>
                                <th className="p-4 font-medium">动作</th>
                                <th className="p-4 font-medium">目标 ID</th>
                                <th className="p-4 font-medium">IP</th>
                                <th className="p-4 font-medium">详情</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        加载中...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        暂无日志记录
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition-colors text-gray-300">
                                        <td className="p-4 whitespace-nowrap text-gray-400">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs">
                                                {log.adminId || "System"}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium text-white">
                                            {log.action}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-500">
                                            {log.target || "-"}
                                        </td>
                                        <td className="p-4 text-gray-500">
                                            {log.ip || "unknown"}
                                        </td>
                                        <td className="p-4">
                                            <div className="max-w-xs truncate text-xs text-gray-500 font-mono" title={log.details}>
                                                {log.details}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            显示 {(pagination.page - 1) * pagination.limit + 1} 到 {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-gray-300 hover:text-white disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-400 flex items-center">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-gray-300 hover:text-white disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AuditLogPage() {
    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">操作审计日志</h1>
                    <p className="text-gray-400">记录系统内的所有关键操作</p>
                </div>
            </div>

            <Suspense fallback={<div className="p-12 text-center text-gray-500">加载组件中...</div>}>
                <AuditLogList />
            </Suspense>
        </div>
    );
}
