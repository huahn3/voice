"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Copy, Check } from "lucide-react";

interface Product {
    id: string;
    name: string;
    slug: string;
}

const cardTypes = [
    { value: "TIME", label: "时长卡", desc: "按时间有效期" },
    { value: "COUNT", label: "次数卡", desc: "按使用次数" },
    { value: "CREDIT", label: "额度卡", desc: "按点数消耗" },
];

const durationPresets = [
    { label: "1天", value: 86400 },
    { label: "7天", value: 604800 },
    { label: "30天", value: 2592000 },
    { label: "90天", value: 7776000 },
    { label: "365天", value: 31536000 },
    { label: "永久", value: 315360000 },
];

export default function GenerateCardKeysPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        productId: "",
        count: 10,
        type: "TIME",
        duration: 2592000, // 30天
        maxUses: 100,
        credits: 1000,
        bindHwid: false,
        bindIp: false,
        maxDevices: 1,
        remark: "",
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const res = await fetch("/api/admin/products");
        const data = await res.json();
        setProducts(data);
        if (data.length > 0) {
            setFormData((f) => ({ ...f, productId: data[0].id }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setGenerated([]);

        try {
            const res = await fetch("/api/admin/cardkeys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const data = await res.json();
                setGenerated(data.cardKeys.map((c: { key: string }) => c.key));
            } else {
                const error = await res.json();
                alert(error.error || "生成失败");
            }
        } catch {
            alert("生成失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    const copyAll = () => {
        navigator.clipboard.writeText(generated.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-4xl">
            <div className="mb-6">
                <Link
                    href="/admin/cardkeys"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回卡密列表
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                    <h1 className="text-xl font-bold text-white mb-6">生成卡密</h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                选择产品 <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={formData.productId}
                                onChange={(e) =>
                                    setFormData((f) => ({ ...f, productId: e.target.value }))
                                }
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                            >
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                生成数量
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={formData.count}
                                onChange={(e) =>
                                    setFormData((f) => ({ ...f, count: parseInt(e.target.value) || 1 }))
                                }
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">单次最多生成 100 个</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                卡密类型
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {cardTypes.map((type) => (
                                    <label
                                        key={type.value}
                                        className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${formData.type === type.value
                                                ? "border-purple-500 bg-purple-500/10"
                                                : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            value={type.value}
                                            checked={formData.type === type.value}
                                            onChange={(e) =>
                                                setFormData((f) => ({ ...f, type: e.target.value }))
                                            }
                                            className="sr-only"
                                        />
                                        <span className="text-sm font-medium text-white">{type.label}</span>
                                        <span className="text-xs text-gray-500">{type.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {formData.type === "TIME" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    有效时长
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {durationPresets.map((preset) => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() =>
                                                setFormData((f) => ({ ...f, duration: preset.value }))
                                            }
                                            className={`px-3 py-2 rounded-lg text-sm transition-all ${formData.duration === preset.value
                                                    ? "bg-purple-500 text-white"
                                                    : "bg-slate-800 text-gray-400 hover:bg-slate-700"
                                                }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.type === "COUNT" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    最大使用次数
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={formData.maxUses}
                                    onChange={(e) =>
                                        setFormData((f) => ({ ...f, maxUses: parseInt(e.target.value) || 1 }))
                                    }
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        )}

                        {formData.type === "CREDIT" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    初始额度（点数）
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={formData.credits}
                                    onChange={(e) =>
                                        setFormData((f) => ({ ...f, credits: parseInt(e.target.value) || 1 }))
                                    }
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.bindHwid}
                                    onChange={(e) =>
                                        setFormData((f) => ({ ...f, bindHwid: e.target.checked }))
                                    }
                                    className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-300">绑定设备指纹 (HWID)</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.bindIp}
                                    onChange={(e) =>
                                        setFormData((f) => ({ ...f, bindIp: e.target.checked }))
                                    }
                                    className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-300">绑定 IP 地址</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                备注（可选）
                            </label>
                            <input
                                type="text"
                                value={formData.remark}
                                onChange={(e) => setFormData((f) => ({ ...f, remark: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="例如：测试用、XX活动等"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !formData.productId}
                            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    生成中...
                                </>
                            ) : (
                                `生成 ${formData.count} 个卡密`
                            )}
                        </button>
                    </form>
                </div>

                {/* Generated Result */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">生成结果</h2>
                        {generated.length > 0 && (
                            <button
                                onClick={copyAll}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm transition-all"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-400" />
                                        已复制
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        复制全部
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {generated.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            生成的卡密将显示在这里
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {generated.map((key, index) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-6">{index + 1}</span>
                                        <code className="text-sm text-purple-300 font-mono">{key}</code>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(key);
                                        }}
                                        className="p-1.5 rounded hover:bg-slate-700 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
