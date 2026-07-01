# Kami Card Key System - 开发者集成宝典

本文档是集成 Kami 卡密系统的权威指南。无论你使用 Python、Go、C++、Java 还是易语言，只要遵循本文档的规范，即可实现完整的卡密验证功能。
**你可以将本文档直接发送给 AI 助手，让其为你生成特定语言的 SDK 代码。**

---

## 1. 核心架构与逻辑

### 1.1 业务流程
集成工作主要围绕以下三个核心生命周期：

1.  **激活 (Activate)**:
    *   **时机**: 用户首次输入卡密时。
    *   **作用**: 将卡密与当前设备的指纹 (HWID) 进行绑定。
    *   **逻辑**: 如果卡密是 "UNUSED" (未激活)，则将其状态变为 "ACTIVE" 并记录 HWID。如果已激活但 HWID 不匹配，则报错。

2.  **验证 (Verify)**:
    *   **时机**: 软件每次启动时，或关键功能执行前。
    *   **作用**: 检查卡密是否过期、被封禁、以及设备是否匹配。同时获取软件的最新版本信息和交付内容（如加密脚本）。
    *   **逻辑**: 这是最核心的接口。必须处理 "强制更新" (Force Update) 逻辑。

3.  **心跳 (Heartbeat)**:
    *   **时机**: 软件运行期间，定时调用 (建议 60秒/次)。
    *   **作用**: 告诉服务器 "我还在线"。如果卡密中途被管理员封禁或过期，心跳接口会返回错误，客户端应立即停止服务。

### 1.2 关键概念

*   **Product Slug (产品标识)**: 系统中每个产品都有唯一的 Slug（如 `my-auto-script`），调用 API 时必须携带，用于区分请求的是哪个软件。
*   **HWID (设备指纹)**: 客户端必须生成一个稳定的、不易变更的唯一字符串标识当前设备 (如 `md5(CPU序列号 + 主板序列号)` )。
*   **Encryption Key (加密密钥)**: 发送加密脚本时使用的 AES 密钥。在后台产品设置中配置。

---

## 2. API 接口规范

**Base URL**: `http://<your-domain>/api/v1`
**Content-Type**: `application/json`

### 2.1 激活接口 (Activate)

*   **Endpoint**: `POST /activate`
*   **描述**: 尝试激活卡密。

**请求参数**:
```json
{
  "key": "CS7D-89S7-S89D-0000",   // [必填] 卡密字符串
  "product": "my-product-slug",   // [必填] 产品 Slug
  "hwid": "a1b2c3d4e5f6..."       // [必填] 设备指纹
}
```

**响应 (成功)**:
```json
{
  "success": true,
  "message": "激活成功",
  "data": {
    "activatedAt": "2024-03-20T10:00:00Z",
    "expiresAt": "2024-04-20T10:00:00Z", // 或 null (永久)
    "type": "TIME", // 或 COUNT (次数), CREDIT (点数)
    "boundHwid": true
  }
}
```

**响应 (失败)**:
```json
{
  "success": false,
  "message": "卡密不存在 / 卡密已被使用"
}
```

---

### 2.2 验证接口 (Verify) - 核心

*   **Endpoint**: `POST /verify`
*   **描述**: 验证卡密有效性，获取交付内容。

**请求参数**:
```json
{
  "key": "CS7D-89S7-S89D-0000",
  "product": "my-product-slug",
  "hwid": "a1b2c3d4e5f6...",
  "version": "1.0.0"              // [必填] 客户端当前版本号
}
```

**响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "cardKey": {
      "status": "ACTIVE",
      "expiresAt": "2024-04-20...",
      "remainingUses": 10,       // 剩余次数 (仅次数卡)
      "remainingCredits": 500    // 剩余点数 (仅点数卡)
    },
    // 版本控制信息
    "product": {
      "latestVersion": "1.2.0",  // 最新版本
      "forceUpdate": true,       // [重要] 是否强制更新
      "needUpdate": true,        // 是否建议更新
      "downloadUrl": "https://..." // 下载地址
    },
    // 交付内容 (根据后台配置不同)
    "delivery": {
      "type": "SCRIPT",          // SCRIPT | DOWNLOAD | API_PULL | WEBHOOK
      "data": "...",             // 脚本内容 或 下载链接
      "encrypted": true          // 是否加密
    },
    // 公告
    "announcements": [
      { "title": "维护通知", "content": "...", "type": "INFO" }
    ]
  }
}
```

**特殊情况: 强制更新**
如果是强制更新，API 会返回 HTTP 200，但 `data.valid` 可能为 `false` (或者即便是 true，也应优先处理 forceUpdate)。客户端**必须**检查 `data.product.forceUpdate`。如果为 `true`，则阻止用户使用，并弹窗提示下载更新。

---

### 2.3 心跳接口 (Heartbeat)

*   **Endpoint**: `POST /heartbeat`
*   **描述**: 维持在线状态，检测中途封禁。

**请求参数**:
```json
{
  "key": "CS7D-89S7-S89D-0000",
  "hwid": "a1b2c3d4e5f6..."
}
```

**响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "status": "ACTIVE",
    "remainingSeconds": 3600, // 剩余秒数
    "criticalAnnouncements": [] // 紧急弹窗公告
  }
}
```

**响应 (失败)**:
如果返回 `success: false`，通常意味着卡密过期或被封禁，客户端应立即退出。

---

## 3. 安全协议：AES 脚本解密

如果产品开启了 "脚本展示" + "Encrypt Content"，服务器返回的 `delivery.data` 是加密的。客户端**必须**按以下算法解密。

### 3.1 算法参数
*   **算法**: AES-256-CBC
*   **Key (密钥)**: 取产品设置中的 Encryption Key (字符串) 的 **SHA-256 哈希值** (32字节)。
*   **IV (向量)**: 随机生成，包含在密文前 16 字节中。
*   **Data (密文)**: Base64 编码字符串。

### 3.2 解密步骤 (伪代码)

1.  **解码**: 将 `delivery.data` 进行 Base64 解码，得到 `RawBytes`。
2.  **提取 IV**: `IV = RawBytes[0:16]` (前16字节)。
3.  **提取密文**: `CipherBytes = RawBytes[16:]` (剩余部分)。
4.  **派生密钥**: `AesKey = SHA256(Configuration.EncryptionKey)`。
5.  **解密**:调用 `AES_Decrypt(CipherBytes, Key=AesKey, IV=IV, Mode=CBC, Padding=PKCS7)`。
6.  **结果**: 得到 UTF-8 编码的脚本原文。

---

## 4. 客户端实现伪代码 (Flow)

以下逻辑可用于指导任何语言的开发。

```text
Function Main():
    Config = LoadConfig()
    HWID = GenerateHWID()
    
    // 1. 用户输入卡密
    Key = Input("请输入卡密")
    
    // 2. 尝试验证
    Response = HTTP_POST("/verify", {
        key: Key,
        hwid: HWID,
        product: Config.ProductSlug,
        version: Config.CurrentVersion
    })
    
    // 3. 处理网络错误
    If NetworkError:
        Print("无法连接服务器")
        Return

    // 4. 处理业务逻辑
    If Response.data.product.forceUpdate == True:
        OpenBrowser(Response.data.product.downloadUrl)
        ExitApp("版本过低，请下载更新")

    If Response.success == False:
        If Response.message == "卡密未激活":
            // 自动尝试激活
            ActivateResponse = HTTP_POST("/activate", {key, hwid, product})
            If ActivateResponse.success:
                MsgBox("激活成功")
                Retry Verify... // 重新验证
            Else:
                ExitApp("激活失败: " + ActivateResponse.message)
        Else:
            ExitApp("验证失败: " + Response.message)

    // 5. 验证通过，处理交付
    Delivery = Response.data.delivery
    If Delivery.type == "SCRIPT":
        Script = Delivery.data
        If Delivery.encrypted:
            Script = AES_Decrypt(Script) // 见上文解密步骤
        
        RunScript(Script)

    // 6. 启动心跳线程
    StartThread(HeartbeatLoop)

Function HeartbeatLoop():
    While True:
        Sleep(60 Seconds)
        Response = HTTP_POST("/heartbeat", {key, hwid})
        If Response.success == False:
            StopApp("授权已失效: " + Response.message)
```
