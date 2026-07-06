import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Loader2, FlaskConical } from "lucide-react";
import { isPast } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

// Same query key as seller Balance page — one unified balance per user.
const BALANCE_TXS_KEY = (uid: string) => ["balance-transactions", uid];

export default function BuyerBalance() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showTopUp, setShowTopUp] = useState(false);
    const [amountStr, setAmountStr] = useState("");

    // ── Fetch transactions (shared table with seller) ──
    const { data: txs = [], isLoading } = useQuery<any[]>({
        queryKey: BALANCE_TXS_KEY(user?.id ?? ""),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("seller_balance_transactions")
                .select("type, amount, status, available_at")
                .eq("seller_id", user!.id);
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    // ── Compute balance (same logic as seller) ──
    const balance = useMemo(() => {
        let aktif = 0;
        for (const tx of txs) {
            if (tx.status === "failed") continue;
            if (tx.type === "credit") {
                if (
                    tx.status === "completed" ||
                    (tx.status === "pending" && isPast(new Date(tx.available_at)))
                ) {
                    aktif += tx.amount;
                }
            } else if (tx.type === "debit" && tx.status === "completed") {
                aktif -= tx.amount;
            }
        }
        return Math.max(0, aktif);
    }, [txs]);

    // ── Manual top-up mutation ──
    const topUpMutation = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await supabase.from("seller_balance_transactions").insert({
                seller_id: user!.id,
                type: "credit",
                amount,
                status: "completed",
                description: "Isi saldo manual (testing)",
                available_at: new Date().toISOString(),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BALANCE_TXS_KEY(user?.id ?? "") });
            queryClient.invalidateQueries({ queryKey: ["balance-float", user?.id] });
            setShowTopUp(false);
            setAmountStr("");
            toast({ title: "Saldo berhasil ditambahkan" });
        },
        onError: (err: any) => {
            toast({ title: "Gagal menambahkan saldo", description: err.message, variant: "destructive" });
        },
    });

    const handleTopUp = () => {
        const amount = parseInt(amountStr.replace(/\D/g, ""), 10);
        if (!amount || amount <= 0) return;
        topUpMutation.mutate(amount);
    };

    const parsedAmount = parseInt(amountStr.replace(/\D/g, ""), 10) || 0;

    return (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-foreground">Saldo Saya</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Saldo yang dapat digunakan untuk pembayaran</p>
            </div>

            {/* Balance card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Saldo Aktif
                            </p>
                            {isLoading ? (
                                <Skeleton className="h-9 w-40 mt-2" />
                            ) : (
                                <p className="text-3xl font-bold text-foreground mt-1">
                                    {formatCurrency(balance ?? 0)}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">Siap digunakan untuk transaksi</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                            <Wallet className="h-6 w-6 text-primary" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Manual top-up section — DEV only (BUG-002 fix) */}
            {import.meta.env.DEV && (
            <>
            <Card className="border-amber-200/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">Isi Saldo Manual</CardTitle>
                        <Badge
                            variant="outline"
                            className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 gap-1"
                        >
                            <FlaskConical className="h-3 w-3" />
                            Mode Testing
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Tambahkan saldo langsung ke database untuk keperluan testing.
                        Fitur ini hanya untuk digunakan saat payment gateway tidak tersedia.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <Button
                        variant="outline"
                        className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => setShowTopUp(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Saldo
                    </Button>
                </CardContent>
            </Card>

            {/* Top-up dialog */}
            <Dialog open={showTopUp} onOpenChange={(v) => { setShowTopUp(v); if (!v) setAmountStr(""); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-amber-600" />
                            Isi Saldo Manual
                        </DialogTitle>
                        <DialogDescription>
                            Jumlah yang dimasukkan akan langsung ditambahkan ke saldo Anda di database.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-1.5">
                            <Label>Jumlah Saldo</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                                    Rp
                                </span>
                                <Input
                                    className="pl-9"
                                    placeholder="50.000"
                                    value={amountStr ? Number(amountStr.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                                    onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ""))}
                                    inputMode="numeric"
                                    autoFocus
                                />
                            </div>
                            {parsedAmount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Saldo baru: {formatCurrency((balance ?? 0) + parsedAmount)}
                                </p>
                            )}
                        </div>
                        {/* Quick amount buttons */}
                        <div className="flex flex-wrap gap-2">
                            {[10_000, 50_000, 100_000, 200_000, 500_000].map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setAmountStr(String(amt))}
                                    className="px-3 py-1 rounded-full text-xs border border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors"
                                >
                                    +{formatCurrency(amt)}
                                </button>
                            ))}
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleTopUp}
                            disabled={parsedAmount <= 0 || topUpMutation.isPending}
                        >
                            {topUpMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                            ) : (
                                "Tambahkan ke Saldo"
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            </>
            )}
        </div>
    );
}
