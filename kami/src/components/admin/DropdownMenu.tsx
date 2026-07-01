"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, MoreHorizontal } from "lucide-react";

interface DropdownMenuProps {
    items: {
        label: string;
        onClick?: () => void;
        className?: string;
        icon?: React.ReactNode;
        href?: string;
    }[];
    align?: "left" | "right";
    side?: "top" | "bottom";
    trigger?: "vertical" | "horizontal";
}

export default function DropdownMenu({ items, align = "right", trigger = "vertical" }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-slate-800 text-gray-400 hover:text-white transition-all"
            >
                {trigger === "vertical" ? <MoreVertical className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
            </button>

            {isOpen && (
                <div
                    className={`absolute z-50 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-xl ${align === "right" ? "right-0" : "left-0"
                        }`}
                >
                    <div className="p-1">
                        {items.map((item, index) => {
                            if (item.href) {
                                return (
                                    <a
                                        key={index}
                                        href={item.href}
                                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-800 ${item.className || "text-gray-300"
                                            }`}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </a>
                                );
                            }
                            return (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick?.();
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-800 ${item.className || "text-gray-300"
                                        }`}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
