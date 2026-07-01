import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.ENCRYPTION_SECRET || "your-encryption-secret-key";

// AES 加密脚本内容
export function encryptScript(content: string): string {
    return CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
}

// AES 解密脚本内容
export function decryptScript(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// 基于卡密生成临时加密密钥（用于交付时的二次加密）
export function deriveKeyFromCardKey(cardKey: string, salt: string = ""): string {
    return CryptoJS.PBKDF2(cardKey, salt + SECRET_KEY, {
        keySize: 256 / 32,
        iterations: 1000,
    }).toString();
}

// 使用派生密钥加密内容
export function encryptWithDerivedKey(content: string, derivedKey: string): {
    encrypted: string;
    iv: string;
} {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(content, CryptoJS.enc.Hex.parse(derivedKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return {
        encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
        iv: iv.toString(CryptoJS.enc.Base64),
    };
}

// 使用派生密钥解密内容
export function decryptWithDerivedKey(encrypted: string, iv: string, derivedKey: string): string {
    const decrypted = CryptoJS.AES.decrypt(
        {
            ciphertext: CryptoJS.enc.Base64.parse(encrypted),
        } as CryptoJS.lib.CipherParams,
        CryptoJS.enc.Hex.parse(derivedKey),
        {
            iv: CryptoJS.enc.Base64.parse(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// 生成 API Key
export function generateApiKey(): string {
    const randomBytes = CryptoJS.lib.WordArray.random(32);
    return `km_${randomBytes.toString(CryptoJS.enc.Hex)}`;
}

// 对脚本内容进行简单混淆（额外的安全层）
export function obfuscateScript(content: string): string {
    // Base64 编码 + 反转 + 前缀标记
    const base64 = Buffer.from(content, "utf-8").toString("base64");
    const reversed = base64.split("").reverse().join("");
    return `__KM_OBF__${reversed}`;
}

// 反混淆脚本内容
export function deobfuscateScript(obfuscated: string): string {
    if (!obfuscated.startsWith("__KM_OBF__")) {
        return obfuscated; // 未混淆的内容直接返回
    }
    const reversed = obfuscated.slice(10);
    const base64 = reversed.split("").reverse().join("");
    return Buffer.from(base64, "base64").toString("utf-8");
}
