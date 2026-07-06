import { Package, Clock, CheckCircle2, XCircle, CreditCard, Wallet, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";
export type OrderStatus =
    | "menunggu_pembayaran"
    | "menunggu"
    | "diproses"
    | "dikirim"
    | "selesai"
    | "dibatalkan";

export interface TransactionItem {
    name: string;
    quantity: number;
    price: number;
}

export interface Transaction {
    id: string;
    orderNumber: string;
    storeName: string;
    items: TransactionItem[];
    total: number;
    status: TransactionStatus;
    date: string;
    updatedAt: string;
    deadline: string;
    /** Raw order status from the DB */
    orderStatus: OrderStatus;
    /** Payment status from the transactions table */
    paymentStatus: PaymentStatus;
    /** Payment method label (e.g. "QRIS", "bank_transfer", "cod") */
    paymentMethod: string;
    /** Midtrans snap token — used to re-open payment popup */
    snapToken?: string;
    /** Seller contact info — displayed in order detail */
    sellerStoreName?: string;
    sellerPhone?: string;
    sellerAddress?: string;
    storeId?: string;
    deliveryProofUrl?: string;
}

// ─── Status tabs (buyer transaction page) ──────────────────────────────
export const statusTabs: { key: "semua" | TransactionStatus; label: string; icon: LucideIcon }[] = [
    { key: "semua", label: "Semua", icon: Package },
    { key: "berlangsung", label: "Berlangsung", icon: Clock },
    { key: "berhasil", label: "Berhasil", icon: CheckCircle2 },
    { key: "tidak_berhasil", label: "Tidak Berhasil", icon: XCircle },
];

export const statusConfig: Record<TransactionStatus, { label: string; color: string; bgColor: string }> = {
    berlangsung: { label: "Berlangsung", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
    berhasil: { label: "Berhasil", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
    tidak_berhasil: { label: "Tidak Berhasil", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

// ─── Payment status config ─────────────────────────────────────────────
export const paymentStatusConfig: Record<
    PaymentStatus,
    { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
    unpaid: {
        label: "Belum Bayar",
        color: "text-gray-700",
        bgColor: "bg-gray-50 border-gray-200",
        icon: Wallet,
    },
    pending: {
        label: "Menunggu Pembayaran",
        color: "text-amber-700",
        bgColor: "bg-amber-50 border-amber-200",
        icon: Clock,
    },
    paid: {
        label: "Lunas",
        color: "text-emerald-700",
        bgColor: "bg-emerald-50 border-emerald-200",
        icon: CheckCircle2,
    },
    failed: {
        label: "Gagal",
        color: "text-red-700",
        bgColor: "bg-red-50 border-red-200",
        icon: XCircle,
    },
};

// ─── Order flow stepper config ─────────────────────────────────────────
export const orderSteps: { key: OrderStatus; label: string; icon: LucideIcon }[] = [
    { key: "menunggu_pembayaran", label: "Pembayaran", icon: CreditCard },
    { key: "menunggu", label: "Konfirmasi", icon: Clock },
    { key: "diproses", label: "Diproses", icon: Package },
    { key: "dikirim", label: "Dikirim", icon: Truck },
    { key: "selesai", label: "Selesai", icon: CheckCircle2 },
];
