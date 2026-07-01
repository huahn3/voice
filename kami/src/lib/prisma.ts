import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 确保在 Next.js 开发环境中正确找到数据库文件
const dbPath = path.join(process.cwd(), "prisma", "dev.db");

// PrismaBetterSqlite3 是一个 Factory，需要传入配置对象
const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
