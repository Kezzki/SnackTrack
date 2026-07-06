import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Calendar, ChevronDown, ChevronUp, Package, Clock, AlertTriangle, CreditCard, ExternalLink, RefreshCw, Check, Bell, MapPin, Phone, Store, Star, Loader2 } from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/contexts/NotificationContext";
import {
    type Transaction, type TransactionStatus, type PaymentStatus, type OrderStatus,
    statusTabs, statusConfig, paymentStatusConfig, orderSteps,
} from "@/types/transaction";

// Declare Snap global from Midtrans JS
declare global {
    interface Window {
        snap?: {
            pay: (
                token: string,
                options: {
                    onSuccess?: (result: any) => void;
                    onPending?: (result: any) => void;
                    onError?: (result: any) => void;
                    onClose?: () => void;
                }
            ) => void;
        };
    }
}

// Load Midtrans Snap.js dynamically
function loadSnapScript(clientKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.snap) { resolve(); return; }
        const existing = document.getElementById("midtrans-snap-script");
        if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("Failed to load Midtrans")));
            return;
        }
        const script = document.createElement("script");
        script.id = "midtrans-snap-script";
        script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
        script.setAttribute("data-client-key", clientKey);
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Midtrans Snap.js"));
        document.head.appendChild(script);
    });
}

function getDeadlineInfo(deadline: string, status: string) {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (status !== "berlangsung") {
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

function groupByMonth(transactions: Transaction[]): { month: string; transactions: Transaction[] }[] {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
        const date = parseISO(tx.date);
        const key = format(date, "yyyy-MM");
        if (!groups[key]) groups[key] = [];
        groups[key].push(tx);
    }
    return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, txs]) => ({
            month: format(parseISO(key + "-01"), "MMMM yyyy", { locale: idLocale }),
            transactions: txs,
        }));
}

/** Map raw DB order status to our 3-state transaction status */
function mapToTxStatus(orderStatus: string): TransactionStatus {
    if (orderStatus === "selesai") return "berhasil";
    if (orderStatus === "dibatalkan" || orderStatus === "ditolak") return "tidak_berhasil";
    return "berlangsung";
}

/** Order progress stepper component */
function OrderStepper({ orderStatus, paymentStatus }: { orderStatus: OrderStatus; paymentStatus: PaymentStatus }) {
    // For cancelled orders, don't show stepper
    if (orderStatus === "dibatalkan") return null;

    const currentIdx = orderSteps.findIndex(s => s.key === orderStatus);

    return (
        <div className="flex items-center gap-0.5 w-full py-2">
            {orderSteps.map((step, idx) => {
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isPending = idx > currentIdx;
                const isPaymentWaiting = step.key === "menunggu_pembayaran" && (paymentStatus === "pending" || paymentStatus === "unpaid") && isCurrent;
                const StepIcon = step.icon;

                return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div
                                className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300",
                                    isCompleted && "bg-emerald-500 text-white",
                                    isCurrent && !isPaymentWaiting && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                                    isPaymentWaiting && "bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse",
                                    isPending && "bg-muted text-muted-foreground"
                                )}
                            >
                                <StepIcon className="h-3.5 w-3.5" />
                            </div>
                            {isCurrent && (
                                <span className={cn(
                                    "text-[9px] leading-tight font-semibold text-center whitespace-nowrap",
                                    isPaymentWaiting ? "text-amber-600" : "text-primary"
                                )}>
                                    {step.label}
                                </span>
                            )}
                        </div>
                        {idx < orderSteps.length - 1 && (
                            <div className={cn(
                                "h-0.5 flex-1 mx-1 rounded-full transition-all duration-300",
                                isCompleted ? "bg-emerald-400" : "bg-muted"
                            )} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function BuyerTransactions() {
    const [activeTab, setActiveTab] = useState<"semua" | TransactionStatus>("semua");
    const [search, setSearch] = useState("");
    const [dateAfter, setDateAfter] = useState("");
    const [dateBefore, setDateBefore] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [continuingPaymentId, setContinuingPaymentId] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const expandedRef = useRef<HTMLDivElement | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { notifications, markAsRead } = useNotification();
    const queryClient = useQueryClient();
    const txQueryKey = ['buyer-transactions', user?.id] as const;

    // Buyer confirmation & review state
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);

    // Refund request state
    const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
    const [refundReason, setRefundReason] = useState<string>("");
    const [refundDetail, setRefundDetail] = useState<string>("");
    const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

    const handleConfirmReceived = async () => {
        if (!confirmingOrderId || !user) return;
        setIsConfirming(true);
        try {
            // Update order status to selesai
            await supabase.from("orders").update({
                status: "selesai",
                updated_at: new Date().toISOString(),
            }).eq("id", confirmingOrderId);

            // Insert review if rating is provided
            // Get order items to create per-product reviews
            const { data: orderItems } = await supabase
                .from("order_items")
                .select("product_id, quantity")
                .eq("order_id", confirmingOrderId);

            if (orderItems && orderItems.length > 0) {
                const reviewRows = orderItems.map((item: any) => ({
                    order_id: confirmingOrderId,
                    product_id: item.product_id,
                    buyer_id: user.id,
                    rating: reviewRating,
                    comment: reviewComment.trim() || null,
                }));
                await supabase.from("reviews").insert(reviewRows);

                // Increment sold_count and recompute ratings for each product
                const uniqueProductIds: string[] = [...new Set(orderItems.map((i: any) => i.product_id as string))];
                await Promise.all(
                    uniqueProductIds.map(pid =>
                        Promise.all([
                            supabase.rpc("increment_sold_count", { p_product_id: pid, p_amount: orderItems.filter((i: any) => i.product_id === pid).reduce((s: number, i: any) => s + (i.quantity ?? 1), 0) }),
                            supabase.rpc("recalculate_product_rating", { p_product_id: pid }),
                        ])
                    )
                );

                // Recompute store rating
                const tx = transactions.find(t => t.id === confirmingOrderId);
                if (tx?.storeId) {
                    await supabase.rpc("recalculate_store_rating", { p_store_id: tx.storeId });
                }
            }

            // Notify seller & credit seller balance via SECURITY DEFINER RPC
            const tx = transactions.find(t => t.id === confirmingOrderId);
            if (tx?.storeId) {
                const { data: storeRow } = await supabase.from("stores").select("seller_id").eq("id", tx.storeId).single();
                if (storeRow) {
                    const [, creditResult] = await Promise.all([
                        supabase.from("notifications").insert({
                            user_id: storeRow.seller_id,
                            title: `Pesanan Selesai — ${tx.orderNumber}`,
                            message: `Pembeli telah mengkonfirmasi penerimaan barang.${reviewRating ? ` Rating: ${"★".repeat(reviewRating)}${"☆".repeat(5 - reviewRating)}` : ""}`,
                            type: "order_status",
                            action_url: "/orders",
                            order_id: confirmingOrderId,
                        }),
                        supabase.rpc("credit_seller_on_order_complete", { p_order_id: confirmingOrderId }),
                    ]);
                    if (creditResult.error) throw creditResult.error;
                }
            }

            toast({ title: "Pesanan Dikonfirmasi", description: "Terima kasih telah mengkonfirmasi penerimaan barang!" });
            queryClient.invalidateQueries({ queryKey: txQueryKey });
        } catch (err: any) {
            console.error("Confirm received error:", err);
            toast({ title: "Gagal", description: err.message || "Terjadi kesalahan.", variant: "destructive" });
        } finally {
            setIsConfirming(false);
            setConfirmingOrderId(null);
            setReviewRating(5);
            setReviewComment("");
        }
    };

    const handleSubmitRefund = async () => {
        if (isSubmittingRefund) return;
        if (!refundingOrderId || !refundReason || !user) return;
        setIsSubmittingRefund(true);
        let insertedRefundId: string | null = null;
        try {
            const tx = transactions.find(t => t.id === refundingOrderId);
            if (!tx) throw new Error("Transaksi tidak ditemukan");

            // 1. Insert refund_request row
            const { data: requestRow, error: insertError } = await supabase
                .from("refund_requests")
                .insert({
                    order_id: refundingOrderId,
                    buyer_id: user.id,
                    reason: refundReason,
                    reason_detail: refundDetail.trim() || null,
                })
                .select("id")
                .single();
            if (insertError) throw insertError;
            insertedRefundId = requestRow.id;

            // 2. Call the refund API
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch("/api/payment/refund", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    order_id: refundingOrderId,
                    refund_request_id: requestRow.id,
                    reason: refundReason,
                }),
            });

            if (!response.ok) {
                const errBody = await response.json();
                await supabase
                    .from("refund_requests")
                    .update({ status: "cancelled", admin_note: "Gagal menghubungi server pembayaran" })
                    .eq("id", insertedRefundId);
                insertedRefundId = null;
                throw errBody;
            }

            const result = await response.json();

            if (result.status === "refunded") {
                toast({ title: "Refund Berhasil", description: "Dana akan dikembalikan ke metode pembayaran asal dalam 3-7 hari kerja." });
            } else if (result.status === "pending_manual") {
                toast({ title: "Permintaan Diterima", description: result.message || "Admin akan memproses pengembalian dana Anda." });
            } else {
                throw new Error(result.detail || "Gagal memproses refund");
            }

            queryClient.invalidateQueries({ queryKey: txQueryKey });
        } catch (err: any) {
            if (insertedRefundId) {
                await supabase
                    .from("refund_requests")
                    .update({ status: "cancelled", admin_note: "Gagal menghubungi server pembayaran" })
                    .eq("id", insertedRefundId);
            }
            toast({ title: "Gagal", description: err.message || "Terjadi kesalahan.", variant: "destructive" });
        } finally {
            setIsSubmittingRefund(false);
            setRefundingOrderId(null);
            setRefundReason("");
            setRefundDetail("");
        }
    };

    const { data: transactions = [], isLoading } = useQuery({
        queryKey: txQueryKey,
        queryFn: async () => {
            if (!user) return [] as Transaction[];
            // Fetch orders + transaction payment data for this buyer
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    id,
                    status,
                    total_amount,
                    created_at,
                    updated_at,
                    deadline,
                    store_id,
                    delivery_proof_url,
                    store:store_id (
                        name,
                        address,
                        seller_id
                    ),
                    order_items (
                        quantity,
                        unit_price,
                        product:product_id (
                            name
                        )
                    ),
                    transactions (
                        payment_status,
                        payment_method,
                        payment_code,
                        duitku_reference
                    )
                `)
                .eq("buyer_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (data) {
                // Collect unique seller IDs to batch-fetch phone numbers
                const sellerIds = new Set<string>();
                data.forEach((d: any) => {
                    const sid = d.store?.seller_id;
                    if (sid) sellerIds.add(sid);
                });

                // Fetch seller phones from seller_profiles
                let sellerPhoneMap: Record<string, string> = {};
                if (sellerIds.size > 0) {
                    const { data: spData } = await supabase
                        .from("seller_profiles")
                        .select("user_id, shop_telephone")
                        .in("user_id", Array.from(sellerIds));
                    if (spData) {
                        spData.forEach((sp: any) => {
                            if (sp.shop_telephone) sellerPhoneMap[sp.user_id] = sp.shop_telephone;
                        });
                    }
                }

                const mapped: Transaction[] = data.map((d: any) => {
                    const txStatus = mapToTxStatus(d.status);
                    const txRecord = d.transactions?.[0]; // first matching transaction row

                    const items = d.order_items.map((i: any) => ({
                        name: i.product?.name || "Produk",
                        quantity: i.quantity,
                        price: Number(i.unit_price),
                    }));

                    const sellerId = d.store?.seller_id;

                    return {
                        id: d.id,
                        orderNumber: `TRX-${d.id.substring(0, 8).toUpperCase()}`,
                        storeName: d.store?.name || "Toko",
                        date: d.created_at,
                        updatedAt: d.updated_at ? new Date(d.updated_at).toLocaleString("id-ID") : "-",
                        status: txStatus,
                        total: Number(d.total_amount),
                        items,
                        deadline: d.deadline || new Date(new Date(d.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
                        orderStatus: (d.status || "menunggu_pembayaran") as OrderStatus,
                        paymentStatus: (txRecord?.payment_status || "unpaid") as PaymentStatus,
                        paymentMethod: txRecord?.payment_code || txRecord?.payment_method || "-",
                        snapToken: txRecord?.duitku_reference || undefined,
                        sellerStoreName: d.store?.name || undefined,
                        sellerPhone: sellerId ? sellerPhoneMap[sellerId] : undefined,
                        sellerAddress: d.store?.address || undefined,
                        storeId: d.store_id || undefined,
                        deliveryProofUrl: d.delivery_proof_url || undefined,
                    };
                });
                return mapped;
            }
            return [] as Transaction[];
        },
        enabled: !!user,
        staleTime: Infinity, // realtime subscription handles freshness
    });

    // Subscribe to order changes — invalidates cache instead of direct re-fetch
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel("buyer-orders-updates")
            .on(
                "postgres_changes" as any,
                { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
                () => { queryClient.invalidateQueries({ queryKey: txQueryKey }); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Deep-link: expand transaction from ?orderId=xxx (e.g. from notification)
    useEffect(() => {
        const targetId = searchParams.get("orderId");
        if (!targetId || transactions.length === 0) return;
        const exists = transactions.some((t) => t.id === targetId);
        if (!exists) return;
        setExpandedId(targetId);
        setActiveTab("semua");
        setSearchParams({}, { replace: true });
        setTimeout(() => {
            expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
    }, [searchParams, transactions]);

    // Unread notifications relevant to transactions
    const txNotifications = useMemo(() => {
        return notifications.filter(n =>
            !n.read && (n.type === "payment" || n.type === "order" || n.type === "order_status") &&
            (n.actionUrl === "/transaksi" || n.actionUrl === "/transactions")
        );
    }, [notifications]);

    const handleContinuePayment = async (tx: Transaction) => {
        if (!tx.snapToken) {
            toast({ title: "Sesi Pembayaran Habis", description: "Silakan hubungi penjual untuk membuat pesanan ulang.", variant: "destructive" });
            return;
        }

        setContinuingPaymentId(tx.id);

        try {
            // Get client key from env or fallback
            const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || "SB-Mid-client-WiWYH_jumlKI7onr";

            await loadSnapScript(clientKey);
            if (!window.snap) {
                toast({ title: "Error", description: "Gagal memuat Midtrans.", variant: "destructive" });
                return;
            }

            const orderId = tx.id;

            // Fallback status sync (same pattern as CheckoutDialog)
            const fallbackStatusSync = async (expectedStatus: "paid" | "pending" | "failed") => {
                try {
                    await new Promise(r => setTimeout(r, 5000));
                    const { data: txCheck } = await supabase
                        .from("transactions")
                        .select("payment_status")
                        .eq("order_id", orderId)
                        .single();
                    const currentPaymentStatus = txCheck?.payment_status;
                    if (currentPaymentStatus === expectedStatus) return;
                    // Never overwrite a settled (paid) order with a failure
                    if (expectedStatus === "failed" && currentPaymentStatus === "paid") return;

                    await supabase.from("transactions").update({
                        payment_status: expectedStatus,
                    }).eq("order_id", orderId);

                    if (expectedStatus === "paid") {
                        await supabase.from("orders").update({
                            status: "menunggu",
                            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                            updated_at: new Date().toISOString(),
                        }).eq("id", orderId);
                    } else if (expectedStatus === "failed") {
                        await supabase.from("orders").update({
                            status: "dibatalkan",
                            updated_at: new Date().toISOString(),
                        }).eq("id", orderId);
                    }
                } catch (err) {
                    console.error("Fallback status sync error:", err);
                }
                queryClient.invalidateQueries({ queryKey: txQueryKey });
            };

            window.snap.pay(tx.snapToken, {
                onSuccess: (result: any) => {
                    console.log("Continue payment success:", result);
                    toast({ title: "Pembayaran Berhasil!", description: "Pesanan Anda sedang diproses oleh penjual." });
                    queryClient.invalidateQueries({ queryKey: txQueryKey });
                    fallbackStatusSync("paid");
                },
                onPending: (result: any) => {
                    console.log("Continue payment pending:", result);
                    toast({ title: "Menunggu Pembayaran", description: "Silakan selesaikan pembayaran Anda." });
                    queryClient.invalidateQueries({ queryKey: txQueryKey });
                    fallbackStatusSync("pending");
                },
                onError: (result: any) => {
                    console.error("Continue payment error:", result);
                    toast({ title: "Pembayaran Gagal", description: "Terjadi kesalahan.", variant: "destructive" });
                    queryClient.invalidateQueries({ queryKey: txQueryKey });
                    fallbackStatusSync("failed");
                },
                onClose: () => {
                    toast({ title: "Pembayaran Ditutup", description: "Anda bisa melanjutkan pembayaran kapan saja dari halaman ini." });
                },
            });
        } catch (err) {
            console.error("Error continuing payment:", err);
            toast({ title: "Error", description: "Gagal membuka kembali pembayaran.", variant: "destructive" });
        } finally {
            setContinuingPaymentId(null);
        }
    };

    const filtered = useMemo(() => {
        return transactions.filter((t) => {
            const matchTab = activeTab === "semua"
                ? !(t.status === "tidak_berhasil" && t.paymentStatus === "failed")
                : t.status === activeTab;
            const needle = search.trim().toLowerCase();
            const matchSearch = t.orderNumber.toLowerCase().includes(needle) || t.storeName.toLowerCase().includes(needle);
            const txDate = startOfDay(parseISO(t.date));
            const matchAfter = !dateAfter || isAfter(txDate, startOfDay(parseISO(dateAfter))) || txDate.getTime() === startOfDay(parseISO(dateAfter)).getTime();
            const matchBefore = !dateBefore || isBefore(txDate, startOfDay(parseISO(dateBefore))) || txDate.getTime() === startOfDay(parseISO(dateBefore)).getTime();
            return matchTab && matchSearch && matchAfter && matchBefore;
        });
    }, [transactions, activeTab, search, dateAfter, dateBefore]);

    const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Notification banner for unread transaction notifications */}
            {txNotifications.length > 0 && (
                <div className="mb-4 space-y-2">
                    {txNotifications.slice(0, 3).map((notif) => (
                        <div
                            key={notif.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 shadow-sm cursor-pointer hover:bg-primary/10 transition-colors animate-fade-in"
                            onClick={() => markAsRead(notif.id)}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Bell className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-primary truncate">{notif.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: idLocale })}
                            </span>
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        </div>
                    ))}
                </div>
            )}

            {/* Sticky header */}
            <div className="sticky top-14 md:top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 pb-3 pt-2 border-b border-border mb-6">
                {/* Title row */}
                <div className="flex items-baseline gap-2 mb-3">
                    <h1 className="text-lg sm:text-2xl font-bold text-foreground">Transaksi Saya</h1>
                    <span className="text-xs sm:text-sm text-muted-foreground">{filtered.length} transaksi</span>
                </div>

                {/* Status tabs — horizontally scrollable on mobile */}
                <div className="flex overflow-x-auto gap-1.5 mb-3 pb-0.5 no-scrollbar">
                    {statusTabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const colorMap: Record<string, { active: string; inactive: string }> = {
                            semua: { active: "bg-primary text-primary-foreground shadow-sm", inactive: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
                            berlangsung: { active: "bg-blue-500 text-white shadow-sm", inactive: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
                            berhasil: { active: "bg-emerald-500 text-white shadow-sm", inactive: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
                            tidak_berhasil: { active: "bg-red-500 text-white shadow-sm", inactive: "bg-red-50 text-red-600 hover:bg-red-100" },
                        };
                        const colors = colorMap[tab.key] || colorMap.semua;
                        return (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0", isActive ? colors.active : colors.inactive)}>
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari transaksi…" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} className="pl-10 h-9 text-sm" />
                </div>
                {/* Date filters */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input type="date" value={dateAfter} onChange={(e) => setDateAfter(e.target.value)} className="h-8 w-full text-xs pr-1 pl-2" title="Setelah" />
                        <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-muted-foreground">Setelah</span>
                    </div>
                    <div className="relative flex-1">
                        <Input type="date" value={dateBefore} onChange={(e) => setDateBefore(e.target.value)} className="h-8 w-full text-xs pr-1 pl-2" title="Sebelum" />
                        <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-muted-foreground">Sebelum</span>
                    </div>
                </div>
            </div>

            {/* Transaction list grouped by month */}
            {isLoading ? (
                <div className="text-center py-16"><p className="text-muted-foreground">Memuat transaksi...</p></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                        <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Tidak ada transaksi</h3>
                    <p className="text-sm text-muted-foreground mt-1">Mulai belanja untuk melihat riwayat transaksi Anda.</p>
                    <Button onClick={() => navigate("/toko")} className="mt-4">Mulai Belanja</Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map((group) => (
                        <div key={group.month}>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{group.month}</h2>
                            <div className="space-y-3">
                                {group.transactions.map((tx) => {
                                    const config = statusConfig[tx.status];
                                    const payConfig = paymentStatusConfig[tx.paymentStatus];
                                    const PayIcon = payConfig.icon;
                                    const expanded = expandedId === tx.id;
                                    const canContinuePayment = tx.paymentStatus === "pending" && tx.orderStatus === "menunggu_pembayaran" && !!tx.snapToken;

                                    return (
                                        <div
                                            key={tx.id}
                                            ref={expandedId === tx.id ? expandedRef : null}
                                            className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md"
                                        >
                                            <button className="w-full flex items-start gap-3 p-3 sm:p-4 text-left" onClick={() => setExpandedId(expanded ? null : tx.id)}>
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                                                    <Package className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {/* Top row: order number + price + chevron */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm truncate flex-1 font-mono">{tx.orderNumber}</span>
                                                        <span className="font-bold text-primary text-sm whitespace-nowrap shrink-0">{formatCurrency(tx.total)}</span>
                                                        {canContinuePayment && (
                                                            <Button
                                                                size="sm"
                                                                className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-0.5 h-6 shrink-0"
                                                                onClick={(e) => { e.stopPropagation(); handleContinuePayment(tx); }}
                                                                disabled={continuingPaymentId === tx.id}
                                                            >
                                                                {continuingPaymentId === tx.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Bayar"}
                                                            </Button>
                                                        )}
                                                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                    </div>
                                                    {/* Badges row */}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 h-4 border leading-none", config.bgColor, config.color)}>{config.label}</Badge>
                                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 h-4 border gap-0.5 leading-none", payConfig.bgColor, payConfig.color)}>
                                                            <PayIcon className="h-2.5 w-2.5" />
                                                            {payConfig.label}
                                                        </Badge>
                                                    </div>
                                                    {/* Store + date */}
                                                    <p className="text-xs text-muted-foreground mt-1 truncate">{tx.storeName} · {formatDate(tx.date)}</p>
                                                    {tx.status === "berlangsung" && (() => {
                                                        const info = getDeadlineInfo(tx.deadline, tx.status);
                                                        return (
                                                            <div className={cn("flex items-center gap-1 text-xs mt-0.5", info.isOverdue ? "text-red-600" : info.isUrgent ? "text-orange-600" : "text-muted-foreground")}>
                                                                {info.isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                                <span>Deadline: {info.text}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </button>

                                            {expanded && (
                                                <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 animate-fade-in">
                                                    {/* Order progress stepper */}
                                                    <div className="bg-muted/30 rounded-xl p-3">
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">STATUS PESANAN</p>
                                                        <OrderStepper orderStatus={tx.orderStatus} paymentStatus={tx.paymentStatus} />
                                                    </div>

                                                    {/* Continue payment button */}
                                                    {canContinuePayment && (
                                                        <Button
                                                            onClick={() => handleContinuePayment(tx)}
                                                            disabled={continuingPaymentId === tx.id}
                                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                                                            size="lg"
                                                        >
                                                            {continuingPaymentId === tx.id ? (
                                                                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Memuat...</>
                                                            ) : (
                                                                <><CreditCard className="h-4 w-4 mr-2" /> Lanjutkan Pembayaran</>
                                                            )}
                                                        </Button>
                                                    )}

                                                    {/* Items breakdown */}
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-2">ITEM PESANAN</p>
                                                        {tx.items.map((item, i) => (
                                                            <div key={i} className="flex justify-between text-sm py-1">
                                                                <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                                                                <span className="font-medium">{formatCurrency(item.quantity * item.price)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="border-t border-border pt-2 flex justify-between font-bold">
                                                        <span>Total</span>
                                                        <span className="text-primary">{formatCurrency(tx.total)}</span>
                                                    </div>

                                                    {/* Seller contact info */}
                                                    {(tx.sellerStoreName || tx.sellerPhone || tx.sellerAddress) && (
                                                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 space-y-2">
                                                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                                                                <Store className="h-3.5 w-3.5" /> INFORMASI PENJUAL
                                                            </p>
                                                            {tx.sellerStoreName && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                    <span className="font-medium">{tx.sellerStoreName}</span>
                                                                </div>
                                                            )}
                                                            {tx.sellerAddress && (
                                                                <div className="flex items-start gap-2 text-sm">
                                                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                                                    <span className="text-muted-foreground">{tx.sellerAddress}</span>
                                                                </div>
                                                            )}
                                                            {tx.sellerPhone && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                    <a
                                                                        href={`https://wa.me/${tx.sellerPhone.replace(/[^0-9]/g, "")}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-primary hover:underline font-medium"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {tx.sellerPhone}
                                                                    </a>
                                                                    <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0">
                                                                        WhatsApp
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Payment & meta info */}
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            <CreditCard className="h-3.5 w-3.5" />
                                                            <span>Metode: {tx.paymentMethod === "cod" ? "COD" : tx.paymentMethod || "-"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            <span>Deadline: {formatDate(tx.deadline)}</span>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground">Terakhir diperbarui: {tx.updatedAt}</p>

                                                    {/* Delivery proof image */}
                                                    {tx.deliveryProofUrl && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-muted-foreground">BUKTI PENGIRIMAN</p>
                                                            <a href={tx.deliveryProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                                                                <img src={tx.deliveryProofUrl} alt="Bukti pengiriman" className="max-h-48 rounded-lg border border-border object-contain" />
                                                            </a>
                                                        </div>
                                                    )}

                                                    {/* Buyer: Confirm received button when order is "dikirim" */}
                                                    {tx.orderStatus === "dikirim" && (
                                                        <div className="space-y-2 pt-1">
                                                            <Button
                                                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                                                                size="lg"
                                                                onClick={() => setConfirmingOrderId(tx.id)}
                                                            >
                                                                <Check className="h-4 w-4 mr-2" /> Konfirmasi Barang Diterima
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* Refund request button */}
                                                    {tx.paymentStatus === "paid" && tx.paymentMethod !== "cod" &&
                                                     ["menunggu", "diproses", "dikirim", "selesai"].includes(tx.orderStatus) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                                                            onClick={() => setRefundingOrderId(tx.id)}
                                                        >
                                                            Ajukan Pengembalian Dana
                                                        </Button>
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

            {/* Confirmation + Review dialog */}
            {confirmingOrderId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-card rounded-xl border border-border shadow-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold">Konfirmasi Penerimaan</h3>
                        <p className="text-sm text-muted-foreground">
                            Apakah Anda sudah menerima barang pesanan ini?
                        </p>

                        {/* Star rating */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Rating untuk penjual</p>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setReviewRating(star)}
                                        className="p-0.5 transition-transform hover:scale-110"
                                    >
                                        <Star
                                            className={cn(
                                                "h-7 w-7 transition-colors",
                                                star <= reviewRating
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "text-muted-foreground/30"
                                            )}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Optional feedback */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Ulasan <span className="text-muted-foreground font-normal">(opsional)</span></p>
                            <Textarea
                                placeholder="Bagaimana pengalaman belanja Anda?"
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setConfirmingOrderId(null);
                                    setReviewRating(5);
                                    setReviewComment("");
                                }}
                                disabled={isConfirming}
                            >
                                Batal
                            </Button>
                            <Button
                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={handleConfirmReceived}
                                disabled={isConfirming}
                            >
                                {isConfirming ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Mengkonfirmasi...</>
                                ) : (
                                    <><Check className="h-4 w-4 mr-1" /> Konfirmasi Diterima</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Refund request dialog */}
            {refundingOrderId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-card rounded-xl border border-border shadow-lg max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold text-destructive">Ajukan Pengembalian Dana</h3>
                        <p className="text-sm text-muted-foreground">Pilih alasan pengembalian dana. Kami akan memproses permintaan Anda.</p>

                        {/* Reason selector */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Alasan</p>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { key: "item_tidak_diterima", label: "Barang tidak diterima" },
                                    { key: "item_rusak", label: "Barang rusak / tidak sesuai" },
                                    { key: "penjual_tidak_respons", label: "Penjual tidak merespons" },
                                    { key: "lainnya", label: "Lainnya" },
                                ].map((r) => (
                                    <button
                                        key={r.key}
                                        onClick={() => setRefundReason(r.key)}
                                        className={cn(
                                            "text-left px-3 py-2 rounded-lg border text-sm transition-colors",
                                            refundReason === r.key
                                                ? "border-destructive bg-destructive/10 text-destructive font-medium"
                                                : "border-border hover:border-destructive/50"
                                        )}
                                    >{r.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Detail textarea */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Keterangan tambahan <span className="text-muted-foreground font-normal">(opsional)</span></p>
                            <Textarea
                                placeholder="Jelaskan masalah yang Anda alami..."
                                value={refundDetail}
                                onChange={(e) => setRefundDetail(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={() => { setRefundingOrderId(null); setRefundReason(""); setRefundDetail(""); }}>
                                Batal
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={!refundReason || isSubmittingRefund}
                                onClick={() => handleSubmitRefund()}
                            >
                                {isSubmittingRefund ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Memproses...</> : "Ajukan Refund"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
