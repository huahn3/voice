"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const deliveryTypes = [
    { value: "SCRIPT_DISPLAY", label: "脚本展示", desc: "直接返回脚本内容" },
    { value: "DOWNLOAD_LINK", label: "下载链接", desc: "返回下载地址" },
    { value: "API_PULL", label: "API拉取", desc: "客户端通过API获取" },
    { value: "WEBHOOK", label: "Webhook推送", desc: "推送到指定地址" },
];

export default function NewProductPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        description: "",
        deliveryType: "SCRIPT_DISPLAY",
        downloadUrl: "",
        webhookUrl: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/admin/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const product = await res.json();
                router.push(`/admin/products/${product.id}`);
            } else {
                const error = await res.json();
                alert(error.error || "创建失败");
            }
        } catch {
            alert("创建失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Auto-generate slug from name
        if (name === "name") {
            const slug = value
                .toLowerCase()
                .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
                .replace(/^-|-$/g, "");
            setFormData((prev) => ({ ...prev, slug }));
        }
    };

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <Link
                    href="/admin/products"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回产品列表
                </Link>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                <h1 className="text-xl font-bold text-white mb-6">新建产品</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            产品名称 <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            placeholder="例如：自动化脚本V2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            唯一标识 (slug) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="slug"
                            value={formData.slug}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            placeholder="auto-script-v2"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">用于API调用的唯一标识符</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            产品描述
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                            placeholder="描述一下这个产品的用途..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            交付方式
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {deliveryTypes.map((type) => (
                                <label
                                    key={type.value}
                                    className={`relative flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${formData.deliveryType === type.value
                                            ? "border-purple-500 bg-purple-500/10"
                                            : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="deliveryType"
                                        value={type.value}
                                        checked={formData.deliveryType === type.value}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <span className="text-sm font-medium text-white">{type.label}</span>
                                    <span className="text-xs text-gray-500 mt-1">{type.desc}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {formData.deliveryType === "DOWNLOAD_LINK" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                下载链接
                            </label>
                            <input
                                type="url"
                                name="downloadUrl"
                                value={formData.downloadUrl}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="https://example.com/download/script.zip"
                            />
                        </div>
                    )}

                    {formData.deliveryType === "WEBHOOK" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Webhook 地址
                            </label>
                            <input
                                type="url"
                                name="webhookUrl"
                                value={formData.webhookUrl}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="https://example.com/webhook"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                "创建产品"
                            )}
                        </button>
                        <Link
                            href="/admin/products"
                            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium rounded-lg transition-all"
                        >
                            取消
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
