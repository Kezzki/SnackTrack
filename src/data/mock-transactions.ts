import type { Transaction } from "@/types/transaction";

export const mockTransactions: Transaction[] = [
    { id: "1", orderNumber: "TRX-20260218-001", storeName: "Toko Camilan Enak", items: [{ name: "Keripik Singkong Pedas", quantity: 2, price: 15000 }, { name: "Kacang Mete Panggang", quantity: 1, price: 35000 }], total: 65000, status: "berlangsung", date: "2026-02-18", updatedAt: "2026-02-18 14:30", deadline: "2026-02-21" },
    { id: "2", orderNumber: "TRX-20260217-003", storeName: "Dapur Manis", items: [{ name: "Kue Coklat Lumer", quantity: 3, price: 25000 }], total: 75000, status: "berhasil", date: "2026-02-17", updatedAt: "2026-02-17 16:45", deadline: "2026-02-20" },
    { id: "3", orderNumber: "TRX-20260216-007", storeName: "Snack Corner", items: [{ name: "Popcorn Karamel", quantity: 1, price: 20000 }, { name: "Keripik Kentang BBQ", quantity: 2, price: 18000 }], total: 56000, status: "berhasil", date: "2026-02-16", updatedAt: "2026-02-16 11:20", deadline: "2026-02-19" },
    { id: "4", orderNumber: "TRX-20260215-012", storeName: "Manis Sejati", items: [{ name: "Permen Stroberi", quantity: 5, price: 10000 }], total: 50000, status: "tidak_berhasil", date: "2026-02-15", updatedAt: "2026-02-15 09:10", deadline: "2026-02-18" },
    { id: "5", orderNumber: "TRX-20260220-002", storeName: "Toko Camilan Enak", items: [{ name: "Keripik Singkong Pedas", quantity: 4, price: 15000 }], total: 60000, status: "berlangsung", date: "2026-02-20", updatedAt: "2026-02-20 10:15", deadline: "2026-02-23" },
    { id: "6", orderNumber: "TRX-20260214-005", storeName: "Dapur Manis", items: [{ name: "Kue Coklat Lumer", quantity: 1, price: 25000 }, { name: "Popcorn Karamel", quantity: 2, price: 20000 }], total: 65000, status: "berhasil", date: "2026-02-14", updatedAt: "2026-02-14 13:00", deadline: "2026-02-17" },
];
