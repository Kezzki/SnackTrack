import { Bell, Package, Tag, Wallet, Trash2, ChevronDown, ChevronUp, ExternalLink, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotification } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types/notification";

const iconMap: Record<string, typeof Bell> = {
    order_status: Package,
    promo: Tag,
    system: Bell,
    payment: Wallet,
    order: Package,
    stock: Bell,
};

const colorMap: Record<string, string> = {
    order: "text-blue-500 bg-blue-50",
    order_status: "text-blue-500 bg-blue-50",
    payment: "text-emerald-500 bg-emerald-50",
    stock: "text-orange-500 bg-orange-50",
    promo: "text-purple-500 bg-purple-50",
    system: "text-red-500 bg-red-50",
};

const TRANSACTION_TYPES = new Set(["order", "order_status", "payment", "stock"]);

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
    notification,
    expanded,
    onToggle,
    onMarkRead,
    onClear,
    onNavigate,
}: {
    notification: Notification;
    expanded: boolean;
    onToggle: (id: string) => void;
    onMarkRead: (id: string) => void;
    onClear: (id: string) => void;
    onNavigate: (notification: Notification) => void;
}) {
    const Icon = iconMap[notification.type] || Bell;
    const colors = colorMap[notification.type] || colorMap.system;
    const isTransaction = TRANSACTION_TYPES.has(notification.type) && (notification.actionUrl || notification.orderId);

    const handleToggle = () => {
        if (!notification.read) onMarkRead(notification.id);
        onToggle(notification.id);
    };

    const handleNavigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigate(notification);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClear(notification.id);
    };

    return (
        <div
            className={cn(
                "rounded-xl border transition-all overflow-hidden",
                notification.read
                    ? "bg-card border-border"
                    : "bg-primary/5 border-primary/20 shadow-sm"
            )}
        >
            {/* Header row */}
            <button
                type="button"
                onClick={handleToggle}
                className="w-full flex items-start gap-3 p-3 text-left"
            >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5", colors)}>
                    <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={cn(
                            "font-semibold text-sm truncate flex-1",
                            notification.read ? "text-foreground" : "text-primary"
                        )}>
                            {notification.title}
                        </h3>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: idLocale })}
                        </span>
                        {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        {expanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </div>
                    <p className={cn(
                        "text-xs text-muted-foreground mt-0.5",
                        expanded ? "" : "line-clamp-1"
                    )}>
                        {notification.message}
                    </p>
                </div>
            </button>

            {/* Expanded section */}
            {expanded && (
                <div className="border-t border-border/60 px-3 pb-3 pt-2 space-y-2">
                    {notification.imageUrl && (
                        <div className="rounded-lg overflow-hidden border border-border">
                            <img
                                src={notification.imageUrl}
                                alt="Notifikasi"
                                className="w-full max-h-52 object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                        </div>
                    )}
                    <p className="text-sm text-foreground leading-relaxed">{notification.message}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                            {isTransaction && (
                                <Button size="sm" variant="default" className="gap-1.5 h-7 text-xs rounded-full" onClick={handleNavigate}>
                                    <ExternalLink className="h-3 w-3" />
                                    Lihat Transaksi
                                </Button>
                            )}
                        </div>
                        <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={handleClear}>
                            <Trash2 className="h-3 w-3" />
                            Hapus
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Notifications() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotification();
    const { activeRole } = useAuth();
    const isSeller = activeRole === "penjual";
    const [filter, setFilter] = useState<"semua" | "transaksi" | "platform">("semua");
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filtered = notifications.filter((n) => {
        if (filter === "semua") return true;
        if (filter === "transaksi") return TRANSACTION_TYPES.has(n.type);
        if (filter === "platform") return ["promo", "system"].includes(n.type);
        return true;
    });

    const handleNavigate = (notification: Notification) => {
        markAsRead(notification.id);
        if (notification.orderId) {
            const base = isSeller ? "/orders" : "/transaksi";
            navigate(`${base}?orderId=${notification.orderId}`);
        } else if (notification.actionUrl) {
            navigate(notification.actionUrl);
        }
    };

    const handleClearAll = () => {
        clearAll();
        setShowClearConfirm(false);
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            {/* Sticky header */}
            <div className="sticky top-14 md:top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 pb-3 pt-3 border-b border-border mb-4">
                {/* Title row */}
                <div className="flex items-center gap-2 mb-3">
                    <h1 className="text-lg font-bold text-foreground flex-1">Notifikasi</h1>
                    {unreadCount > 0 && (
                        <span className="text-[11px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">{unreadCount} belum dibaca</span>
                    )}
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-primary" title="Tandai semua dibaca">
                            <CheckCheck className="h-4 w-4" />
                        </button>
                    )}
                    {notifications.length > 0 && !showClearConfirm && (
                        <button onClick={() => setShowClearConfirm(true)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" title="Hapus semua">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                    {showClearConfirm && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Hapus semua?</span>
                            <button onClick={handleClearAll} className="text-xs font-semibold text-destructive hover:underline">Ya</button>
                            <button onClick={() => setShowClearConfirm(false)} className="text-xs text-muted-foreground hover:underline">Batal</button>
                        </div>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {(["semua", "transaksi", "platform"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                                filter === tab
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab === "semua" ? "Semua" : tab === "transaksi" ? "Transaksi" : "Info Platform"}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                            <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">Tidak ada notifikasi</h3>
                        <p className="text-sm text-muted-foreground mt-1">Saat ini Anda tidak memiliki notifikasi baru.</p>
                    </div>
                ) : (
                    filtered.map((notification) => (
                        <NotificationCard
                            key={notification.id}
                            notification={notification}
                            expanded={expandedIds.has(notification.id)}
                            onToggle={toggleExpanded}
                            onMarkRead={markAsRead}
                            onClear={clearNotification}
                            onNavigate={handleNavigate}
                        />
                    ))
                )}
            </div>
        </div>
    );
}


