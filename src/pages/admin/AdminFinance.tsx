import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
    DollarSign, TrendingUp, TrendingDown, Clock,
    CheckCircle2, XCircle, Wallet, ArrowDownLeft, ArrowUpRight, BadgePercent, Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BalanceTx {
    id: string;
    seller_id: string;
    type: "credit" | "debit";
    amount: number;
    platform_fee: number;
    status: "pending" | "completed" | "failed";
    description: string | null;
    available_at: string;
    created_at: string;
    payout_account_id: string | null;
}

interface PayoutAccount {
    id: string;
    provider: string;
    account_number: string;
    account_name: string;
    type: "bank" | "ewallet";
}

interface Transaction {
    id: string;
    buyer_id: string;
    seller_id: string;
    amount: number;
    payment_status: string;
    payment_method: string | null;
    transaction_date: string;
    order: { admin_fee: number } | null;
}

interface Profile {
    id: string;
    name: string;
    email: string;
}

interface RefundRequest {
    id: string;
    order_id: string;
    buyer_id: string;
    reason: string;
    reason_detail: string | null;
    status: "pending" | "processing" | "refunded" | "pending_manual" | "rejected" | "cancelled";
    midtrans_refund_id: string | null;
    refund_amount: number | null;
    admin_note: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

const BALANCE_TXS_KEY = ["admin-balance-txs"];
const TRANSACTIONS_KEY = ["admin-transactions"];
const PROFILES_KEY = ["admin-profiles-finance"];
const PAYOUT_ACCOUNTS_KEY = ["admin-payout-accounts"];
const REFUND_REQUESTS_KEY = ["admin-refund-requests"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminFinance() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});

    // Refund requests
    const { data: refundRequests, isLoading: loadingRefunds } = useQuery({
        queryKey: REFUND_REQUESTS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("refund_requests")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data ?? []) as RefundRequest[];
        },
        staleTime: 1000 * 30,
    });

    // All balance transactions
    const { data: balanceTxs, isLoading: loadingTxs } = useQuery({
        queryKey: BALANCE_TXS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("seller_balance_transactions")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data ?? []) as BalanceTx[];
        },
        staleTime: 1000 * 60,
    });

    // All payment transactions (orders paid via Midtrans)
    const { data: transactions, isLoading: loadingPayments } = useQuery({
        queryKey: TRANSACTIONS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("transactions")
                .select("id, buyer_id, seller_id, amount, payment_status, payment_method, transaction_date, order:order_id(admin_fee)")
                .order("transaction_date", { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data ?? []) as Transaction[];
        },
        staleTime: 1000 * 60,
    });

    // All profiles (for linking user IDs to names/emails)
    const { data: profiles } = useQuery({
        queryKey: PROFILES_KEY,
        queryFn: async () => {
            const { data, error } = await supabase.from("profiles").select("id, name, email");
            if (error) throw error;
            return (data ?? []) as Profile[];
        },
        staleTime: 1000 * 60 * 5,
    });

    // Payout accounts (for withdrawal request details)
    const { data: payoutAccounts } = useQuery({
        queryKey: PAYOUT_ACCOUNTS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("seller_payout_accounts")
                .select("id, provider, account_number, account_name, type");
            if (error) throw error;
            return (data ?? []) as PayoutAccount[];
        },
        staleTime: 1000 * 60 * 5,
    });

    // ─── Lookup maps ─────────────────────────────────────────────────────────

    const profileMap = useMemo(() => {
        const map = new Map<string, Profile>();
        (profiles ?? []).forEach((p) => map.set(p.id, p));
        return map;
    }, [profiles]);

    const payoutMap = useMemo(() => {
        const map = new Map<string, PayoutAccount>();
        (payoutAccounts ?? []).forEach((a) => map.set(a.id, a));
        return map;
    }, [payoutAccounts]);

    // ─── Derived stats ────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const paidTxns = (transactions ?? []).filter((t) => t.payment_status === "paid");
        const totalRevenue = paidTxns.reduce((s, t) => s + Number(t.amount), 0);

        const completed = (balanceTxs ?? []).filter((t) => t.status === "completed");
        const totalPaidOut = completed
            .filter((t) => t.type === "debit")
            .reduce((s, t) => s + Number(t.amount), 0);

        const pendingWithdrawals = (balanceTxs ?? []).filter(
            (t) => t.type === "debit" && t.status === "pending"
        );
        const totalPending = pendingWithdrawals.reduce((s, t) => s + Number(t.amount), 0);

        // Platform revenue
        const adminFeesTotal = paidTxns.reduce((s, t) => s + Number(t.order?.admin_fee ?? 0), 0);
        const transferFeesTotal = completed
            .filter((t) => t.type === "debit")
            .reduce((s, t) => s + Number(t.platform_fee ?? 0), 0);
        const platformProfit = adminFeesTotal + transferFeesTotal;

        return { totalRevenue, totalPaidOut, totalPending, pendingCount: pendingWithdrawals.length, adminFeesTotal, transferFeesTotal, platformProfit };
    }, [transactions, balanceTxs]);

    // ─── Per-user balance ─────────────────────────────────────────────────────

    const userBalances = useMemo(() => {
        const map = new Map<string, number>();
        (balanceTxs ?? [])
            .filter((t) => t.status === "completed" || (t.status === "pending" && t.type === "credit" && new Date(t.available_at) <= new Date()))
            .forEach((t) => {
                const prev = map.get(t.seller_id) ?? 0;
                map.set(t.seller_id, prev + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)));
            });
        return Array.from(map.entries())
            .map(([userId, balance]) => ({ userId, balance }))
            .sort((a, b) => b.balance - a.balance);
    }, [balanceTxs]);

    // ─── Pending withdrawal requests ─────────────────────────────────────────

    const pendingWithdrawals = useMemo(() => {
        return (balanceTxs ?? []).filter((t) => t.type === "debit" && t.status === "pending");
    }, [balanceTxs]);

    // ─── Platform revenue items (for breakdown table) ─────────────────────────

    const revenueItems = useMemo(() => {
        const adminItems = (transactions ?? [])
            .filter((t) => t.payment_status === "paid" && (t.order?.admin_fee ?? 0) > 0)
            .map((t) => ({
                source: "admin_fee" as const,
                amount: Number(t.order!.admin_fee),
                description: `Biaya admin 2% dari pesanan ${t.id.slice(0, 8).toUpperCase()}`,
                date: t.transaction_date,
            }));

        const transferItems = (balanceTxs ?? [])
            .filter((t) => t.type === "debit" && t.status === "completed" && (t.platform_fee ?? 0) > 0)
            .map((t) => ({
                source: "transfer_fee" as const,
                amount: Number(t.platform_fee),
                description: t.description ?? "Biaya transfer penarikan",
                date: t.created_at,
            }));

        return [...adminItems, ...transferItems].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [transactions, balanceTxs]);

    // ─── Mutations ────────────────────────────────────────────────────────────

    const updateWithdrawal = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: "completed" | "failed" }) => {
            const { error } = await supabase
                .from("seller_balance_transactions")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, { status }) => {
            queryClient.invalidateQueries({ queryKey: BALANCE_TXS_KEY });
            toast({
                title: status === "completed" ? "Penarikan Disetujui" : "Penarikan Ditolak",
                description: status === "completed"
                    ? "Dana berhasil dicairkan ke pengguna."
                    : "Permintaan penarikan telah ditolak.",
            });
            setProcessingId(null);
        },
        onError: () => {
            toast({ title: "Gagal", description: "Terjadi kesalahan. Coba lagi.", variant: "destructive" });
            setProcessingId(null);
        },
    });

    const handleWithdrawal = (id: string, status: "completed" | "failed") => {
        setProcessingId(id);
        updateWithdrawal.mutate({ id, status });
    };

    const updateRefundMutation = useMutation({
        mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
            const { error } = await supabase
                .from("refund_requests")
                .update({
                    status,
                    admin_note: note || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: REFUND_REQUESTS_KEY });
            toast({ title: "Berhasil", description: "Status pengembalian dana diperbarui." });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        },
    });

    const isLoading = loadingTxs || loadingPayments;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <DollarSign className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Keuangan Platform</h1>
                    <p className="text-sm text-muted-foreground">Arus kas masuk/keluar dan saldo pengguna</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FinanceStat
                    icon={TrendingUp}
                    label="Total Pendapatan Platform"
                    value={formatCurrency(stats.totalRevenue)}
                    sub="Dari transaksi terbayar"
                    color="text-emerald-600"
                    bgColor="bg-emerald-50"
                    isLoading={isLoading}
                />
                <FinanceStat
                    icon={ArrowUpRight}
                    label="Total Kas Masuk"
                    value={formatCurrency((balanceTxs ?? []).filter(t => t.type === "credit" && t.status === "completed").reduce((s, t) => s + Number(t.amount), 0))}
                    sub="Saldo dikreditkan ke pengguna"
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                    isLoading={isLoading}
                />
                <FinanceStat
                    icon={ArrowDownLeft}
                    label="Total Dicairkan"
                    value={formatCurrency(stats.totalPaidOut)}
                    sub="Penarikan selesai"
                    color="text-orange-600"
                    bgColor="bg-orange-50"
                    isLoading={isLoading}
                />
                <FinanceStat
                    icon={Clock}
                    label="Menunggu Pencairan"
                    value={formatCurrency(stats.totalPending)}
                    sub={`${stats.pendingCount} permintaan aktif`}
                    color="text-amber-600"
                    bgColor="bg-amber-50"
                    isLoading={isLoading}
                />
            </div>

            {/* Platform Profit Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FinanceStat
                    icon={BadgePercent}
                    label="Biaya Admin Terkumpul"
                    value={formatCurrency(stats.adminFeesTotal)}
                    sub="2% dari setiap pesanan terbayar"
                    color="text-violet-600"
                    bgColor="bg-violet-50"
                    isLoading={isLoading}
                />
                <FinanceStat
                    icon={Landmark}
                    label="Biaya Transfer Terkumpul"
                    value={formatCurrency(stats.transferFeesTotal)}
                    sub="Rp 5.000 per penarikan selesai"
                    color="text-indigo-600"
                    bgColor="bg-indigo-50"
                    isLoading={isLoading}
                />
                <FinanceStat
                    icon={TrendingUp}
                    label="Total Keuntungan Platform"
                    value={formatCurrency(stats.platformProfit)}
                    sub="Biaya admin + biaya transfer"
                    color="text-emerald-700"
                    bgColor="bg-emerald-100"
                    isLoading={isLoading}
                />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview">
                <TabsList className="flex w-full overflow-x-auto">
                    <TabsTrigger value="overview">Ringkasan Transaksi</TabsTrigger>
                    <TabsTrigger value="withdrawals" className="relative">
                        Permintaan Penarikan
                        {stats.pendingCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                                {stats.pendingCount}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="balances">Saldo Pengguna</TabsTrigger>
                    <TabsTrigger value="revenue">Keuntungan Platform</TabsTrigger>
                    <TabsTrigger value="refunds" className="relative">
                        Pengembalian Dana
                        {(refundRequests ?? []).filter(r => r.status === "pending" || r.status === "pending_manual").length > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                                {(refundRequests ?? []).filter(r => r.status === "pending" || r.status === "pending_manual").length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ── Overview ── */}
                <TabsContent value="overview" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Transaksi Pembayaran Terbaru</CardTitle>
                            <CardDescription>200 transaksi terakhir dari gateway pembayaran</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pembeli</TableHead>
                                        <TableHead>Penjual</TableHead>
                                        <TableHead>Metode</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 6 }).map((__, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (transactions ?? []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                Belum ada transaksi
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (transactions ?? []).map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="text-sm">
                                                    {profileMap.get(tx.buyer_id)?.name ?? tx.buyer_id.slice(0, 8) + "…"}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {profileMap.get(tx.seller_id)?.name ?? tx.seller_id.slice(0, 8) + "…"}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {tx.payment_method ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <PaymentStatusBadge status={tx.payment_status} />
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-sm">
                                                    {formatCurrency(Number(tx.amount))}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(tx.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Withdrawal Requests ── */}
                <TabsContent value="withdrawals" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Permintaan Penarikan Dana</CardTitle>
                            <CardDescription>Setujui atau tolak permintaan pencairan dari pengguna</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pengguna</TableHead>
                                        <TableHead>Akun Tujuan</TableHead>
                                        <TableHead>Deskripsi</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingTxs ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 6 }).map((__, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : pendingWithdrawals.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                                                    <p>Tidak ada permintaan penarikan yang menunggu</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pendingWithdrawals.map((tx) => {
                                            const user = profileMap.get(tx.seller_id);
                                            const account = tx.payout_account_id ? payoutMap.get(tx.payout_account_id) : null;
                                            const isProcessing = processingId === tx.id;
                                            return (
                                                <TableRow key={tx.id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-sm">{user?.name ?? "—"}</p>
                                                            <p className="text-xs text-muted-foreground">{user?.email ?? tx.seller_id.slice(0, 8) + "…"}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {account ? (
                                                            <div>
                                                                <p className="text-sm font-medium">{account.provider}</p>
                                                                <p className="text-xs text-muted-foreground">{account.account_number} · {account.account_name}</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground max-w-[100px] sm:max-w-[160px] truncate">
                                                        {tx.description ?? "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(Number(tx.amount))}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(tx.created_at), "dd MMM yyyy", { locale: idLocale })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleWithdrawal(tx.id, "completed")}
                                                                disabled={isProcessing}
                                                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                Setujui
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleWithdrawal(tx.id, "failed")}
                                                                disabled={isProcessing}
                                                                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                                            >
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Tolak
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── User Balances ── */}
                <TabsContent value="balances" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Saldo Pengguna</CardTitle>
                            <CardDescription>Saldo saat ini berdasarkan riwayat transaksi yang selesai</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pengguna</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead className="text-right">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingTxs ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 3 }).map((__, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-28" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : userBalances.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                                                Belum ada data saldo
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        userBalances.map(({ userId, balance }) => {
                                            const user = profileMap.get(userId);
                                            return (
                                                <TableRow key={userId}>
                                                    <TableCell className="font-medium">{user?.name ?? userId.slice(0, 8) + "…"}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{user?.email ?? "—"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={balance >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                                                            {formatCurrency(balance)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Platform Revenue ── */}
                <TabsContent value="revenue" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Rincian Keuntungan Platform</CardTitle>
                            <CardDescription>Biaya admin (2%) dari pesanan terbayar dan biaya transfer dari penarikan selesai</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sumber</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 4 }).map((__, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : revenueItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                                Belum ada pendapatan platform tercatat
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        revenueItems.map((item, i) => (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    {item.source === "admin_fee" ? (
                                                        <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">Biaya Admin</Badge>
                                                    ) : (
                                                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">Biaya Transfer</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[120px] sm:max-w-[200px] truncate">
                                                    {item.description}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-emerald-600">
                                                    +{formatCurrency(item.amount)}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(item.date), "dd MMM yyyy", { locale: idLocale })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* ── Refund Requests ── */}
                <TabsContent value="refunds" className="mt-4">
                    {(() => {
                        const pendingCount = (refundRequests ?? []).filter(r => r.status === "pending" || r.status === "pending_manual").length;
                        return (
                            <div className="space-y-4">
                                {pendingCount > 0 && (
                                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                                        <Clock className="h-4 w-4 flex-shrink-0" />
                                        <span><strong>{pendingCount}</strong> permintaan memerlukan tindakan manual</span>
                                    </div>
                                )}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Permintaan Pengembalian Dana</CardTitle>
                                        <CardDescription>Kelola permintaan refund dari pembeli</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0 overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                                                    <TableHead>Order ID</TableHead>
                                                    <TableHead>Alasan</TableHead>
                                                    <TableHead>Metode</TableHead>
                                                    <TableHead className="text-right">Jumlah</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Catatan Admin</TableHead>
                                                    <TableHead className="text-center">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loadingRefunds ? (
                                                    Array.from({ length: 4 }).map((_, i) => (
                                                        <TableRow key={i}>
                                                            {Array.from({ length: 8 }).map((__, j) => (
                                                                <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))
                                                ) : (refundRequests ?? []).length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                                                                <p>Belum ada permintaan pengembalian dana</p>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    (refundRequests ?? []).map((req) => {
                                                        const canAct = req.status === "pending" || req.status === "pending_manual";
                                                        const noteVal = adminNoteInput[req.id] ?? "";
                                                        return (
                                                            <TableRow key={req.id}>
                                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                                    {format(new Date(req.created_at), "dd MMM yyyy", { locale: idLocale })}
                                                                </TableCell>
                                                                <TableCell className="text-sm font-mono">
                                                                    {req.order_id.slice(0, 8).toUpperCase()}…
                                                                </TableCell>
                                                                <TableCell className="text-sm max-w-[100px] sm:max-w-[140px]">
                                                                    <p className="font-medium truncate">{req.reason}</p>
                                                                    {req.reason_detail && (
                                                                        <p className="text-xs text-muted-foreground truncate">{req.reason_detail}</p>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {req.midtrans_refund_id ? "Midtrans" : "Manual"}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-sm">
                                                                    {req.refund_amount != null ? formatCurrency(Number(req.refund_amount)) : "—"}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <RefundStatusBadge status={req.status} />
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground max-w-[100px] sm:max-w-[140px] truncate">
                                                                    {req.admin_note ?? "—"}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {canAct ? (
                                                                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                                                                            <Input
                                                                                placeholder="Catatan admin (opsional)"
                                                                                className="h-7 text-xs"
                                                                                value={noteVal}
                                                                                onChange={(e) =>
                                                                                    setAdminNoteInput((prev) => ({ ...prev, [req.id]: e.target.value }))
                                                                                }
                                                                            />
                                                                            <div className="flex gap-1">
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700"
                                                                                    disabled={updateRefundMutation.isPending}
                                                                                    onClick={() =>
                                                                                        updateRefundMutation.mutate({ id: req.id, status: "refunded", note: noteVal })
                                                                                    }
                                                                                >
                                                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                                    Selesaikan
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-7 text-xs flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                                                                    disabled={updateRefundMutation.isPending}
                                                                                    onClick={() =>
                                                                                        updateRefundMutation.mutate({ id: req.id, status: "rejected", note: noteVal })
                                                                                    }
                                                                                >
                                                                                    <XCircle className="h-3 w-3 mr-1" />
                                                                                    Tolak
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">—</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })()}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FinanceStat({
    icon: Icon, label, value, sub, color, bgColor, isLoading,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub: string;
    color: string;
    bgColor: string;
    isLoading: boolean;
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${bgColor} ${color}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{label}</p>
                        {isLoading ? (
                            <Skeleton className="h-6 w-28 mt-1" />
                        ) : (
                            <p className="text-lg font-bold truncate">{value}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PaymentStatusBadge({ status }: { status: string }) {
    if (status === "paid") {
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Lunas</Badge>;
    }
    if (status === "pending") {
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Menunggu</Badge>;
    }
    return <Badge variant="outline" className="text-xs text-muted-foreground">{status}</Badge>;
}

function RefundStatusBadge({ status }: { status: RefundRequest["status"] }) {
    switch (status) {
        case "pending":
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Menunggu</Badge>;
        case "processing":
            return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Diproses</Badge>;
        case "refunded":
            return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Dikembalikan</Badge>;
        case "pending_manual":
            return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Manual Diperlukan</Badge>;
        case "rejected":
            return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Ditolak</Badge>;
        case "cancelled":
            return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Dibatalkan</Badge>;
        default:
            return <Badge variant="outline" className="text-xs text-muted-foreground">{status}</Badge>;
    }
}
