"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Bell, AlertTriangle, AlertCircle } from "lucide-react";

interface Announcement {
    id: string;
    productId: string | null;
    title: string;
    content: string;
    type: string;
    isActive: boolean;
    createdAt: string;
    product?: { name: string } | null;
}

interface Product {
    id: string;
    name: string;
}

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [formData, setFormData] = useState({
        productId: "",
        title: "",
        content: "",
        type: "INFO",
        isActive: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const [announcementsRes, productsRes] = await Promise.all([
            fetch("/api/admin/announcements"),
            fetch("/api/admin/products"),
        ]);
        setAnnouncements(await announcementsRes.json());
        setProducts(await productsRes.json());
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = editing ? "PUT" : "POST";
        const url = editing
            ? `/api/admin/announcements/${editing.id}`
            : "/api/admin/announcements";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...formData,
                productId: formData.productId || null,
            }),
        });

        setShowForm(false);
        setEditing(null);
        setFormData({ productId: "", title: "", content: "", type: "INFO", isActive: true });
        fetchData();
    };

    const handleEdit = (announcement: Announcement) => {
        setEditing(announcement);
        setFormData({
            productId: announcement.productId || "",
            title: announcement.title,
            content: announcement.content,
            type: announcement.type,
            isActive: announcement.isActive,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("确定删除这条公告吗？")) return;
        await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
        fetchData();
    };

    const typeIcons: Record<string, React.ReactNode> = {
        INFO: <Bell className="w-4 h-4 text-blue-400" />,
        WARNING: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
        CRITICAL: <AlertCircle className="w-4 h-4 text-red-400" />,
    };

    const typeColors: Record<string, string> = {
        INFO: "border-blue-500/30 bg-blue-500/10",
        WARNING: "border-yellow-500/30 bg-yellow-500/10",
        CRITICAL: "border-red-500/30 bg-red-500/10",
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">公告管理</h1>
                    <p className="text-gray-400 mt-1">管理验证时返回的公告信息</p>
                </div>
                <button
                    onClick={() => {
                        setEditing(null);
                        setFormData({ productId: "", title: "", content: "", type: "INFO", isActive: true });
                        setShowForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    新建公告
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-lg">
                        <h2 className="text-lg font-semibold text-white mb-4">
                            {editing ? "编辑公告" : "新建公告"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">关联产品</label>
                                <select
                                    value={formData.productId}
                                    onChange={(e) => setFormData((f) => ({ ...f, productId: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value="">全局公告</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">标题</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">内容</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))}
                                    rows={4}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">类型</label>
                                <div className="flex gap-3">
                                    {["INFO", "WARNING", "CRITICAL"].map((type) => (
                                        <label
                                            key={type}
                                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.type === type
                                                ? typeColors[type]
                                                : "border-slate-700 bg-slate-800"
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                value={type}
                                                checked={formData.type === type}
                                                onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                                                className="sr-only"
                                            />
                                            {typeIcons[type]}
                                            <span className="text-sm text-white">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all"
                                >
                                    {editing ? "保存" : "创建"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg transition-all"
                                >
                                    取消
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-8">加载中...</div>
                ) : announcements.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">暂无公告</div>
                ) : (
                    announcements.map((announcement: any) => (
                        <div
                            key={announcement.id}
                            className={`rounded-xl border p-4 ${typeColors[announcement.type]} ${!announcement.isActive ? "opacity-50" : ""
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    {typeIcons[announcement.type]}
                                    <div>
                                        <h3 className="font-medium text-white">{announcement.title}</h3>
                                        <p className="text-sm text-gray-400 mt-1">{announcement.content}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                            <span>{announcement.product?.name || "全局"}</span>
                                            <span>·</span>
                                            <span>{announcement.isActive ? "已启用" : "已禁用"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(announcement)}
                                        className="p-2 rounded hover:bg-slate-700 text-gray-400 hover:text-white transition-all"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(announcement.id)}
                                        className="p-2 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
