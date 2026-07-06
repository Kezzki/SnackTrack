import {
    Package, Clock, CheckCircle2, XCircle, Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────
export type OrderStatus = "menunggu_pembayaran" | "menunggu" | "diproses" | "dikirim" | "selesai" | "dibatalkan";

export interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    image: string;
}

export interface Order {
    id: string;
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    shippingAddress: string;
    paymentMethod: string;
    items: OrderItem[];
    subtotal: number;
    shippingCost: number;
    total: number;
    status: OrderStatus;
    date: string;
    updatedAt: string;
    notes: string;
    deadline: string;
    deliveryProofUrl?: string;
}

// ─── Config ─────────────────────────────────────────────────────────────
export const statusTabs: { key: "semua" | OrderStatus; label: string; icon: LucideIcon }[] = [
    { key: "semua", label: "Semua", icon: Package },
    { key: "menunggu_pembayaran", label: "Belum Bayar", icon: Clock },
    { key: "menunggu", label: "Menunggu", icon: Clock },
    { key: "diproses", label: "Diproses", icon: Package },
    { key: "dikirim", label: "Dikirim", icon: Truck },
    { key: "selesai", label: "Selesai", icon: CheckCircle2 },
    { key: "dibatalkan", label: "Dibatalkan", icon: XCircle },
];

export const statusConfig: Record<
    OrderStatus,
    { label: string; color: string; bgColor: string; dotColor: string }
> = {
    menunggu_pembayaran: { label: "Belum Bayar", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", dotColor: "bg-amber-500" },
    menunggu: { label: "Menunggu", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", dotColor: "bg-purple-500" },
    diproses: { label: "Diproses", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", dotColor: "bg-blue-500" },
    dikirim: { label: "Dikirim", color: "text-violet-700", bgColor: "bg-violet-50 border-violet-200", dotColor: "bg-violet-500" },
    selesai: { label: "Selesai", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200", dotColor: "bg-emerald-500" },
    dibatalkan: { label: "Dibatalkan", color: "text-red-700", bgColor: "bg-red-50 border-red-200", dotColor: "bg-red-500" },
};

export const statusFlow: OrderStatus[] = ["menunggu_pembayaran", "menunggu", "diproses", "dikirim", "selesai"];

export function getNextStatus(current: OrderStatus): OrderStatus | null {
    const idx = statusFlow.indexOf(current);
    if (idx === -1 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
}
