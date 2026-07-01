# Kami 卡密系统 - Python 集成指南

本指南提供了一个健壮的 `KamiClient` 类，帮助你将 Python 应用集成到 Kami 卡密系统中。主要涵盖：
- **激活/验证**：设备绑定与状态检查。
- **版本控制**：强制更新机制。
- **心跳保活**：维持在线状态。
- **安全机制**：处理 AES-256 加密的脚本交付。

## 前置准备

安装必要的库：

```bash
pip install requests pycryptodome schema
```

## `kami_client.py`

将此代码保存为 `kami_client.py` 到你的项目中。

```python
import platform
import hashlib
import requests
import json
import time
import threading
import sys
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

class KamiClient:
    def __init__(self, base_url, product_slug, current_version, encryption_key=None):
        self.base_url = base_url.rstrip('/') + '/api/v1'
        self.product_slug = product_slug
        self.current_version = current_version
        self.encryption_key = encryption_key # 可选：如果使用加密脚本，请设置此项
        self.hwid = self._get_hwid()
        self.card_key = None
        self._stop_heartbeat = False
        
    def _get_hwid(self):
        """生成稳定的设备指纹 (HWID)。"""
        # 简单示例：主机名 + 机器类型。
        # 生产环境中建议使用更健壮的唯一标识符 (例如 uuid.getnode())。
        info = f"{platform.node()}-{platform.machine()}-{platform.system()}"
        return hashlib.md5(info.encode()).hexdigest()

    def activate(self, key):
        """首次激活卡密 (绑定设备)。"""
        self.card_key = key
        try:
            resp = requests.post(f"{self.base_url}/activate", json={
                "key": key,
                "product": self.product_slug,
                "hwid": self.hwid
            })
            return resp.json()
        except Exception as e:
            return {"success": False, "message": str(e)}

    def verify(self, key):
        """验证卡密状态并检查更新。"""
        self.card_key = key
        try:
            resp = requests.post(f"{self.base_url}/verify", json={
                "key": key,
                "product": self.product_slug,
                "hwid": self.hwid,
                "version": self.current_version
            })
            return resp.json()
        except Exception as e:
            return {"success": False, "message": str(e)}

    def heartbeat(self):
        """发送心跳包。请定期调用此方法。"""
        if not self.card_key: return
        try:
            requests.post(f"{self.base_url}/heartbeat", json={
                "key": self.card_key,
                "hwid": self.hwid
            })
        except:
            pass # 忽略心跳网络错误

    def start_heartbeat(self, interval=60):
        """启动后台心跳线程。"""
        self._stop_heartbeat = False
        def loop():
            while not self._stop_heartbeat:
                self.heartbeat()
                time.sleep(interval)
        
        t = threading.Thread(target=loop, daemon=True)
        t.start()

    def stop_heartbeat(self):
        self._stop_heartbeat = True

    def decrypt_script(self, encrypted_data):
        """如果配置了密钥，解密脚本内容。"""
        if not self.encryption_key:
            raise ValueError("未配置解密密钥 (Encryption Key)")
        
        try:
            # 解密逻辑需与服务器一致: base64(iv + encrypted)
            raw = base64.b64decode(encrypted_data)
            iv = raw[:16]
            encrypted = raw[16:]
            
            # Key hash
            key_hash = hashlib.sha256(self.encryption_key.encode()).digest()
            
            cipher = AES.new(key_hash, AES.MODE_CBC, iv)
            decrypted = unpad(cipher.decrypt(encrypted), AES.block_size)
            return decrypted.decode('utf-8')
        except Exception as e:
            print(f"解密失败: {e}")
            return None
```

## 使用示例

创建一个 `main.py` 来调用客户端。

```python
from kami_client import KamiClient
import sys
import time

# 配置
API_BASE = "http://localhost:3000" # 替换为你的服务器地址
PRODUCT_SLUG = "your-product-slug" # 产品标识符
CURRENT_VERSION = "1.0.0"          # 当前软件版本
ENCRYPTION_KEY = "your-32-char-encryption-key" # 可选，需与后台设置一致

def main():
    client = KamiClient(API_BASE, PRODUCT_SLUG, CURRENT_VERSION, ENCRYPTION_KEY)
    
    key = input("请输入卡密: ").strip()
    
    # 1. 验证 / 登录
    print("正在验证...")
    result = client.verify(key)
    
    if not result.get("success"):
        print(f"登录失败: {result.get('message')}")
        # 在这里可以尝试自动激活，或者提示用户检查卡密
        return

    # 2. 检查结果
    data = result["data"]
    if not data.get("valid"):
        print("卡密无效或已过期。")
        return

    # 3. 版本控制
    product_info = data["product"]
    if product_info["forceUpdate"]:
        print(f"重要提示: 必须更新到版本 {product_info['latestVersion']} 才能继续使用！")
        print("请下载最新版本。")
        sys.exit(1)
        
    if product_info["needUpdate"]:
        print(f"提示: 发现新版本 {product_info['latestVersion']}。")

    print(f"登录成功! 到期时间: {data['cardKey'].get('expiresAt', '永久/耗尽')}")

    # 4. 处理交付内容 (例如：运行加密脚本)
    delivery = data.get("delivery")
    if delivery and delivery["type"] == "SCRIPT":
        script_content = delivery["data"]
        
        if delivery.get("encrypted"):
            print("正在解密脚本...")
            script_content = client.decrypt_script(script_content)
        
        if script_content:
            print("执行远程脚本...")
            # exec(script_content) # 警告：仅在你完全信任服务器时执行
            print("脚本内容:", script_content)

    # 5. 启动心跳保活
    print("应用启动中...")
    client.start_heartbeat()
    
    try:
        # 你的主程序逻辑
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("停止运行...")
        client.stop_heartbeat()

if __name__ == "__main__":
    main()
```
