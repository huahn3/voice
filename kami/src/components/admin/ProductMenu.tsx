"use client";

import DropdownMenu from "@/components/admin/DropdownMenu";
import { Edit, Power, Trash2, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProductMenuProps {
    productId: string;
    productName: string;
}

export default function ProductMenu({ productId, productName }: ProductMenuProps) {
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm(`确定要删除产品 "${productName}" 吗？此操作不可恢复！`)) return;

        try {
            const res = await fetch(`/api/admin/products/${productId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                router.refresh();
            } else {
                alert("删除失败");
            }
        } catch (error) {
            console.error(error);
            alert("删除失败");
        }
    };

    return (
        <DropdownMenu
            trigger="vertical"
            align="right"
            items={[
                {
                    label: "编辑",
                    icon: <Edit className="w-4 h-4" />,
                    href: `/admin/products/${productId}`
                },
                {
                    label: "删除",
                    icon: <Trash2 className="w-4 h-4" />,
                    onClick: handleDelete,
                    className: "text-red-400 hover:bg-red-500/10",
                },
            ]}
        />
    );
}
