import type { Notification } from "@/types/notification";

export const mockNotifications: Notification[] = [
    // Seller notifications
    { id: "1", type: "order", title: "Pesanan baru", message: "Pesanan ORD-20260221-001 dari Rina Wulandari", timestamp: "2026-02-21T10:05:00", read: false, actionUrl: "/orders" },
    { id: "2", type: "payment", title: "Pembayaran dikonfirmasi", message: "Pembayaran Rp 115.000 dikonfirmasi untuk ORD-20260220-004", timestamp: "2026-02-21T08:00:00", read: false, actionUrl: "/orders" },
    { id: "3", type: "stock", title: "Stok menipis", message: "Crispy Chips Original stok tinggal 23 unit", timestamp: "2026-02-20T15:00:00", read: true, actionUrl: "/products" },
    { id: "4", type: "order", title: "Pesanan dikirim", message: "Pesanan ORD-20260219-002 telah dikirim ke Sari Dewi", timestamp: "2026-02-20T09:00:00", read: true, actionUrl: "/orders" },
    // Buyer notifications
    { id: "5", type: "order", title: "Pesanan diproses", message: "Pesanan TRX-20260220-002 sedang diproses", timestamp: "2026-02-20T10:30:00", read: false, actionUrl: "/transactions" },
    { id: "6", type: "order", title: "Pesanan dikirim", message: "Pesanan TRX-20260218-001 telah dikirim", timestamp: "2026-02-19T14:00:00", read: true, actionUrl: "/transactions" },
    { id: "7", type: "promo", title: "Promo weekend", message: "Promo akhir pekan: diskon 20% semua keripik!", timestamp: "2026-02-18T09:00:00", read: true },
    { id: "8", type: "order", title: "Pesanan selesai", message: "Pesanan TRX-20260217-003 telah selesai", timestamp: "2026-02-18T16:00:00", read: true, actionUrl: "/transactions" },
];

export function getNotificationsByRole(isSeller: boolean): Notification[] {
    const sellerTypes: string[] = ["order", "payment", "stock"];
    return mockNotifications.filter((n) => isSeller || !sellerTypes.includes(n.type));
}
