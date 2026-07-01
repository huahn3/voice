// 初始化管理员账户脚本
// 运行: npx tsx scripts/init-admin.ts admin yourpassword

import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

async function main() {
    const username = process.argv[2] || "admin";
    const password = process.argv[3] || "admin123";

    // 直接操作 SQLite
    const db = new Database("./dev.db");

    // 检查是否已存在
    const existing = db.prepare("SELECT * FROM User WHERE username = ?").get(username);

    if (existing) {
        console.log(`用户 "${username}" 已存在`);
        db.close();
        return;
    }

    // 创建管理员
    const passwordHash = await bcrypt.hash(password, 10);
    const id = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO User (id, username, passwordHash, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, now, now);

    console.log(`✅ 管理员创建成功！`);
    console.log(`   用户名: ${username}`);
    console.log(`   密码: ${password}`);
    console.log(`   请登录后修改密码！`);

    db.close();
}

main().catch(console.error);
