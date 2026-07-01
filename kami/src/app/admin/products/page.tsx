import Link from "next/link";
import prisma from "@/lib/prisma";
import { Plus, Power, Edit } from "lucide-react";
import { getDeliveryTypeLabel } from "@/lib/utils";
import ProductMenu from "@/components/admin/ProductMenu";

async function getProducts() {
    return prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: {
                    cardKeys: true,
                    versions: true,
                },
            },
        },
    });
}

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">产品管理</h1>
                    <p className="text-gray-400 mt-1">管理你的应用和脚本产品</p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    新建产品
                </Link>
            </div>

            {products.length === 0 ? (
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">暂无产品</h3>
                    <p className="text-gray-400 mb-6">创建你的第一个产品开始管理卡密</p>
                    <Link
                        href="/admin/products/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        创建产品
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product: any) => (
                        <div
                            key={product.id}
                            className="rounded-xl bg-slate-900 border border-slate-800 p-6 hover:border-slate-700 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-3 h-3 rounded-full ${product.isActive ? "bg-green-500" : "bg-gray-500"
                                            }`}
                                    />
                                    <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                                </div>
                                <div className="relative">
                                    <div className="relative">
                                        <ProductMenu productId={product.id} productName={product.name} />
                                    </div>
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                {product.description || "暂无描述"}
                            </p>

                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                <span>{getDeliveryTypeLabel(product.deliveryType)}</span>
                                <span>·</span>
                                <span>{product._count.versions} 个版本</span>
                                <span>·</span>
                                <span>{product._count.cardKeys} 张卡密</span>
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                <Link
                                    href={`/admin/products/${product.id}`}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                    编辑
                                </Link>
                                <form action={`/api/admin/products/${product.id}/toggle`} method="POST">
                                    <button
                                        type="submit"
                                        className={`p-2 rounded-lg ${product.isActive
                                            ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                            : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                                            } transition-all`}
                                        title={product.isActive ? "禁用产品" : "启用产品"}
                                    >
                                        <Power className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Package(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <line x1="12" x2="12" y1="22" y2="12" />
        </svg>
    );
}
