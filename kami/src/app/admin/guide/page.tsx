export default function GuidePage() {
    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white">使用教程</h1>
                <p className="text-gray-400 mt-1">
                    系统功能详解与集成指南
                </p>
            </div>

            <div className="space-y-8">
                {/* 1. 核心概念与交付方式 */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                            1
                        </span>
                        核心功能：交付方式详解
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-mono">SCRIPT_DISPLAY</span>
                                <h3 className="text-white font-medium">脚本展示 (直接返回)</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-3">
                                最常用的方式，适用于 Lua、Python、JS 等脚本交付。
                            </p>
                            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                                <li>客户端调用 Verify 接口验证通过后</li>
                                <li>服务端直接在 JSON 响应中返回脚本内容</li>
                                <li>支持 AES-256 加密传输 (需在产品设置中开启)</li>
                            </ul>
                        </div>

                        <div className="p-5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-mono">DOWNLOAD_LINK</span>
                                <h3 className="text-white font-medium">下载链接</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-3">
                                适用于 exe、apk 等文件交付。
                            </p>
                            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                                <li>验证通过后，接口返回产品的下载地址</li>
                                <li>客户端收到地址后，自动调用浏览器或下载器下载</li>
                                <li>适合不便于直接放在响应体中的大文件</li>
                            </ul>
                        </div>

                        <div className="p-5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-mono">API_PULL</span>
                                <h3 className="text-white font-medium">API 拉取</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-3">
                                适用于需要客户端自行获取资源的场景。
                            </p>
                            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                                <li>验证接口只返回 "成功" 状态</li>
                                <li>客户端根据成功信号，去请求您自己的其他业务接口</li>
                                <li>适合与其他系统集成的松耦合架构</li>
                            </ul>
                        </div>

                        <div className="p-5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-xs font-mono">WEBHOOK</span>
                                <h3 className="text-white font-medium">Webhook 推送</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-3">
                                适用于自动化发货或第三方系统对接。
                            </p>
                            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                                <li>验证通过后，系统向您配置的 URL 发送 POST 请求</li>
                                <li>包含卡密、设备ID、IP 等详细信息</li>
                                <li>您的服务器收到推送后，可进行自动发货或开通权限</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 2. 快速流程 */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-gray-300 text-sm">
                            2
                        </span>
                        管理流程
                    </h2>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-none pt-1">
                                <div className="w-2 h-2 rounded-full bg-slate-600 mt-2"></div>
                            </div>
                            <div>
                                <h3 className="text-white font-medium">创建与配置</h3>
                                <p className="text-gray-400 text-sm mt-1">
                                    进入「产品管理」创建产品，设置交付方式。如果选择脚本交付，建议在编辑页面配置 Encryption Key 以启用加密。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-none pt-1">
                                <div className="w-2 h-2 rounded-full bg-slate-600 mt-2"></div>
                            </div>
                            <div>
                                <h3 className="text-white font-medium">版本管理</h3>
                                <p className="text-gray-400 text-sm mt-1">
                                    发布新版本时，可以设置 "强制更新"。开启后，旧版本客户端验证时将被拒绝，提示必须更新。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-none pt-1">
                                <div className="w-2 h-2 rounded-full bg-slate-600 mt-2"></div>
                            </div>
                            <div>
                                <h3 className="text-white font-medium">卡密分发</h3>
                                <p className="text-gray-400 text-sm mt-1">
                                    在「卡密管理」批量生成卡密。支持时长卡（按时间）、次数卡（按使用次数）和额度卡（按点数扣除）。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. 集成开发 */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-gray-300 text-sm">
                            3
                        </span>
                        客户端接入
                    </h2>
                    <div className="prose prose-invert max-w-none text-sm text-gray-400">
                        <p className="mb-4">
                            在「系统设置」页面可获取完整的 API 文档和多语言调用示例 (Python, Node.js, Shell)。
                        </p>
                        <h3 className="text-white font-medium mb-2">核心 API：</h3>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><code className="text-purple-300">POST /api/v1/verify</code> - 核心验证接口。上传卡密、设备指纹(hwid)和当前版本。返回是否有效、剩余时长/次数、以及交付的内容（脚本/链接等）。</li>
                            <li><code className="text-purple-300">POST /api/v1/heartbeat</code> - 心跳保活。用于实时检测在线状态，建议每 60 秒调用一次。</li>
                        </ul>
                    </div>
                </section>

                {/* 4. 安全机制 */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-gray-300 text-sm">
                            4
                        </span>
                        安全风控
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 rounded bg-slate-800/50">
                            <h3 className="text-white text-sm font-medium mb-1">限流保护</h3>
                            <p className="text-gray-500 text-xs">单IP请求限制 (60次/分钟)，防止暴力破解。</p>
                        </div>
                        <div className="p-3 rounded bg-slate-800/50">
                            <h3 className="text-white text-sm font-medium mb-1">绑定机制</h3>
                            <p className="text-gray-500 text-xs">卡密自动绑定首次使用的设备 HWID 和 IP，防止多人共享。</p>
                        </div>
                        <div className="p-3 rounded bg-slate-800/50">
                            <h3 className="text-white text-sm font-medium mb-1">审计日志</h3>
                            <p className="text-gray-500 text-xs">管理员的所有操作（增删改）均被记录，可在「审计日志」中查询。</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
