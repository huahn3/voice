"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Plus,
    Search,
    Filter,
    Copy,
    MoreHorizontal,
    Trash2,
    Lock,
    Unlock,
    Ban,
    CheckCircle,
} from "lucide-react";
import { cn, formatDate, getCardTypeLabel, getCardStatusInfo, formatDuration } from "@/lib/utils";
import DropdownMenu from "@/components/admin/DropdownMenu";

interface CardKey {
    id: string;
    key: string;
    type: string;
    status: string;
    duration: number | null;
    maxUses: number | null;
    usedCount: number;
    credits: number | null;
    bindHwid: boolean;
    boundHwid: string | null;
    expiresAt: string | null;
    createdAt: string;
    product: {
        id: string;
        name: string;
        slug: string;
    };
}

interface Product {
    id: string;
    name: string;
    slug: string;
}

export default function CardKeysPage() {
    const [cardKeys, setCardKeys] = useState<CardKey[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [filters, setFilters] = useState({
        productId: "",
        status: "",
        type: "",
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        fetchCardKeys();
    }, [filters, pagination.page]);

    const fetchProducts = async () => {
        const res = await fetch("/api/admin/products");
        const data = await res.json();
        setProducts(data);
    };

    const fetchCardKeys = async () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: pagination.page.toString(),
            limit: pagination.limit.toString(),
        });
        if (filters.productId) params.set("productId", filters.productId);
        if (filters.status) params.set("status", filters.status);
        if (filters.type) params.set("type", filters.type);

        const res = await fetch(`/api/admin/cardkeys?${params}`);
        const data = await res.json();
        setCardKeys(data.data);
        setPagination(data.pagination);
        setLoading(false);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === cardKeys.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(cardKeys.map((c) => c.id));
        }
    };

    const handleSelect = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleSingleAction = async (id: string, action: string) => {
        if (!confirm("确定执行此操作吗？")) return;

        await fetch("/api/admin/cardkeys/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [id], action }),
        });
        fetchCardKeys();
    };

    const handleBatchAction = async (action: string) => {
        if (selectedIds.length === 0) return;

        const confirmed = confirm(`确定要对 ${selectedIds.length} 个卡密执行此操作吗？`);
        if (!confirmed) return;

        await fetch("/api/admin/cardkeys/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedIds, action }),
        });

        setSelectedIds([]);
        fetchCardKeys();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">卡密管理</h1>
                    <p className="text-gray-400 mt-1">管理所有卡密的生成、查询和状态</p>
                </div>
                <Link
                    href="/admin/cardkeys/generate"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    生成卡密
                </Link>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
                    <Search className="w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="搜索卡密..."
                        className="bg-transparent border-none outline-none text-white placeholder-gray-500 w-48"
                    />
                </div>

                <select
                    value={filters.productId}
                    onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white"
                >
                    <option value="">全部产品</option>
                    {products.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>

                <select
                    value={filters.status}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white"
                >
                    <option value="">全部状态</option>
                    <option value="UNUSED">未使用</option>
                    <option value="ACTIVE">已激活</option>
                    <option value="FROZEN">已冻结</option>
                    <option value="EXPIRED">已过期</option>
                    <option value="BANNED">已封禁</option>
                </select>

                <select
                    value={filters.type}
                    onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white"
                >
                    <option value="">全部类型</option>
                    <option value="TIME">时长卡</option>
                    <option value="COUNT">次数卡</option>
                    <option value="CREDIT">额度卡</option>
                </select>
            </div>

            {/* Batch Actions */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <span className="text-purple-300">已选择 {selectedIds.length} 项</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBatchAction("freeze")}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
                    >
                        <Lock className="w-4 h-4" />
                        冻结
                    </button>
                    <button
                        onClick={() => handleBatchAction("unfreeze")}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
                    >
                        <Unlock className="w-4 h-4" />
                        解冻
                    </button>
                    <button
                        onClick={() => handleBatchAction("ban")}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                    >
                        <Ban className="w-4 h-4" />
                        封禁
                    </button>
                    <button
                        onClick={() => handleBatchAction("delete")}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        删除
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="p-4 text-left">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === cardKeys.length && cardKeys.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded bg-slate-800 border-slate-700"
                                />
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">卡密</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">产品</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">类型</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">状态</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">额度/次数</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">创建时间</th>
                            <th className="p-4 text-left text-sm font-medium text-gray-400">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        ) : cardKeys.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    暂无卡密
                                </td>
                            </tr>
                        ) : (
                            cardKeys.map((cardKey: any) => {
                                const statusInfo = getCardStatusInfo(cardKey.status);
                                return (
                                    <tr
                                        key={cardKey.id}
                                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all"
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(cardKey.id)}
                                                onChange={() => handleSelect(cardKey.id)}
                                                className="rounded bg-slate-800 border-slate-700"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm text-purple-300 font-mono">
                                                    {cardKey.key}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(cardKey.key, cardKey.id)}
                                                    className="p-1 rounded hover:bg-slate-700 text-gray-500 hover:text-white transition-all"
                                                >
                                                    {copiedId === cardKey.id ? (
                                                        <CheckCircle className="w-3 h-3 text-green-400" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-300">{cardKey.product.name}</td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {getCardTypeLabel(cardKey.type)}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center px-2 py-1 rounded text-xs",
                                                    statusInfo.color + "/20",
                                                    "text-white"
                                                )}
                                            >
                                                <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusInfo.color)} />
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {cardKey.type === "TIME" && cardKey.duration
                                                ? formatDuration(cardKey.duration)
                                                : cardKey.type === "COUNT"
                                                    ? `${cardKey.usedCount}/${cardKey.maxUses}`
                                                    : cardKey.type === "CREDIT"
                                                        ? `${cardKey.credits} 点`
                                                        : "-"}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {formatDate(cardKey.createdAt)}
                                        </td>
                                        <td className="p-4">
                                            <DropdownMenu
                                                trigger="horizontal"
                                                items={[
                                                    {
                                                        label: "冻结",
                                                        icon: <Lock className="w-4 h-4" />,
                                                        onClick: () => handleSingleAction(cardKey.id, "freeze"),
                                                    },
                                                    {
                                                        label: "解冻",
                                                        icon: <Unlock className="w-4 h-4" />,
                                                        onClick: () => handleSingleAction(cardKey.id, "unfreeze"),
                                                    },
                                                    {
                                                        label: "封禁",
                                                        icon: <Ban className="w-4 h-4" />,
                                                        onClick: () => handleSingleAction(cardKey.id, "ban"),
                                                        className: "text-red-400 hover:bg-red-500/10",
                                                    },
                                                    {
                                                        label: "删除",
                                                        icon: <Trash2 className="w-4 h-4" />,
                                                        onClick: () => handleSingleAction(cardKey.id, "delete"),
                                                        className: "text-red-400 hover:bg-red-500/10",
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-gray-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            上一页
                        </button>
                        <button
                            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-gray-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
