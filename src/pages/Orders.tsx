import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Calendar, ChevronDown, ChevronUp, MapPin, Phone, CreditCard, FileText, ArrowRight, Clock, AlertTriangle, CheckCircle2, XCircle, Wallet, Bell, Upload, Image, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { SummaryCards } from "@/components/orders/SummaryCards";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import { useSellerStore } from "@/hooks/useSellerStore";
import {
    type Order, type OrderStatus,
    statusTabs, statusConfig, getNextStatus,
} from "@/types/order";

type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

const paymentStatusConfig: Record<PaymentStatus, { label: string; color: string; bgColor: string }> = {
    unpaid: { label: "Belum Bayar", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" },
    pending: { label: "Menunggu Bayar", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
    paid: { label: "Lunas", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
    failed: { label: "Gagal", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

function getOrderDeadlineInfo(deadline: string, status: OrderStatus) {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isActive = status === "menunggu" || status === "diproses" || status === "dikirim";

    if (!isActive) {
        return { text: formatDate(deadline), isOverdue: false, isUrgent: false };
    }

    if (diffDays < 0) {
        return { text: `Terlambat ${Math.abs(diffDays)} hari`, isOverdue: true, isUrgent: false };
    } else if (diffDays === 0) {
        return { text: "Hari ini", isOverdue: false, isUrgent: true };
    } else if (diffDays === 1) {
        return { text: "Besok", isOverdue: false, isUrgent: true };
    } else {
        return { text: `${diffDays} hari lagi`, isOverdue: false, isUrgent: diffDays <= 2 };
    }
}

function groupOrdersByMonth(orders: Order[]): { month: string; orders: Order[] }[] {
    const groups: Record<string, Order[]> = {};
    for (const order of orders) {
        const date = parseISO(order.date);
        const key = format(date, "yyyy-MM");
        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
    }
    return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, items]) => ({
            month: format(parseISO(key + "-01"), "MMMM yyyy", { locale: idLocale }),
            orders: items,
        }));
}

export default function Orders() {
    const [activeTab, setActiveTab] = useState<"semua" | OrderStatus>("semua");
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [dateAfter, setDateAfter] = useState("");
    const [dateBefore, setDateBefore] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { notifications, markAsRead } = useNotification();
    const { toast } = useToast();
    const { data: sellerStore } = useSellerStore();
    const storeId = sellerStore?.id ?? null;
    const queryClient = useQueryClient();
    const expandedRef = useRef<HTMLDivElement | null>(null);
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    // Delivery proof upload state
    const [proofOrderId, setProofOrderId] = useState<string | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isUploadingProof, setIsUploadingProof] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);

    // Unread notifications relevant to orders
    const orderNotifications = useMemo(() => {
        return notifications.filter(n =>
            !n.read && (n.type === "payment" || n.type === "order" || n.type === "order_status") &&
            (n.actionUrl === "/orders")
        );
    }, [notifications]);

    const orderQueryKey = ['seller-orders', storeId] as const;

    const { data: orders = [], isLoading } = useQuery({
        queryKey: orderQueryKey,
        queryFn: async () => {
            if (!user || !storeId) return [] as Order[];

            const { data, error } = await supabase
                .from("orders")
                .select(`
                    id,
                    buyer_id,
                    status,
                    total_amount,
                    delivery_type,
                    delivery_address,
                    delivery_proof_url,
                    deadline,
                    created_at,
                    updated_at,
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        product:product_id (
                            name,
                            image_url
                        )
                    ),
                    transactions (
                        payment_status,
                        payment_method,
                        payment_code
                    )
                `)
                .eq("store_id", storeId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            let buyerProfilesMap: Record<string, { name: string; email: string }> = {};
            let buyerDetailsMap: Record<string, { phone: string; address: string }> = {};
            if (data && data.length > 0) {
                const buyerIds = [...new Set(data.map((d: any) => d.buyer_id).filter(Boolean))];
                if (buyerIds.length > 0) {
                    const [profilesRes, bpRes] = await Promise.all([
                        supabase.from("profiles").select("id, name, email").in("id", buyerIds),
                        supabase.from("buyer_profiles").select("user_id, phone, address").in("user_id", buyerIds),
                    ]);
                    if (profilesRes.data) {
                        profilesRes.data.forEach((p: any) => { buyerProfilesMap[p.id] = { name: p.name || "", email: p.email || "" }; });
                    }
                    if (bpRes.data) {
                        bpRes.data.forEach((bp: any) => { buyerDetailsMap[bp.user_id] = { phone: bp.phone || "", address: bp.address || "" }; });
                    }
                }
            }

            if (!data) return [] as Order[];
            return data.map((d: any) => {
                const buyerProfile = buyerProfilesMap[d.buyer_id] || { name: "Customer", email: "" };
                const buyerDetail = buyerDetailsMap[d.buyer_id] || { phone: "", address: "" };
                const paymentMethod = d.transactions?.[0]?.payment_code || d.transactions?.[0]?.payment_method || "-";
                const itemsTotal = d.order_items.reduce((sum: number, i: any) => sum + (Number(i.unit_price) * i.quantity), 0);
                const deliveryFee = Math.max(0, Number(d.total_amount) - itemsTotal);
                return {
                    id: d.id,
                    orderNumber: `ORD-${d.id.substring(0, 8).toUpperCase()}`,
                    date: d.created_at,
                    buyerName: buyerProfile.name || "Customer",
                    buyerEmail: buyerProfile.email,
                    buyerPhone: buyerDetail.phone,
                    shippingAddress: d.delivery_address || buyerDetail.address || "-",
                    paymentMethod: paymentMethod === "cod" ? "COD" : paymentMethod,
                    status: d.status as OrderStatus,
                    total: Number(d.total_amount),
                    subtotal: itemsTotal,
                    shippingCost: deliveryFee,
                    items: d.order_items.map((i: any) => ({
                        name: i.product?.name || "Product",
                        quantity: i.quantity,
                        price: Number(i.unit_price),
                        image: i.product?.image_url || "",
                    })),
                    delivery: { type: d.delivery_type || "ambil_sendiri", address: d.delivery_address || "", courier: {} },
                    payment: { method: paymentMethod, status: (d.transactions?.[0]?.payment_status || "unpaid") as PaymentStatus },
                    updatedAt: new Date(d.updated_at).toLocaleString("id-ID"),
                    deadline: d.deadline || new Date(new Date(d.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
                    notes: "",
                    deliveryProofUrl: d.delivery_proof_url || undefined,
                } as Order;
            });
        },
        enabled: !!user && !!storeId,
        staleTime: Infinity, // realtime subscription handles freshness
    });

    // Real-time subscription — invalidates the query instead of direct re-fetch
    useEffect(() => {
        if (!user || !storeId) return;

        const channel = supabase
            .channel("seller-orders-updates")
            .on(
                "postgres_changes" as any,
                { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
                () => { queryClient.invalidateQueries({ queryKey: orderQueryKey }); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, storeId]);

    // Deep-link: expand order from ?orderId=xxx (e.g. from notification)
    useEffect(() => {
        const targetId = searchParams.get("orderId");
        if (!targetId || orders.length === 0) return;
        const target = orders.find((o) => o.id === targetId);
        if (!target) return;
        setSearchParams({}, { replace: true });
        if (isMobile) {
            navigate(`/orders/${targetId}`, { state: { order: target } });
        } else {
            setExpandedId(targetId);
            setActiveTab("semua");
            setTimeout(() => {
                expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
        }
    }, [searchParams, orders, isMobile]);

    const filtered = useMemo(() => {
        return orders.filter((o) => {
            const matchTab = activeTab === "semua" || o.status === activeTab;
            const needle = search.trim().toLowerCase();
            const matchSearch = o.orderNumber.toLowerCase().includes(needle) || o.buyerName.toLowerCase().includes(needle);
            const orderDate = startOfDay(parseISO(o.date));
            const matchAfter = !dateAfter || isAfter(orderDate, startOfDay(parseISO(dateAfter))) || orderDate.getTime() === startOfDay(parseISO(dateAfter)).getTime();
            const matchBefore = !dateBefore || isBefore(orderDate, startOfDay(parseISO(dateBefore))) || orderDate.getTime() === startOfDay(parseISO(dateBefore)).getTime();
            return matchTab && matchSearch && matchAfter && matchBefore;
        });
    }, [orders, activeTab, search, dateAfter, dateBefore]);

    const grouped = useMemo(() => groupOrdersByMonth(filtered), [filtered]);

    const handleStatusUpdate = async (orderId: string) => {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;
        
        const currentOrder = orders[orderIndex];
        const next = getNextStatus(currentOrder.status);
        if (!next) return;

        // When moving to "dikirim", require delivery proof upload first
        if (next === "dikirim") {
            setProofOrderId(orderId);
            return;
        }

        // Seller cannot advance from "dikirim" to "selesai" — buyer must confirm
        if (next === "selesai") {
            toast({ title: "Menunggu Konfirmasi Pembeli", description: "Pesanan akan otomatis selesai setelah pembeli mengkonfirmasi penerimaan barang." });
            return;
        }

        // Optimistic update
        queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
            (prev || []).map(o => o.id === orderId ? { ...o, status: next, updatedAt: new Date().toLocaleString("id-ID") } : o)
        );

        try {
            await supabase.from("orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", orderId);
        } catch (error) {
            console.error(error);
            // Revert on error
            queryClient.invalidateQueries({ queryKey: orderQueryKey });
        }
    };

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast({ title: "Format Tidak Didukung", description: "Harap unggah file gambar (JPG, PNG, dll).", variant: "destructive" });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: "File Terlalu Besar", description: "Ukuran maksimal 5MB.", variant: "destructive" });
            return;
        }
        setProofFile(file);
        // BUG-023 FIX: Revoke previous blob URL to prevent memory leak
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setProofPreview(URL.createObjectURL(file));
    };

    const handleSubmitProof = async () => {
        if (!proofOrderId || !proofFile || !user) return;
        setIsUploadingProof(true);
        try {
            const ext = proofFile.name.split(".").pop() || "jpg";
            const path = `${user.id}/${proofOrderId}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from("delivery-proofs")
                .upload(path, proofFile, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from("delivery-proofs").getPublicUrl(path);
            const proofUrl = urlData.publicUrl;

            await supabase.from("orders").update({
                status: "dikirim",
                delivery_proof_url: proofUrl,
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("id", proofOrderId);

            // Optimistic update
            queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
                (prev || []).map(o => o.id === proofOrderId ? { ...o, status: "dikirim" as OrderStatus, deliveryProofUrl: proofUrl, updatedAt: new Date().toLocaleString("id-ID") } : o)
            );

            // Notify buyer that order has been shipped
            const order = orders.find(o => o.id === proofOrderId);
            if (order) {
                // Find buyer_id from the raw data — we stored it during fetch
                const { data: orderRow } = await supabase.from("orders").select("buyer_id").eq("id", proofOrderId).single();
                if (orderRow) {
                    await supabase.from("notifications").insert({
                        user_id: orderRow.buyer_id,
                        title: `Pesanan Dikirim — ${order.orderNumber}`,
                        message: `Pesananmu sedang dalam pengiriman. Konfirmasi setelah barang diterima.`,
                        type: "order_status",
                        action_url: "/transaksi",
                        order_id: proofOrderId,
                    });
                }
            }

            toast({ title: "Bukti Pengiriman Diunggah", description: "Pesanan ditandai sebagai dikirim." });
        } catch (err: any) {
            console.error("Upload proof error:", err);
            toast({ title: "Gagal Mengunggah", description: err.message || "Terjadi kesalahan.", variant: "destructive" });
        } finally {
            setIsUploadingProof(false);
            setProofOrderId(null);
            setProofFile(null);
            setProofPreview(null);
        }
    };

    const handleCancelProof = () => {
        setProofOrderId(null);
        setProofFile(null);
        setProofPreview(null);
    };

    const handleCancel = async (orderId: string) => {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;
        
        const currentOrder = orders[orderIndex];

        queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
            (prev || []).map(o => o.id === orderId ? { ...o, status: "dibatalkan" as OrderStatus, updatedAt: new Date().toLocaleString("id-ID") } : o)
        );

        try {
            await supabase.from("orders").update({ status: "dibatalkan", updated_at: new Date().toISOString() }).eq("id", orderId);
        } catch (error) {
            console.error(error);
            queryClient.invalidateQueries({ queryKey: orderQueryKey });
        }
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto">
            {/* Notification banner for new orders */}
            {orderNotifications.length > 0 && (
                <div className="mb-3 sm:mb-4 space-y-2">
                    {orderNotifications.slice(0, 3).map((notif) => (
                        <div
                            key={notif.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 shadow-sm cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/30 transition-colors animate-fade-in"
                            onClick={() => markAsRead(notif.id)}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                                <Bell className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">{notif.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: idLocale })}
                            </span>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        </div>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-3 sm:-mx-6 px-3 sm:px-6 pb-3 sm:pb-4 pt-1 sm:pt-2 border-b border-border mb-3 sm:mb-6">
                <h1 className="text-lg sm:text-2xl font-bold text-foreground mb-0.5 sm:mb-1">Pesanan</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{filtered.length} pesanan</p>

                {/* Status tabs */}
                <div className="flex gap-0.5 sm:gap-1 rounded-lg bg-muted p-0.5 sm:p-1 overflow-x-auto mb-3 sm:mb-4">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0",
                                activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background"
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari pesanan atau pembeli…" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} className="pl-10" />
                    </div>
                    <div className="relative sm:w-[170px]">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input type="date" value={dateAfter} onChange={(e) => setDateAfter(e.target.value)} className="pl-10 w-full" title="Setelah" />
                        <span className="absolute -top-2 left-3 text-xs bg-background px-1 text-muted-foreground">Setelah</span>
                    </div>
                    <div className="relative sm:w-[170px]">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input type="date" value={dateBefore} onChange={(e) => setDateBefore(e.target.value)} className="pl-10 w-full" title="Sebelum" />
                        <span className="absolute -top-2 left-3 text-xs bg-background px-1 text-muted-foreground">Sebelum</span>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <SummaryCards orders={orders} />

            {/* Order list grouped by month */}
            {isLoading ? (
                <div className="text-center py-16"><p className="text-muted-foreground">Memuat pesanan...</p></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16"><p className="text-muted-foreground">Tidak ada pesanan ditemukan</p></div>
            ) : (
                <div className="space-y-4 sm:space-y-6">
                    {grouped.map((group) => (
                        <div key={group.month}>
                            <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3 px-1">{group.month}</h2>
                            <div className="space-y-2 sm:space-y-3">
                                {group.orders.map((order) => {
                                    const config = statusConfig[order.status] || statusConfig.menunggu;
                                    const expanded = expandedId === order.id;
                                    const nextStatus = getNextStatus(order.status);
                                    const nextConfig = nextStatus ? statusConfig[nextStatus] : null;
                                    const paymentInfo = (order as any).payment;
                                    const ps: PaymentStatus = paymentInfo?.status || "unpaid";
                                    const pc = paymentStatusConfig[ps] || paymentStatusConfig.unpaid;

                                    return (
                                        <div
                                            key={order.id}
                                            ref={expandedId === order.id ? expandedRef : null}
                                            className="rounded-lg sm:rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
                                        >
                                            {/* Collapsed row */}
                                            <button className="w-full flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 text-left" onClick={() => {
                                                if (isMobile) {
                                                    navigate(`/orders/${order.id}`, { state: { order } });
                                                } else {
                                                    setExpandedId(expanded ? null : order.id);
                                                }
                                            }}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm">{order.orderNumber}</span>
                                                        <Badge variant="outline" className={cn("text-xs border", config.bgColor, config.color)}>
                                                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", config.dotColor)} />
                                                            {config.label}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn("text-xs border", pc.bgColor, pc.color)}>
                                                            {pc.label}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">{order.buyerName} · {formatDate(order.date)}</p>
                                                </div>
                                                <span className="font-bold text-sm sm:text-base text-primary whitespace-nowrap">{formatCurrency(order.total)}</span>
                                                {isMobile
                                                    ? <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : expanded
                                                        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                            </button>

                                            {/* Expanded detail — desktop only */}
                                            {expanded && !isMobile && (
                                                <div className="border-t border-border px-3 sm:px-4 pb-3 sm:pb-4 pt-2.5 sm:pt-3 space-y-3 sm:space-y-4 animate-fade-in">
                                                    {/* Items */}
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-2">ITEM PESANAN</p>
                                                        <div className="space-y-2">
                                                            {order.items.map((item, i) => (
                                                                <div key={i} className="flex items-center gap-3">
                                                                    <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium truncate">{item.name}</p>
                                                                        <p className="text-xs text-muted-foreground">{item.quantity}× {formatCurrency(item.price)}</p>
                                                                    </div>
                                                                    <span className="text-sm font-medium">{formatCurrency(item.quantity * item.price)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Buyer info */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                        <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span className="text-muted-foreground">{order.shippingAddress}</span></div>
                                                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-muted-foreground">{order.buyerPhone}</span></div>
                                                        <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-muted-foreground">{order.paymentMethod}</span></div>
                                                        {order.notes && <div className="flex items-start gap-2"><FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span className="text-muted-foreground italic">{order.notes}</span></div>}
                                                    </div>

                                                    {/* Deadline */}
                                                    {(() => {
                                                        const isActive = order.status === "menunggu" || order.status === "diproses" || order.status === "dikirim";
                                                        const info = getOrderDeadlineInfo(order.deadline, order.status);
                                                        return (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                {info.isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                                <span className="text-muted-foreground">Deadline: {formatDate(order.deadline)}</span>
                                                                {isActive && (
                                                                    <Badge variant="outline" className={cn("text-xs", info.isOverdue ? "border-red-200 bg-red-50 text-red-700" : info.isUrgent ? "border-orange-200 bg-orange-50 text-orange-700" : "border-blue-200 bg-blue-50 text-blue-700")}>
                                                                        {info.text}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Totals */}
                                                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                                                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
                                                        <div className="flex justify-between text-muted-foreground"><span>Ongkir</span><span>{formatCurrency(order.shippingCost)}</span></div>
                                                        <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{formatCurrency(order.total)}</span></div>
                                                    </div>

                                                    {/* Delivery proof image */}
                                                    {order.deliveryProofUrl && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-muted-foreground">BUKTI PENGIRIMAN</p>
                                                            <a href={order.deliveryProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                                                                <img src={order.deliveryProofUrl} alt="Bukti pengiriman" className="max-h-48 rounded-lg border border-border object-contain" />
                                                            </a>
                                                        </div>
                                                    )}

                                                    {/* Status info for dikirim (waiting for buyer) */}
                                                    {order.status === "dikirim" && (
                                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 text-sm text-violet-700 dark:text-violet-400">
                                                            <Clock className="h-4 w-4 shrink-0" />
                                                            <span>Menunggu konfirmasi penerimaan dari pembeli</span>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    {order.status !== "selesai" && order.status !== "dibatalkan" && order.status !== "dikirim" && (
                                                        <div className="flex gap-2 pt-1">
                                                            {nextStatus && nextConfig && (
                                                                <Button size="sm" onClick={() => handleStatusUpdate(order.id)}>
                                                                    {nextStatus === "dikirim" ? (
                                                                        <><Upload className="h-3.5 w-3.5 mr-1" /> Kirim & Upload Bukti</>
                                                                    ) : (
                                                                        <>{nextConfig.label} <ArrowRight className="h-3.5 w-3.5 ml-1" /></>
                                                                    )}
                                                                </Button>
                                                            )}
                                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleCancel(order.id)}>Batalkan</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delivery proof upload overlay */}
            {proofOrderId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-card rounded-xl border border-border shadow-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold">Upload Bukti Pengiriman</h3>
                        <p className="text-sm text-muted-foreground">
                            Unggah foto resi pengiriman atau screenshot aplikasi kurir sebagai bukti bahwa pesanan telah dikirim.
                        </p>

                        <input
                            ref={proofInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleProofFileChange}
                        />

                        {proofPreview ? (
                            <div className="space-y-2">
                                <img src={proofPreview} alt="Preview" className="max-h-56 w-full rounded-lg border border-border object-contain" />
                                <Button variant="outline" size="sm" onClick={() => proofInputRef.current?.click()}>
                                    Ganti Foto
                                </Button>
                            </div>
                        ) : (
                            <button
                                onClick={() => proofInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                                <Image className="h-8 w-8" />
                                <span className="text-sm font-medium">Klik untuk pilih foto</span>
                                <span className="text-xs">JPG, PNG — Maks 5MB</span>
                            </button>
                        )}

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={handleCancelProof} disabled={isUploadingProof}>
                                Batal
                            </Button>
                            <Button onClick={handleSubmitProof} disabled={!proofFile || isUploadingProof}>
                                {isUploadingProof ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Mengunggah...</>
                                ) : (
                                    <><Upload className="h-4 w-4 mr-1" /> Kirim</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
