import { useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, MapPin, Phone, CreditCard, FileText, Clock,
    AlertTriangle, Upload, Image, Loader2, ArrowRight,
    CheckCircle2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSellerStore } from "@/hooks/useSellerStore";
import {
    type Order, type OrderStatus,
    statusConfig, getNextStatus,
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

    if (!isActive) return { text: formatDate(deadline), isOverdue: false, isUrgent: false };
    if (diffDays < 0) return { text: `Terlambat ${Math.abs(diffDays)} hari`, isOverdue: true, isUrgent: false };
    if (diffDays === 0) return { text: "Hari ini", isOverdue: false, isUrgent: true };
    if (diffDays === 1) return { text: "Besok", isOverdue: false, isUrgent: true };
    return { text: `${diffDays} hari lagi`, isOverdue: false, isUrgent: diffDays <= 2 };
}

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: sellerStore } = useSellerStore();
    const storeId = sellerStore?.id ?? null;
    const queryClient = useQueryClient();

    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isUploadingProof, setIsUploadingProof] = useState(false);
    const [showProofUpload, setShowProofUpload] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);

    // Order passed via navigate() state (from the list page) — skip network fetch
    const navOrder = (location.state as any)?.order as (Order & { payment: any }) | undefined;
    const orderQueryKey = ["seller-orders", storeId] as const;

    const { data: fetchedOrder, isLoading } = useQuery({
        queryKey: ["seller-order-detail", id, storeId],
        queryFn: async () => {
            // Try the already-loaded list cache first
            const cached = queryClient.getQueryData<Order[]>(orderQueryKey);
            if (cached) {
                const found = cached.find((o) => o.id === id);
                if (found) return found as Order & { payment: any };
            }

            // Otherwise fetch directly
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    id, buyer_id, status, total_amount, delivery_type, delivery_address,
                    delivery_proof_url, deadline, created_at, updated_at,
                    order_items (id, quantity, unit_price, product:product_id (name, image_url)),
                    transactions (payment_status, payment_method, payment_code)
                `)
                .eq("id", id!)
                .eq("store_id", storeId!)
                .single();

            if (error) throw error;
            if (!data) return null;

            const [profileRes, bpRes] = await Promise.all([
                supabase.from("profiles").select("id, name, email").eq("id", (data as any).buyer_id).single(),
                supabase.from("buyer_profiles").select("user_id, phone, address").eq("user_id", (data as any).buyer_id).single(),
            ]);

            const bp = (profileRes.data as any) || { name: "Customer", email: "" };
            const bd = (bpRes.data as any) || { phone: "", address: "" };
            const paymentMethod =
                (data as any).transactions?.[0]?.payment_code ||
                (data as any).transactions?.[0]?.payment_method ||
                "-";
            const itemsTotal = (data as any).order_items.reduce(
                (s: number, i: any) => s + Number(i.unit_price) * i.quantity,
                0,
            );

            return {
                id: (data as any).id,
                orderNumber: `ORD-${(data as any).id.substring(0, 8).toUpperCase()}`,
                date: (data as any).created_at,
                buyerName: bp.name || "Customer",
                buyerEmail: bp.email || "",
                buyerPhone: bd.phone || "",
                shippingAddress: (data as any).delivery_address || bd.address || "-",
                paymentMethod: paymentMethod === "cod" ? "COD" : paymentMethod,
                status: (data as any).status as OrderStatus,
                total: Number((data as any).total_amount),
                subtotal: itemsTotal,
                shippingCost: Math.max(0, Number((data as any).total_amount) - itemsTotal),
                items: (data as any).order_items.map((i: any) => ({
                    name: i.product?.name || "Product",
                    quantity: i.quantity,
                    price: Number(i.unit_price),
                    image: i.product?.image_url || "",
                })),
                payment: {
                    method: paymentMethod,
                    status: ((data as any).transactions?.[0]?.payment_status || "unpaid") as PaymentStatus,
                },
                updatedAt: new Date((data as any).updated_at).toLocaleString("id-ID"),
                deadline:
                    (data as any).deadline ||
                    new Date(
                        new Date((data as any).created_at).getTime() + 24 * 60 * 60 * 1000,
                    ).toISOString(),
                notes: "",
                deliveryProofUrl: (data as any).delivery_proof_url || undefined,
            } as unknown as Order & { payment: any };
        },
        enabled: !!user && !!storeId && !!id && !navOrder,
        staleTime: Infinity,
    });

    const order = navOrder || fetchedOrder;
    const loading = !navOrder && isLoading;

    // ── Action handlers ──────────────────────────────────────────────────

    const handleStatusUpdate = async () => {
        if (!order) return;
        const next = getNextStatus(order.status);
        if (!next) return;

        if (next === "dikirim") {
            setShowProofUpload(true);
            return;
        }
        if (next === "selesai") {
            toast({
                title: "Menunggu Konfirmasi Pembeli",
                description:
                    "Pesanan akan otomatis selesai setelah pembeli mengkonfirmasi penerimaan barang.",
            });
            return;
        }

        queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
            (prev || []).map((o) =>
                o.id === order.id
                    ? { ...o, status: next, updatedAt: new Date().toLocaleString("id-ID") }
                    : o,
            ),
        );
        queryClient.setQueryData(["seller-order-detail", id, storeId], (prev: any) =>
            prev ? { ...prev, status: next, updatedAt: new Date().toLocaleString("id-ID") } : prev,
        );

        try {
            await supabase
                .from("orders")
                .update({ status: next, updated_at: new Date().toISOString() })
                .eq("id", order.id);
        } catch (err) {
            console.error(err);
            queryClient.invalidateQueries({ queryKey: orderQueryKey });
            queryClient.invalidateQueries({ queryKey: ["seller-order-detail", id, storeId] });
        }
    };

    const handleCancel = async () => {
        if (!order) return;

        queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
            (prev || []).map((o) =>
                o.id === order.id ? { ...o, status: "dibatalkan" as OrderStatus } : o,
            ),
        );
        queryClient.setQueryData(["seller-order-detail", id, storeId], (prev: any) =>
            prev ? { ...prev, status: "dibatalkan" as OrderStatus } : prev,
        );

        try {
            await supabase
                .from("orders")
                .update({ status: "dibatalkan", updated_at: new Date().toISOString() })
                .eq("id", order.id);
        } catch (err) {
            console.error(err);
            queryClient.invalidateQueries({ queryKey: orderQueryKey });
        }
    };

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast({
                title: "Format Tidak Didukung",
                description: "Harap unggah file gambar (JPG, PNG, dll).",
                variant: "destructive",
            });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: "File Terlalu Besar",
                description: "Ukuran maksimal 5MB.",
                variant: "destructive",
            });
            return;
        }
        setProofFile(file);
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setProofPreview(URL.createObjectURL(file));
    };

    const handleSubmitProof = async () => {
        if (!order || !proofFile || !user) return;
        setIsUploadingProof(true);
        try {
            const ext = proofFile.name.split(".").pop() || "jpg";
            const path = `${user.id}/${order.id}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from("delivery-proofs")
                .upload(path, proofFile, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from("delivery-proofs")
                .getPublicUrl(path);
            const proofUrl = urlData.publicUrl;

            await supabase
                .from("orders")
                .update({
                    status: "dikirim",
                    delivery_proof_url: proofUrl,
                    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

            queryClient.setQueryData(orderQueryKey, (prev: Order[] | undefined) =>
                (prev || []).map((o) =>
                    o.id === order.id
                        ? { ...o, status: "dikirim" as OrderStatus, deliveryProofUrl: proofUrl }
                        : o,
                ),
            );
            queryClient.setQueryData(["seller-order-detail", id, storeId], (prev: any) =>
                prev
                    ? { ...prev, status: "dikirim" as OrderStatus, deliveryProofUrl: proofUrl }
                    : prev,
            );

            const { data: orderRow } = await supabase
                .from("orders")
                .select("buyer_id")
                .eq("id", order.id)
                .single();
            if (orderRow) {
                await supabase.from("notifications").insert({
                    user_id: orderRow.buyer_id,
                    title: `Pesanan Dikirim — ${order.orderNumber}`,
                    message: `Pesananmu sedang dalam pengiriman. Konfirmasi setelah barang diterima.`,
                    type: "order_status",
                    action_url: "/transaksi",
                    order_id: order.id,
                });
            }

            toast({
                title: "Bukti Pengiriman Diunggah",
                description: "Pesanan ditandai sebagai dikirim.",
            });
            setShowProofUpload(false);
        } catch (err: any) {
            toast({
                title: "Gagal Mengunggah",
                description: err.message || "Terjadi kesalahan.",
                variant: "destructive",
            });
        } finally {
            setIsUploadingProof(false);
            setProofFile(null);
            setProofPreview(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Memuat pesanan...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-muted-foreground">Pesanan tidak ditemukan</p>
                <Button variant="outline" onClick={() => navigate("/orders")}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
                </Button>
            </div>
        );
    }

    const config = statusConfig[order.status] || statusConfig.menunggu;
    const nextStatus = getNextStatus(order.status);
    const nextConfig = nextStatus ? statusConfig[nextStatus] : null;
    const ps: PaymentStatus = (order as any).payment?.status || "unpaid";
    const pc = paymentStatusConfig[ps] || paymentStatusConfig.unpaid;
    const deadlineInfo = getOrderDeadlineInfo(order.deadline, order.status);
    const isActive =
        order.status === "menunggu" || order.status === "diproses" || order.status === "dikirim";

    return (
        <div className="max-w-2xl mx-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-3 sm:-mx-6 px-3 sm:px-6 pb-3 pt-2 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 shrink-0"
                        onClick={() => navigate("/orders")}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-bold leading-tight">{order.orderNumber}</h1>
                        <p className="text-xs text-muted-foreground">
                            {formatDate(order.date)} · {order.buyerName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 mt-2 ml-1 flex-wrap">
                    <Badge
                        variant="outline"
                        className={cn("text-xs border", config.bgColor, config.color)}
                    >
                        <span
                            className={cn(
                                "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                                config.dotColor,
                            )}
                        />
                        {config.label}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn("text-xs border", pc.bgColor, pc.color)}
                    >
                        {pc.label}
                    </Badge>
                </div>
            </div>

            <div className="px-3 sm:px-0 pb-8 space-y-3">
                {/* Items + totals */}
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">ITEM PESANAN</p>
                    <div className="space-y-3">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.quantity}× {formatCurrency(item.price)}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold shrink-0">
                                    {formatCurrency(item.quantity * item.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-border mt-3 pt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Ongkir</span>
                            <span>{formatCurrency(order.shippingCost)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Buyer info */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-muted-foreground">INFO PEMBELI</p>
                    {order.shippingAddress && order.shippingAddress !== "-" && (
                        <div className="flex items-start gap-2.5 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span>{order.shippingAddress}</span>
                        </div>
                    )}
                    {order.buyerPhone && (
                        <div className="flex items-center gap-2.5 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{order.buyerPhone}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{order.paymentMethod}</span>
                    </div>
                    {order.notes && (
                        <div className="flex items-start gap-2.5 text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground italic">{order.notes}</span>
                        </div>
                    )}
                </div>

                {/* Deadline */}
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">DEADLINE</p>
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                        {deadlineInfo.isOverdue ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span>{formatDate(order.deadline)}</span>
                        {isActive && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs",
                                    deadlineInfo.isOverdue
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : deadlineInfo.isUrgent
                                          ? "border-orange-200 bg-orange-50 text-orange-700"
                                          : "border-blue-200 bg-blue-50 text-blue-700",
                                )}
                            >
                                {deadlineInfo.text}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Delivery proof */}
                {order.deliveryProofUrl && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                            BUKTI PENGIRIMAN
                        </p>
                        <a
                            href={order.deliveryProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <img
                                src={order.deliveryProofUrl}
                                alt="Bukti pengiriman"
                                className="max-h-48 w-full rounded-lg border border-border object-contain"
                            />
                        </a>
                    </div>
                )}

                {/* Status banners */}
                {order.status === "dikirim" && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 text-sm text-violet-700 dark:text-violet-400">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>Menunggu konfirmasi penerimaan dari pembeli</span>
                    </div>
                )}
                {order.status === "selesai" && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Pesanan telah selesai</span>
                    </div>
                )}
                {order.status === "dibatalkan" && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Pesanan telah dibatalkan</span>
                    </div>
                )}

                {/* Actions */}
                {order.status !== "selesai" &&
                    order.status !== "dibatalkan" &&
                    order.status !== "dikirim" && (
                        <div className="flex gap-3 pt-1">
                            {nextStatus && nextConfig && (
                                <Button className="flex-1" onClick={handleStatusUpdate}>
                                    {nextStatus === "dikirim" ? (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" /> Kirim & Upload Bukti
                                        </>
                                    ) : (
                                        <>
                                            {nextConfig.label}
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive border-destructive/30"
                                onClick={handleCancel}
                            >
                                Batalkan
                            </Button>
                        </div>
                    )}
            </div>

            {/* Proof upload overlay */}
            {showProofUpload && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                    <div className="bg-card rounded-t-2xl sm:rounded-xl border border-border shadow-lg w-full sm:max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-bold">Upload Bukti Pengiriman</h3>
                        <p className="text-sm text-muted-foreground">
                            Unggah foto resi pengiriman atau screenshot aplikasi kurir sebagai
                            bukti bahwa pesanan telah dikirim.
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
                                <img
                                    src={proofPreview}
                                    alt="Preview"
                                    className="max-h-56 w-full rounded-lg border border-border object-contain"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => proofInputRef.current?.click()}
                                >
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
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowProofUpload(false);
                                    setProofFile(null);
                                    setProofPreview(null);
                                }}
                                disabled={isUploadingProof}
                            >
                                Batal
                            </Button>
                            <Button
                                onClick={handleSubmitProof}
                                disabled={!proofFile || isUploadingProof}
                            >
                                {isUploadingProof ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
                                        Mengunggah...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-1" /> Kirim
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
