import { Clock, Truck, Package, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/types/order";

export function SummaryCards({ orders }: { orders: Order[] }) {
    const totalRevenue = orders.filter((o) => o.status === "selesai").reduce((sum, o) => sum + o.total, 0);
    const pendingCount = orders.filter((o) => o.status === "menunggu").length;
    const processingCount = orders.filter((o) => o.status === "diproses" || o.status === "dikirim").length;

    const cards = [
        { label: "Total Pendapatan", value: formatCurrency(totalRevenue), color: "text-emerald-600", bg: "bg-emerald-50", icon: CreditCard },
        { label: "Pesanan Masuk", value: String(pendingCount), color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
        { label: "Sedang Diproses", value: String(processingCount), color: "text-blue-600", bg: "bg-blue-50", icon: Truck },
        { label: "Total Pesanan", value: String(orders.length), color: "text-primary", bg: "bg-primary/5", icon: Package },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
            {cards.map((c) => (
                <div key={c.label} className="rounded-lg sm:rounded-xl border border-border bg-card p-2.5 sm:p-4 shadow-sm flex items-center gap-2.5 sm:gap-4">
                    <div className={cn("h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0", c.bg)}>
                        <c.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", c.color)} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{c.label}</p>
                        <p className={cn("text-sm sm:text-lg font-bold truncate", c.color)}>{c.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
