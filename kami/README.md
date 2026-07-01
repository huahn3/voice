# 卡密管理系统

一个自用的卡密管理系统，用于管理脚本和应用的授权分发。

## 功能特性

- ✅ **产品管理** - 支持多产品、多版本、多渠道（稳定版/测试版）
- ✅ **卡密类型** - 时长卡/次数卡/额度卡
- ✅ **授权策略** - 设备绑定(HWID)、IP绑定、多设备并发限制
- ✅ **验证API** - 验证、激活、心跳、脚本获取
- ✅ **脚本加密** - 双重加密交付，防止内容泄露
- ✅ **版本控制** - 强制更新机制
- ✅ **公告系统** - 验证时返回公告信息
- ✅ **快速禁用** - 一键禁用产品及相关卡密
- ✅ **API示例** - 自动生成 Python/Node/Shell 调用代码
- ✅ **风控审计** - 黑名单、验证日志、状态追踪

## 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: SQLite + Prisma
- **样式**: TailwindCSS
- **认证**: NextAuth.js

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 初始化数据库

\`\`\`bash
npx prisma db push
\`\`\`

### 3. 创建管理员账户

\`\`\`bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/init-admin.ts admin yourpassword
\`\`\`

### 4. 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问 http://localhost:3000 进入管理后台

## API 接口

### 公开验证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/verify` | 卡密验证 |
| POST | `/api/v1/activate` | 卡密激活 |
| POST | `/api/v1/heartbeat` | 心跳保活 |
| POST | `/api/v1/script` | 获取加密脚本 |

### 请求示例

\`\`\`json
POST /api/v1/verify
{
  "key": "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX",
  "product": "your-product-slug",
  "hwid": "device-fingerprint",
  "version": "1.0.0"
}
\`\`\`

### 响应示例

\`\`\`json
{
  "success": true,
  "data": {
    "valid": true,
    "cardKey": {
      "type": "TIME",
      "status": "ACTIVE",
      "expiresAt": "2024-12-31T23:59:59Z"
    },
    "product": {
      "name": "产品名称",
      "latestVersion": "1.2.0",
      "forceUpdate": false,
      "needUpdate": true
    },
    "announcements": [
      {
        "title": "系统维护通知",
        "content": "...",
        "type": "INFO"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "responseTime": 15
}
\`\`\`

## 目录结构

\`\`\`
kami/
├── prisma/
│   └── schema.prisma       # 数据库模型
├── scripts/
│   └── init-admin.ts       # 初始化管理员脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/         # 公开验证API
│   │   │   └── admin/      # 管理API
│   │   ├── admin/          # 管理后台页面
│   │   └── login/          # 登录页
│   ├── components/         # 组件
│   └── lib/                # 工具库
└── README.md
\`\`\`

## 部署

### 使用 Docker

\`\`\`bash
docker build -t kami .
docker run -p 3000:3000 -v ./data:/app/prisma kami
\`\`\`

### 环境变量

\`\`\`env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-domain.com"
ENCRYPTION_SECRET="your-encryption-key"
\`\`\`


## 客户端集成指南

为了方便开发者快速接入，我们提供了详细的集成文档和示例代码：

- 🐍 [Python 集成指南 (含完整 Client 类)](docs/python-integration.md)
- 📜 更多语言示例 (Node.js, Shell) 请在管理后台「系统设置」页面查看。

### 核心流程

1. **Activate**: 首次使用激活卡密，绑定设备。
2. **Verify**: 每次启动验证状态，检查更新。
3. **Heartbeat**: 运行时定时发送心跳，维持在线。

## License

MIT
