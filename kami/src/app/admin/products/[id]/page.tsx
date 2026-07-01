"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation"; // Changed imports
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

const deliveryTypes = [
    { value: "SCRIPT_DISPLAY", label: "脚本展示", desc: "直接返回脚本内容" },
    { value: "DOWNLOAD_LINK", label: "下载链接", desc: "返回下载地址" },
    { value: "API_PULL", label: "API拉取", desc: "客户端通过API获取" },
    { value: "WEBHOOK", label: "Webhook推送", desc: "推送到指定地址" },
];

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [versions, setVersions] = useState<any[]>([]);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [versionForm, setVersionForm] = useState({
        version: "",
        channel: "STABLE",
        scriptContent: "",
        releaseNotes: "",
        forceUpdate: false
    });

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        description: "",
        deliveryType: "SCRIPT_DISPLAY",
        downloadUrl: "",
        webhookUrl: "",
        encryptionKey: "",
        isActive: true,
    });
    const [remoteConfig, setRemoteConfig] = useState({
        enableSearch: true,
    });

    useEffect(() => {
        if (id) {
            fetchProduct(id);
        }
    }, [id]);

    const fetchProduct = async (productId: string) => {
        try {
            const res = await fetch(`/api/admin/products/${productId}`);
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    name: data.name,
                    slug: data.slug,
                    description: data.description || "",
                    deliveryType: data.deliveryType,
                    downloadUrl: data.downloadUrl || "",
                    webhookUrl: data.webhookUrl || "",
                    encryptionKey: data.encryptionKey || "",
                    isActive: data.isActive,
                });
                
                try {
                    const rc = data.remoteConfig ? JSON.parse(data.remoteConfig) : {};
                    setRemoteConfig({
                        enableSearch: rc.enableSearch !== undefined ? rc.enableSearch : true,
                        ...rc // Keep other keys if any
                    });
                } catch (e) {
                    console.error("Failed to parse remote config", e);
                }

                setVersions(data.versions || []);
            } else {
                alert("加载产品失败");
                router.push("/admin/products");
            }
        } catch (error) {
            console.error(error);
            alert("加载产品出错");
        } finally {
            setFetching(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                remoteConfig: JSON.stringify(remoteConfig)
            };

            const res = await fetch(`/api/admin/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert("更新成功");
                router.refresh();
            } else {
                const error = await res.json();
                alert(error.error || "更新失败");
            }
        } catch {
            alert("更新失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("确定要删除这个产品吗？所有相关卡密和版本都将被删除！")) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/products/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                alert("删除成功");
                router.push("/admin/products");
            } else {
                alert("删除失败");
            }
        } catch {
            alert("删除出错");
        } finally {
            setLoading(false);
        }
    }

    const handleCreateVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirm("确认发布新版本？")) return;

        try {
            const res = await fetch(`/api/admin/products/${id}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(versionForm)
            });

            if (res.ok) {
                alert("版本发布成功");
                setShowVersionModal(false);
                setVersionForm({
                    version: "",
                    channel: "STABLE",
                    scriptContent: "",
                    releaseNotes: "",
                    forceUpdate: false
                });
                fetchProduct(id); // Reload list
            } else {
                const data = await res.json();
                alert(data.error || "发布失败");
            }
        } catch {
            alert("系统错误");
        }
    };

    const handleDeleteVersion = async (versionId: string) => {
        if (!confirm("确定删除此版本？")) return;
        try {
            const res = await fetch(`/api/admin/versions/${versionId}`, { method: "DELETE" });
            if (res.ok) fetchProduct(id);
            else alert("删除失败");
        } catch {
            alert("删除出错");
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <Link
                    href="/admin/products"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回产品列表
                </Link>

                <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                >
                    <Trash2 className="w-4 h-4" />
                    删除产品
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Form - Left Side */}
                <div className="lg:col-span-1 rounded-xl bg-slate-900 border border-slate-800 p-6 h-fit">
                    <h1 className="text-xl font-bold text-white mb-6">基本信息</h1>

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
                                required
                            />
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
                            />
                        </div>

                        {formData.deliveryType === "SCRIPT_DISPLAY" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    加密密钥 (可选)
                                </label>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        name="encryptionKey"
                                        value={formData.encryptionKey}
                                        onChange={handleChange}
                                        placeholder="用于加密脚本内容 (AES-256)"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                    <p className="text-xs text-gray-500">
                                        如果设置了密钥，脚本内容将使用 AES-256-CBC 加密后返回。
                                        客户端需使用相同密钥解密。留空则直接返回脚本内容。
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                交付方式
                            </label>
                            <div className="space-y-3">
                                {deliveryTypes.map((type) => (
                                    <label
                                        key={type.value}
                                        className={`relative flex items-center p-3 rounded-lg border cursor-pointer transition-all ${formData.deliveryType === type.value
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
                                        <div>
                                            <div className="text-sm font-medium text-white">{type.label}</div>
                                            <div className="text-xs text-gray-500">{type.desc}</div>
                                        </div>
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
                                />
                            </div>
                        )}

                        {/* Remote Config */}
                        <div>
                            <h2 className="text-sm font-medium text-gray-300 mb-4 pt-4 border-t border-slate-700">远程控制</h2>
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <div className="text-white font-medium">开启搜索接口</div>
                                        <div className="text-xs text-gray-500">关闭后客户端将无法使用搜索功能</div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={remoteConfig.enableSearch}
                                            onChange={(e) => setRemoteConfig(prev => ({ ...prev, enableSearch: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData(f => ({ ...f, isActive: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-300">启用该产品</span>
                            </label>
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    "保存修改"
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Version Management - Right Side */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 min-h-[500px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">版本管理</h2>
                            <button
                                onClick={() => setShowVersionModal(true)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-all border border-slate-700"
                            >
                                + 发布新版本
                            </button>
                        </div>

                        {versions.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 text-sm border-2 border-dashed border-slate-800 rounded-xl">
                                <p>暂无版本记录</p>
                                <p className="mt-1">点击右上角发布第一个版本</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {versions.map((ver) => (
                                    <div key={ver.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 flex items-start justify-between group">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-mono font-bold text-white text-lg">v{ver.version}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs border ${ver.channel === 'STABLE' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    ver.channel === 'BETA' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {ver.channel}
                                                </span>
                                                {ver.forceUpdate && <span className="text-xs text-red-400">强制更新</span>}
                                            </div>
                                            <div className="text-sm text-gray-400 mb-2">
                                                发布于 {new Date(ver.createdAt).toLocaleString()}
                                            </div>
                                            {ver.releaseNotes && (
                                                <div className="text-sm text-gray-300 bg-slate-900/50 p-3 rounded-lg max-w-xl whitespace-pre-wrap">
                                                    {ver.releaseNotes}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteVersion(ver.id)}
                                            className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Version Modal */}
            {showVersionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                            <h3 className="text-lg font-bold text-white">发布新版本</h3>
                            <button onClick={() => setShowVersionModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreateVersion} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">版本号</label>
                                    <input
                                        type="text"
                                        value={versionForm.version}
                                        onChange={e => setVersionForm(f => ({ ...f, version: e.target.value }))}
                                        placeholder="1.0.0"
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">发布渠道</label>
                                    <select
                                        value={versionForm.channel}
                                        onChange={e => setVersionForm(f => ({ ...f, channel: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    >
                                        <option value="STABLE">Stable (稳定版)</option>
                                        <option value="BETA">Beta (测试版)</option>
                                        <option value="DEV">Dev (开发版)</option>
                                    </select>
                                </div>
                            </div>

                            {formData.deliveryType === "SCRIPT_DISPLAY" && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        脚本内容 (将加密存储)
                                    </label>
                                    <textarea
                                        value={versionForm.scriptContent}
                                        onChange={e => setVersionForm(f => ({ ...f, scriptContent: e.target.value }))}
                                        rows={10}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
                                        placeholder="在此粘贴您的脚本代码..."
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">更新日志</label>
                                <textarea
                                    value={versionForm.releaseNotes}
                                    onChange={e => setVersionForm(f => ({ ...f, releaseNotes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    placeholder="修复了什么bug，更新了什么功能..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="forceUpdate"
                                    checked={versionForm.forceUpdate}
                                    onChange={e => setVersionForm(f => ({ ...f, forceUpdate: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-purple-600"
                                />
                                <label htmlFor="forceUpdate" className="text-sm text-gray-300">强制更新 (旧版本将无法登录)</label>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowVersionModal(false)}
                                    className="px-6 py-2 rounded-lg bg-slate-800 text-gray-300 hover:bg-slate-700"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-medium"
                                >
                                    确认发布
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
