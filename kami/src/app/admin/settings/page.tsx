"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Code, Copy, Check, Bell, Shield } from "lucide-react";

interface BlacklistRule {
    id: string;
    type: string;
    value: string;
    reason: string | null;
}

interface Product {
    id: string;
    name: string;
    slug: string;
}

interface NotifyConfig {
    channels: string[];
    events: string[];
    email: {
        host: string;
        port: number;
        user: string;
        pass: string;
        from: string;
        to: string;
    };
    wecom: {
        key: string;
    };
    gotify: {
        url: string;
        token: string;
    };
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("blacklist");
    const [blacklist, setBlacklist] = useState<BlacklistRule[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [newRule, setNewRule] = useState({ type: "IP", value: "", reason: "" });
    const [copied, setCopied] = useState(false);
    const [notifyConfig, setNotifyConfig] = useState<NotifyConfig>({
        channels: [],
        events: [],
        email: { host: "", port: 465, user: "", pass: "", from: "", to: "" },
        wecom: { key: "" },
        gotify: { url: "", token: "" },
    });
    const [logRetentionDays, setLogRetentionDays] = useState("30");
    const [isCleaning, setIsCleaning] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const [blacklistRes, productsRes, settingsRes] = await Promise.all([
            fetch("/api/admin/blacklist"),
            fetch("/api/admin/products"),
            fetch("/api/admin/settings"),
        ]);
        setBlacklist(await blacklistRes.json());
        const prods = await productsRes.json();
        setProducts(prods);
        if (prods.length > 0 && !selectedProduct) setSelectedProduct(prods[0].slug);

        const settings = await settingsRes.json();
        if (settings) {
            setNotifyConfig(prev => ({
                ...prev,
                channels: settings["notify.channels"] ? JSON.parse(settings["notify.channels"]) : [],
                events: settings["notify.events"] ? JSON.parse(settings["notify.events"]) : [],
                email: settings["notify.email"] ? JSON.parse(settings["notify.email"]) : prev.email,
                wecom: settings["notify.wecom"] ? JSON.parse(settings["notify.wecom"]) : prev.wecom,
                gotify: settings["notify.gotify"] ? JSON.parse(settings["notify.gotify"]) : prev.gotify,
            }));
            if (settings["log.retention_days"]) setLogRetentionDays(settings["log.retention_days"]);
        }
    };

    const saveNotifyConfig = async () => {
        const payload = {
            "notify.channels": JSON.stringify(notifyConfig.channels),
            "notify.events": JSON.stringify(notifyConfig.events),
            "notify.email": JSON.stringify(notifyConfig.email),
            "notify.wecom": JSON.stringify(notifyConfig.wecom),
            "notify.gotify": JSON.stringify(notifyConfig.gotify),
        };

        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) alert("配置保存成功");
        else alert("保存失败");
    };

    const testNotify = async () => {
        const res = await fetch("/api/admin/notifications/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "测试通知", content: "这是一条测试消息，如果您收到它，说明配置正确！" }),
        });
        const data = await res.json();
        alert(data.message);
    };

    const saveSecurityConfig = async () => {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "log.retention_days": logRetentionDays }),
        });
        if (res.ok) alert("设置保存成功");
        else alert("保存失败");
    };

    const cleanupLogs = async () => {
        if (!confirm("确定要立即清理过期日志吗？该操作不可撤销。")) return;
        setIsCleaning(true);
        try {
            const res = await fetch("/api/admin/logs/cleanup", { method: "POST" });
            const data = await res.json();
            alert(data.message);
        } catch (e) {
            alert("清理失败");
        } finally {
            setIsCleaning(false);
        }
    };

    const addBlacklistRule = async () => {
        if (!newRule.value) return;
        await fetch("/api/admin/blacklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRule),
        });
        setNewRule({ type: "IP", value: "", reason: "" });
        fetchData();
    };

    const removeBlacklistRule = async (id: string) => {
        await fetch(`/api/admin/blacklist/${id}`, { method: "DELETE" });
        fetchData();
    };

    const selectedProductData = products.find((p) => p.slug === selectedProduct);
    const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

    const pythonCode = `import requests
import hashlib

API_URL = "${apiBaseUrl}/api/v1"
PRODUCT = "${selectedProduct}"

def get_hwid():
    """获取设备指纹（示例）"""
    import platform
    info = f"{platform.node()}-{platform.machine()}"
    return hashlib.md5(info.encode()).hexdigest()

def verify(key: str):
    """验证卡密"""
    resp = requests.post(f"{API_URL}/verify", json={
        "key": key,
        "product": PRODUCT,
        "hwid": get_hwid(),
        "version": "1.0.0"  # 当前版本号
    })
    return resp.json()

def activate(key: str):
    """激活卡密"""
    resp = requests.post(f"{API_URL}/activate", json={
        "key": key,
        "product": PRODUCT,
        "hwid": get_hwid()
    })
    return resp.json()

def heartbeat(key: str):
    """心跳保活"""
    resp = requests.post(f"{API_URL}/heartbeat", json={
        "key": key,
        "hwid": get_hwid()
    })
    return resp.json()

# 使用示例
if __name__ == "__main__":
    KEY = "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
    
    # 首次使用需要激活
    result = activate(KEY)
    print("激活结果:", result)
    
    # 验证卡密
    result = verify(KEY)
    if result.get("success"):
        print("验证通过!")
        data = result["data"]
        if data["product"]["needUpdate"]:
            print(f"有新版本: {data['product']['latestVersion']}")
        for ann in data.get("announcements", []):
            print(f"公告: {ann['title']}")
    else:
        print("验证失败:", result.get("message"))
`;

    const nodeCode = `const crypto = require('crypto');
const os = require('os');

const API_URL = '${apiBaseUrl}/api/v1';
const PRODUCT = '${selectedProduct}';

function getHwid() {
  const info = \`\${os.hostname()}-\${os.arch()}\`;
  return crypto.createHash('md5').update(info).digest('hex');
}

async function verify(key) {
  const resp = await fetch(\`\${API_URL}/verify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      product: PRODUCT,
      hwid: getHwid(),
      version: '1.0.0'
    })
  });
  return resp.json();
}

async function activate(key) {
  const resp = await fetch(\`\${API_URL}/activate\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      product: PRODUCT,
      hwid: getHwid()
    })
  });
  return resp.json();
}

async function heartbeat(key) {
  const resp = await fetch(\`\${API_URL}/heartbeat\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, hwid: getHwid() })
  });
  return resp.json();
}

// 使用示例
(async () => {
  const KEY = 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';
  
  const result = await verify(KEY);
  console.log('验证结果:', result);
})();
`;

    const shellCode = `#!/bin/bash

API_URL="${apiBaseUrl}/api/v1"
PRODUCT="${selectedProduct}"
KEY="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"

# 获取设备指纹
HWID=$(hostname | md5sum | cut -d' ' -f1)

# 验证卡密
verify() {
  curl -s -X POST "$API_URL/verify" \\
    -H "Content-Type: application/json" \\
    -d '{"key":"'$KEY'","product":"'$PRODUCT'","hwid":"'$HWID'"}'
}

# 激活卡密
activate() {
  curl -s -X POST "$API_URL/activate" \\
    -H "Content-Type: application/json" \\
    -d '{"key":"'$KEY'","product":"'$PRODUCT'","hwid":"'$HWID'"}'
}

# 心跳
heartbeat() {
  curl -s -X POST "$API_URL/heartbeat" \\
    -H "Content-Type: application/json" \\
    -d '{"key":"'$KEY'","hwid":"'$HWID'"}'
}

# 使用示例
echo "验证结果:"
verify | jq .
`;

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const [usernameForm, setUsernameForm] = useState({
        currentPassword: "",
        newUsername: "",
    });

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert("两次输入的密码不一致");
            return;
        }

        const res = await fetch("/api/admin/profile/password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            }),
        });
        const data = await res.json();
        if (data.success) {
            alert("密码修改成功");
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } else {
            alert(data.message || "修改失败");
        }
    };

    const handleUsernameChange = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/admin/profile/username", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: usernameForm.currentPassword,
                newUsername: usernameForm.newUsername,
            }),
        });
        const data = await res.json();
        if (data.success) {
            alert("用户名修改成功，请重新登录");
            setUsernameForm({ currentPassword: "", newUsername: "" });
            window.location.reload();
        } else {
            alert(data.message || "修改失败");
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tabs = [
        { id: "blacklist", label: "黑名单" },
        { id: "account", label: "账号设置" },
        { id: "notify", label: "通知设置" },
        { id: "security", label: "安全与日志" },
        { id: "code", label: "API调用示例" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">系统设置</h1>
                <p className="text-gray-400 mt-1">管理黑名单规则、账号设置和查看 API 调用示例</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id
                            ? "text-purple-400 border-b-2 border-purple-400"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Account Tab */}
            {activeTab === "account" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Change Username */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 h-fit">
                        <h2 className="text-lg font-semibold text-white mb-6">修改用户名</h2>
                        <form onSubmit={handleUsernameChange} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">当前密码 (验证身份)</label>
                                <input
                                    type="password"
                                    value={usernameForm.currentPassword}
                                    onChange={(e) => setUsernameForm(f => ({ ...f, currentPassword: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">新用户名</label>
                                <input
                                    type="text"
                                    value={usernameForm.newUsername}
                                    onChange={(e) => setUsernameForm(f => ({ ...f, newUsername: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all mt-4"
                            >
                                修改用户名
                            </button>
                        </form>
                    </div>

                    {/* Change Password */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 h-fit">
                        <h2 className="text-lg font-semibold text-white mb-6">修改密码</h2>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">当前密码</label>
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">新密码</label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">确认新密码</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all mt-4"
                            >
                                修改密码
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Blacklist Tab */}
            {activeTab === "blacklist" && (
                <div className="space-y-6">
                    {/* Add Rule */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">添加黑名单规则</h2>
                        <div className="flex gap-4">
                            <select
                                value={newRule.type}
                                onChange={(e) => setNewRule((r) => ({ ...r, type: e.target.value }))}
                                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                <option value="IP">IP地址</option>
                                <option value="HWID">设备指纹</option>
                                <option value="IP_RANGE">IP段</option>
                            </select>
                            <input
                                type="text"
                                placeholder={newRule.type === "IP_RANGE" ? "如: 192.168.1.0/24" : "值"}
                                value={newRule.value}
                                onChange={(e) => setNewRule((r) => ({ ...r, value: e.target.value }))}
                                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500"
                            />
                            <input
                                type="text"
                                placeholder="原因（可选）"
                                value={newRule.reason}
                                onChange={(e) => setNewRule((r) => ({ ...r, reason: e.target.value }))}
                                className="w-48 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500"
                            />
                            <button
                                onClick={addBlacklistRule}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                添加
                            </button>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="p-4 text-left text-sm font-medium text-gray-400">类型</th>
                                    <th className="p-4 text-left text-sm font-medium text-gray-400">值</th>
                                    <th className="p-4 text-left text-sm font-medium text-gray-400">原因</th>
                                    <th className="p-4 text-left text-sm font-medium text-gray-400">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blacklist.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            暂无黑名单规则
                                        </td>
                                    </tr>
                                ) : (
                                    blacklist.map((rule) => (
                                        <tr key={rule.id} className="border-b border-slate-800/50">
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded bg-slate-800 text-xs text-gray-300">
                                                    {rule.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-white font-mono">{rule.value}</td>
                                            <td className="p-4 text-sm text-gray-400">{rule.reason || "-"}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => removeBlacklistRule(rule.id)}
                                                    className="p-2 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Notify Tab */}
            {activeTab === "notify" && (
                <div className="space-y-6">
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">通知渠道配置</h2>
                            <button
                                onClick={saveNotifyConfig}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 transition-all"
                            >
                                <Save className="w-4 h-4" />
                                保存配置
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Email */}
                            <div className="space-y-4 border-b border-slate-800 pb-6">
                                <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notifyConfig.channels.includes("email")}
                                        onChange={(e) => {
                                            const newChannels = e.target.checked
                                                ? [...notifyConfig.channels, "email"]
                                                : notifyConfig.channels.filter(c => c !== "email");
                                            setNotifyConfig({ ...notifyConfig, channels: newChannels });
                                        }}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                    />
                                    邮件通知 (SMTP)
                                </label>
                                {notifyConfig.channels.includes("email") && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input placeholder="Host (e.g., smtp.gmail.com)" value={notifyConfig.email.host} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, host: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="Port (e.g., 465)" type="number" value={notifyConfig.email.port} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, port: parseInt(e.target.value) } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="Username (Email)" value={notifyConfig.email.user} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, user: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="Password / App Password" type="password" value={notifyConfig.email.pass} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, pass: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="From Name <email>" value={notifyConfig.email.from} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, from: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="To Email" value={notifyConfig.email.to} onChange={e => setNotifyConfig({ ...notifyConfig, email: { ...notifyConfig.email, to: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                    </div>
                                )}
                            </div>

                            {/* WeCom */}
                            <div className="space-y-4 border-b border-slate-800 pb-6">
                                <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notifyConfig.channels.includes("wecom")}
                                        onChange={(e) => {
                                            const newChannels = e.target.checked
                                                ? [...notifyConfig.channels, "wecom"]
                                                : notifyConfig.channels.filter(c => c !== "wecom");
                                            setNotifyConfig({ ...notifyConfig, channels: newChannels });
                                        }}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                    />
                                    企业微信 (Webhook)
                                </label>
                                {notifyConfig.channels.includes("wecom") && (
                                    <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input placeholder="Webhook Key (e.g., 693a91f6-7xxx-4bc4-97a0-0ec2sifa5aaa)" value={notifyConfig.wecom.key} onChange={e => setNotifyConfig({ ...notifyConfig, wecom: { key: e.target.value } })} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <p className="text-xs text-gray-500 mt-1">只填 Key 即可，无需完整 URL</p>
                                    </div>
                                )}
                            </div>

                            {/* Gotify */}
                            <div className="space-y-4 border-b border-slate-800 pb-6">
                                <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notifyConfig.channels.includes("gotify")}
                                        onChange={(e) => {
                                            const newChannels = e.target.checked
                                                ? [...notifyConfig.channels, "gotify"]
                                                : notifyConfig.channels.filter(c => c !== "gotify");
                                            setNotifyConfig({ ...notifyConfig, channels: newChannels });
                                        }}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                    />
                                    Gotify Push
                                </label>
                                {notifyConfig.channels.includes("gotify") && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input placeholder="Server URL (e.g., https://push.example.com)" value={notifyConfig.gotify.url} onChange={e => setNotifyConfig({ ...notifyConfig, gotify: { ...notifyConfig.gotify, url: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                        <input placeholder="App Token" value={notifyConfig.gotify.token} onChange={e => setNotifyConfig({ ...notifyConfig, gotify: { ...notifyConfig.gotify, token: e.target.value } })} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500" />
                                    </div>
                                )}
                            </div>

                            {/* Event Triggers */}
                            <div className="space-y-4 pt-6">
                                <h3 className="text-white font-medium">通知触发事件</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                    <label className="flex items-center gap-2 text-gray-300 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={notifyConfig.events.includes("admin_login")}
                                            onChange={(e) => {
                                                const newEvents = e.target.checked
                                                    ? [...notifyConfig.events, "admin_login"]
                                                    : notifyConfig.events.filter(c => c !== "admin_login");
                                                setNotifyConfig({ ...notifyConfig, events: newEvents });
                                            }}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                        />
                                        管理员登录 (Admin Login)
                                    </label>
                                    <label className="flex items-center gap-2 text-gray-300 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={notifyConfig.events.includes("card_activate")}
                                            onChange={(e) => {
                                                const newEvents = e.target.checked
                                                    ? [...notifyConfig.events, "card_activate"]
                                                    : notifyConfig.events.filter(c => c !== "card_activate");
                                                setNotifyConfig({ ...notifyConfig, events: newEvents });
                                            }}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                        />
                                        卡密激活 (Card Activation)
                                    </label>
                                    <label className="flex items-center gap-2 text-gray-300 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={notifyConfig.events.includes("system_attack")}
                                            onChange={(e) => {
                                                const newEvents = e.target.checked
                                                    ? [...notifyConfig.events, "system_attack"]
                                                    : notifyConfig.events.filter(c => c !== "system_attack");
                                                setNotifyConfig({ ...notifyConfig, events: newEvents });
                                            }}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-900"
                                        />
                                        系统告警 (High Traffic / Attack)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                            <button onClick={testNotify} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-all">
                                <Bell className="w-4 h-4" /> 发送测试通知
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Login Protection Info */}
                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Shield className="w-5 h-5 text-blue-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">登录安全保护</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        系统已自动开启登录防爆破保护：
                                    </p>
                                    <ul className="list-disc list-inside text-xs text-gray-400 mt-2 space-y-1">
                                        <li>限制 15 分钟内最多尝试 5 次</li>
                                        <li>超过次数将自动锁定来源 IP</li>
                                        <li>锁定期间无法尝试，需等待冷却</li>
                                    </ul>
                                </div>
                                <p className="text-xs text-gray-500">
                                    * 该功能为核心安全策略，默认强制开启。
                                </p>
                            </div>
                        </div>

                        {/* Log Retention Policy */}
                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-white">日志保留政策</h2>
                                <button
                                    onClick={saveSecurityConfig}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 transition-all text-sm"
                                >
                                    <Save className="w-4 h-4" />
                                    保存设置
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">自动清理过期日志</label>
                                    <select
                                        value={logRetentionDays}
                                        onChange={(e) => setLogRetentionDays(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    >
                                        <option value="0">永久保留 (不建议)</option>
                                        <option value="7">保留 7 天</option>
                                        <option value="15">保留 15 天</option>
                                        <option value="30">保留 30 天</option>
                                        <option value="90">保留 90 天</option>
                                        <option value="180">保留 180 天</option>
                                        <option value="365">保留 365 天</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-2">
                                        系统将根据此设置清理“验证日志”和“审计日志”。
                                    </p>
                                </div>

                                <div className="pt-6 border-t border-slate-800">
                                    <button
                                        onClick={cleanupLogs}
                                        disabled={isCleaning}
                                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-gray-300 rounded-lg transition-all border border-slate-700 flex items-center justify-center gap-2"
                                    >
                                        {isCleaning ? "正在清理..." : "立即清理过期日志"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Code Tab */}
            {activeTab === "code" && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-400">选择产品：</label>
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                            {products.map((p) => (
                                <option key={p.slug} value={p.slug}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Python */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-medium text-white">Python</span>
                            </div>
                            <button
                                onClick={() => copyCode(pythonCode)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm transition-all"
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? "已复制" : "复制"}
                            </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-sm">
                            <code className="text-gray-300">{pythonCode}</code>
                        </pre>
                    </div>

                    {/* Node.js */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4 text-green-400" />
                                <span className="text-sm font-medium text-white">Node.js</span>
                            </div>
                            <button
                                onClick={() => copyCode(nodeCode)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                            </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-sm">
                            <code className="text-gray-300">{nodeCode}</code>
                        </pre>
                    </div>

                    {/* Shell */}
                    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-white">Shell (Bash)</span>
                            </div>
                            <button
                                onClick={() => copyCode(shellCode)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                            </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-sm">
                            <code className="text-gray-300">{shellCode}</code>
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
