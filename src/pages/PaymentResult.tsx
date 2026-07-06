import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type PaymentStatus = "success" | "pending" | "failed" | "loading";

export default function PaymentResult() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<PaymentStatus>("loading");
    const [orderDetails, setOrderDetails] = useState<{
        orderId: string;
        transactionStatus: string;
    } | null>(null);

    const orderId = searchParams.get("order_id") || "";
    const transactionStatus = searchParams.get("transaction_status") || "";

    useEffect(() => {
        if (!orderId) {
            setStatus("failed");
            return;
        }

        setOrderDetails({
            orderId: orderId,
            transactionStatus: transactionStatus,
        });

        // Map Midtrans statuses
        if (["capture", "settlement"].includes(transactionStatus)) {
            setStatus("success");
        } else if (transactionStatus === "pending") {
            setStatus("pending");
        } else if (["cancel", "deny", "expire"].includes(transactionStatus)) {
            setStatus("failed");
        } else {
            // Unknown or missing — check backend
            setStatus("loading");
        }

        // Poll the backend for definitive status
        const checkBackend = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const response = await fetch("/api/payment", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ action: "check-status", order_id: orderId }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const ts = data.transaction_status;
                    if (["capture", "settlement"].includes(ts)) setStatus("success");
                    else if (ts === "pending") setStatus("pending");
                    else if (["cancel", "deny", "expire"].includes(ts)) setStatus("failed");
                }
            } catch {
                // Ignore — we already have the redirect result
            }
        };

        const timer = setTimeout(checkBackend, 2000);
        return () => clearTimeout(timer);
    }, [orderId, transactionStatus]);

    const statusConfig = {
        loading: {
            icon: <Clock className="h-16 w-16 text-muted-foreground animate-pulse" />,
            title: "Memproses...",
            description: "Mohon tunggu, kami sedang mengecek status pembayaran Anda.",
            bgClass: "bg-muted/30",
            borderClass: "border-muted",
        },
        success: {
            icon: <CheckCircle2 className="h-16 w-16 text-emerald-500" />,
            title: "Pembayaran Berhasil!",
            description: "Terima kasih! Pembayaran Anda telah dikonfirmasi. Penjual akan segera memproses pesanan Anda.",
            bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
            borderClass: "border-emerald-200 dark:border-emerald-800",
        },
        pending: {
            icon: <Clock className="h-16 w-16 text-amber-500" />,
            title: "Menunggu Pembayaran",
            description: "Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran sebelum batas waktu.",
            bgClass: "bg-amber-50 dark:bg-amber-950/20",
            borderClass: "border-amber-200 dark:border-amber-800",
        },
        failed: {
            icon: <XCircle className="h-16 w-16 text-red-500" />,
            title: "Pembayaran Gagal",
            description: "Maaf, pembayaran Anda tidak berhasil atau telah dibatalkan. Silakan coba lagi.",
            bgClass: "bg-red-50 dark:bg-red-950/20",
            borderClass: "border-red-200 dark:border-red-800",
        },
    };

    const config = statusConfig[status];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
            <div className={`max-w-md w-full rounded-2xl border-2 ${config.borderClass} ${config.bgClass} p-8 text-center space-y-6 shadow-xl transition-all duration-500`}>
                <div className="flex justify-center animate-in zoom-in-50 duration-500">
                    {config.icon}
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">{config.title}</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {config.description}
                    </p>
                </div>

                {orderDetails && (
                    <div className="bg-background/60 rounded-xl p-4 text-sm space-y-2 border">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Order ID</span>
                            <span className="font-mono text-xs truncate max-w-[180px]">{orderDetails.orderId}</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                    {status === "success" && (
                        <Button onClick={() => navigate("/transaksi")} className="w-full" size="lg">
                            <ShoppingBag className="h-4 w-4 mr-2" /> Lihat Pesanan Saya
                        </Button>
                    )}
                    {status === "pending" && (
                        <Button onClick={() => window.location.reload()} variant="outline" className="w-full" size="lg">
                            <Clock className="h-4 w-4 mr-2" /> Cek Status Lagi
                        </Button>
                    )}
                    {status === "failed" && (
                        <Button onClick={() => navigate("/toko")} className="w-full" size="lg">
                            <ShoppingBag className="h-4 w-4 mr-2" /> Kembali Belanja
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate("/toko")} className="w-full text-muted-foreground">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Beranda
                    </Button>
                </div>
            </div>
        </div>
    );
}
