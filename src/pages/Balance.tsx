import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Wallet, CreditCard, Building2, Smartphone, Plus, Trash2,
    Star, ArrowDownLeft, ArrowUpRight, Clock, X,
    ChevronRight, AlertCircle, Loader2, CheckCircle2, FlaskConical,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayoutAccount {
    id: string;
    type: "bank" | "ewallet";
    provider: string;
    account_number: string;
    account_name: string;
    is_main: boolean;
    balance: number;
    created_at: string;
}

interface BalanceTx {
    id: string;
    type: "credit" | "debit";
    amount: number;
    status: "pending" | "completed" | "failed";
    description: string | null;
    order_id: string | null;
    payout_account_id: string | null;
    available_at: string;
    created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BANK_OPTIONS = [
    "BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Permata Bank",
    "Danamon", "Maybank", "OCBC NISP", "BSI", "Bank Jago",
];

const EWALLET_OPTIONS = ["Dana", "GoPay", "OVO", "ShopeePay", "LinkAja", "QRIS"];

const MIN_WITHDRAWAL = 10_000;
const MAX_WITHDRAWAL = 2_000_000;
const PENDING_DAYS = 5;
const TRANSFER_FEE = 5_000;

// ─── Query keys ───────────────────────────────────────────────────────────────

const PAYOUT_ACCOUNTS_KEY = (uid: string) => ["payout-accounts", uid];
const BALANCE_TXS_KEY = (uid: string) => ["balance-transactions", uid];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function providerLabel(account: PayoutAccount) {
    return `${account.provider} – ${account.account_number}`;
}

function txStatusBadge(tx: BalanceTx) {
    if (tx.status === "pending") {
        return (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs gap-1">
                <Clock className="h-3 w-3" />
                Tertunda
            </Badge>
        );
    }
    if (tx.status === "failed") {
        return (
            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 text-xs gap-1">
                <X className="h-3 w-3" />
                Gagal
            </Badge>
        );
    }
    return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountCard({
    account,
    onSetMain,
    onDeleteRequest,
    isSettingMain,
}: {
    account: PayoutAccount;
    onSetMain: (id: string) => void;
    onDeleteRequest: (account: PayoutAccount) => void;
    isSettingMain: boolean;
}) {
    const Icon = account.type === "bank" ? Building2 : Smartphone;

    return (
        <div className={cn(
            "flex items-start gap-3 p-4 rounded-lg border transition-colors",
            account.is_main ? "border-primary/40 bg-primary/5" : "border-border bg-card",
        )}>
            <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0",
                account.type === "bank" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600",
            )}>
                <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{account.provider}</span>
                    {account.type === "bank"
                        ? <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Bank</Badge>
                        : <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">E-Wallet</Badge>
                    }
                    {account.is_main && (
                        <Badge className="text-xs gap-1 bg-primary/15 text-primary border-primary/30 border">
                            <Star className="h-3 w-3 fill-current" />
                            Utama
                        </Badge>
                    )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{account.account_number}</p>
                <p className="text-xs text-muted-foreground">{account.account_name}</p>
                <p className="text-xs font-semibold text-foreground mt-1">{formatCurrency(account.balance ?? 0)}</p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
                {!account.is_main && (
                    <Button
                        variant="ghost" size="sm"
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => onSetMain(account.id)}
                        disabled={isSettingMain}
                    >
                        {isSettingMain ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                        Utamakan
                    </Button>
                )}
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteRequest(account)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ─── Add Account Dialog ───────────────────────────────────────────────────────

function AddAccountDialog({
    open,
    onOpenChange,
    onSave,
    isSaving,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSave: (data: Omit<PayoutAccount, "id" | "is_main" | "created_at">) => void;
    isSaving: boolean;
}) {
    const [type, setType] = useState<"bank" | "ewallet">("bank");
    const [provider, setProvider] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");

    const providerOptions = type === "bank" ? BANK_OPTIONS : EWALLET_OPTIONS;

    const handleOpenChange = (v: boolean) => {
        if (!v) {
            setType("bank");
            setProvider("");
            setAccountNumber("");
            setAccountName("");
        }
        onOpenChange(v);
    };

    const handleSave = () => {
        if (!provider || !accountNumber.trim() || !accountName.trim()) return;
        onSave({ type, provider, account_number: accountNumber.trim(), account_name: accountName.trim() });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Tambah Rekening Pencairan</DialogTitle>
                    <DialogDescription>
                        Tambahkan rekening bank atau e-wallet untuk menerima pencairan saldo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {/* Type toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => { setType("bank"); setProvider(""); }}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                                type === "bank"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/40",
                            )}
                        >
                            <Building2 className="h-4 w-4" />
                            Rekening Bank
                        </button>
                        <button
                            type="button"
                            onClick={() => { setType("ewallet"); setProvider(""); }}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                                type === "ewallet"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/40",
                            )}
                        >
                            <Smartphone className="h-4 w-4" />
                            E-Wallet
                        </button>
                    </div>

                    {/* Provider */}
                    <div className="space-y-1.5">
                        <Label>{type === "bank" ? "Bank" : "Dompet Digital"}</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Pilih ${type === "bank" ? "bank" : "e-wallet"}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {providerOptions.map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Account number */}
                    <div className="space-y-1.5">
                        <Label>{type === "bank" ? "Nomor Rekening" : "Nomor Telepon / Akun"}</Label>
                        <Input
                            placeholder={type === "bank" ? "Contoh: 1234567890" : "Contoh: 0812xxxx"}
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            inputMode="numeric"
                        />
                    </div>

                    {/* Account holder name */}
                    <div className="space-y-1.5">
                        <Label>Nama Pemilik</Label>
                        <Input
                            placeholder="Sesuai nama di rekening / akun"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleSave}
                        disabled={isSaving || !provider || !accountNumber.trim() || !accountName.trim()}
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Simpan Rekening
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
    account,
    open,
    onOpenChange,
    onConfirm,
    isDeleting,
}: {
    account: PayoutAccount | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    const [input, setInput] = useState("");

    const expectedText = account ? `DELETE ${account.provider} - ${account.account_number}` : "";
    const isMatch = input === expectedText;

    const handleOpenChange = (v: boolean) => {
        if (!v) setInput("");
        onOpenChange(v);
    };

    if (!account) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-destructive">Hapus Rekening</DialogTitle>
                    <DialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Rekening yang dihapus tidak bisa dipulihkan.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-1">
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        <p className="font-medium">{account.provider} – {account.account_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.account_name}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">
                            Untuk konfirmasi, ketik:
                            <span className="font-mono font-semibold text-destructive ml-1">
                                DELETE {account.provider} - {account.account_number}
                            </span>
                        </Label>
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={expectedText}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline" className="flex-1"
                            onClick={() => handleOpenChange(false)}
                            disabled={isDeleting}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive" className="flex-1"
                            onClick={onConfirm}
                            disabled={!isMatch || isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Hapus
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Withdraw Dialog ──────────────────────────────────────────────────────────

function WithdrawDialog({
    open,
    onOpenChange,
    saldoAktif,
    accounts,
    onWithdraw,
    isWithdrawing,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    saldoAktif: number;
    accounts: PayoutAccount[];
    onWithdraw: (accountId: string, amount: number) => void;
    isWithdrawing: boolean;
}) {
    const mainAccount = accounts.find((a) => a.is_main) ?? accounts[0] ?? null;
    const [selectedAccountId, setSelectedAccountId] = useState<string>(mainAccount?.id ?? "");
    const [amountStr, setAmountStr] = useState("");

    const amount = parseInt(amountStr.replace(/\D/g, ""), 10) || 0;
    // The total deducted from balance = amount + fee; validate against that
    const isValidAmount = amount >= MIN_WITHDRAWAL && amount <= Math.min(MAX_WITHDRAWAL, saldoAktif - TRANSFER_FEE);

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

    // Reset when dialog reopens
    const handleOpenChange = (v: boolean) => {
        if (v) {
            setSelectedAccountId(mainAccount?.id ?? "");
            setAmountStr("");
        }
        onOpenChange(v);
    };

    const handleAmountInput = (raw: string) => {
        const digits = raw.replace(/\D/g, "");
        setAmountStr(digits);
    };

    const handleSubmit = () => {
        if (!selectedAccountId || !isValidAmount) return;
        onWithdraw(selectedAccountId, amount);
    };

    const Icon = selectedAccount?.type === "bank" ? Building2 : Smartphone;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Penarikan Saldo</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-1">
                    {/* Destination account */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Tujuan Penarikan
                        </p>
                        {selectedAccount ? (
                            <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-l-primary bg-muted/40">
                                <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{selectedAccount.provider} – {selectedAccount.account_number}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{selectedAccount.account_name}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Belum ada rekening terdaftar.</p>
                        )}
                    </div>

                    {/* Account selector */}
                    {accounts.length > 1 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Ubah Tujuan Penarikan</Label>
                            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih rekening" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {providerLabel(a)}{a.is_main ? " ★" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Method info */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Metode Penarikan
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="text-sm font-medium">Instan</span>
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">
                                Proses Lebih Cepat
                            </Badge>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <li>• Layanan 24 jam</li>
                            <li>• Proses 1–10 menit</li>
                            <li>• Biaya transfer Rp 5.000</li>
                        </ul>
                    </div>

                    {/* Current balance */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Saldo Kamu
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-foreground">{formatCurrency(saldoAktif)}</span>
                            {saldoAktif > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setAmountStr(String(Math.min(saldoAktif - TRANSFER_FEE, MAX_WITHDRAWAL)))}
                                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                >
                                    <ArrowDownLeft className="h-3 w-3" />
                                    Tarik Seluruhnya
                                </button>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Amount input */}
                    <div className="space-y-1.5">
                        <Label>Jumlah Penarikan Saldo</Label>
                        <p className="text-xs text-muted-foreground">
                            Minimal: {formatCurrency(MIN_WITHDRAWAL)} &nbsp;|&nbsp; Maks diterima: {formatCurrency(Math.max(0, Math.min(MAX_WITHDRAWAL, saldoAktif - TRANSFER_FEE)))}
                        </p>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                            <Input
                                className="pl-9"
                                placeholder="10.000"
                                value={amountStr ? Number(amountStr).toLocaleString("id-ID") : ""}
                                onChange={(e) => handleAmountInput(e.target.value)}
                                inputMode="numeric"
                            />
                        </div>
                        {amountStr && !isValidAmount && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {amount < MIN_WITHDRAWAL
                                    ? `Minimal penarikan ${formatCurrency(MIN_WITHDRAWAL)}`
                                    : amount + TRANSFER_FEE > saldoAktif
                                        ? `Saldo tidak cukup (butuh ${formatCurrency(amount + TRANSFER_FEE)} termasuk biaya)`
                                        : `Maksimal penarikan ${formatCurrency(MAX_WITHDRAWAL)}`}
                            </p>
                        )}
                        {amountStr && isValidAmount && (
                            <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Jumlah diterima</span>
                                    <span className="font-medium">{formatCurrency(amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Biaya transfer</span>
                                    <span className="text-destructive font-medium">−{formatCurrency(TRANSFER_FEE)}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold">
                                    <span>Total dipotong dari saldo</span>
                                    <span>{formatCurrency(amount + TRANSFER_FEE)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full rounded-full"
                        onClick={handleSubmit}
                        disabled={isWithdrawing || !selectedAccountId || !isValidAmount || accounts.length === 0}
                    >
                        {isWithdrawing
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses…</>
                            : <>Lanjutkan <ChevronRight className="h-4 w-4 ml-1" /></>
                        }
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Balance() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState("saldo");
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PayoutAccount | null>(null);
    const [showManualCredit, setShowManualCredit] = useState(false);
    const [manualAmountStr, setManualAmountStr] = useState("");

    // ── Fetch payout accounts ──
    const { data: accounts = [], isLoading: accountsLoading } = useQuery<PayoutAccount[]>({
        queryKey: PAYOUT_ACCOUNTS_KEY(user?.id ?? ""),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("seller_payout_accounts")
                .select("*")
                .eq("seller_id", user!.id)
                .order("is_main", { ascending: false })
                .order("created_at", { ascending: true });
            if (error) throw error;
            return (data ?? []) as PayoutAccount[];
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    // ── Fetch balance transactions ──
    const { data: txs = [], isLoading: txsLoading } = useQuery<BalanceTx[]>({
        queryKey: BALANCE_TXS_KEY(user?.id ?? ""),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("seller_balance_transactions")
                .select("*")
                .eq("seller_id", user!.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as BalanceTx[];
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    // ── Compute balances ──
    const { saldoAktif, saldoTertunda } = useMemo(() => {
        const now = new Date();
        let aktif = 0;
        let tertunda = 0;
        for (const tx of txs) {
            if (tx.status === "failed") continue;
            if (tx.type === "credit") {
                if (tx.status === "pending" && !isPast(new Date(tx.available_at))) {
                    tertunda += tx.amount;
                } else if (tx.status === "completed" || (tx.status === "pending" && isPast(new Date(tx.available_at)))) {
                    aktif += tx.amount;
                }
            } else if (tx.type === "debit" && (tx.status === "completed" || tx.status === "pending")) {
                aktif -= tx.amount;
            }
        }
        return { saldoAktif: Math.max(0, aktif), saldoTertunda: tertunda };
    }, [txs]);

    const mainAccount = accounts.find((a) => a.is_main) ?? accounts[0] ?? null;

    // ── Add account mutation ──
    const addAccountMutation = useMutation({
        mutationFn: async (data: Omit<PayoutAccount, "id" | "is_main" | "created_at">) => {
            const isFirst = accounts.length === 0;
            const { error } = await supabase.from("seller_payout_accounts").insert({
                seller_id: user!.id,
                type: data.type,
                provider: data.provider,
                account_number: data.account_number,
                account_name: data.account_name,
                is_main: isFirst, // first account becomes main automatically
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYOUT_ACCOUNTS_KEY(user?.id ?? "") });
            setShowAddAccount(false);
            toast({ title: "Rekening berhasil ditambahkan" });
        },
        onError: () => {
            toast({ title: "Gagal menambahkan rekening", variant: "destructive" });
        },
    });

    // ── Set main account mutation ──
    const setMainMutation = useMutation({
        mutationFn: async (id: string) => {
            // Unset all mains first, then set the selected one
            const { error: unsetErr } = await supabase
                .from("seller_payout_accounts")
                .update({ is_main: false })
                .eq("seller_id", user!.id);
            if (unsetErr) throw unsetErr;
            const { error: setErr } = await supabase
                .from("seller_payout_accounts")
                .update({ is_main: true })
                .eq("id", id);
            if (setErr) throw setErr;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYOUT_ACCOUNTS_KEY(user?.id ?? "") });
            toast({ title: "Rekening utama diperbarui" });
        },
        onError: () => {
            toast({ title: "Gagal mengubah rekening utama", variant: "destructive" });
        },
    });

    // ── Delete account mutation ──
    const deleteAccountMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("seller_payout_accounts")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYOUT_ACCOUNTS_KEY(user?.id ?? "") });
            setDeleteTarget(null);
            toast({ title: "Rekening dihapus" });
        },
        onError: () => {
            toast({ title: "Gagal menghapus rekening", variant: "destructive" });
        },
    });

    // ── Manual credit mutation (testing / backend maintenance) ──
    const manualCreditMutation = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await supabase.from("seller_balance_transactions").insert({
                seller_id: user!.id,
                type: "credit",
                amount,
                status: "completed",
                description: "Kredit manual (testing)",
                available_at: new Date().toISOString(),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BALANCE_TXS_KEY(user?.id ?? "") });
            queryClient.invalidateQueries({ queryKey: ["balance-float", user?.id] });
            setShowManualCredit(false);
            setManualAmountStr("");
            toast({ title: "Saldo berhasil ditambahkan" });
        },
        onError: () => {
            toast({ title: "Gagal menambahkan saldo", variant: "destructive" });
        },
    });

    const parsedManualAmount = parseInt(manualAmountStr.replace(/\D/g, ""), 10) || 0;

    // ── Withdraw mutation ──
    const withdrawMutation = useMutation({
        mutationFn: async ({ accountId, amount }: { accountId: string; amount: number }) => {
            // Check account status before allowing withdrawal
            const { data: profileStatus } = await supabase
                .from("profiles")
                .select("status")
                .eq("id", user!.id)
                .single();
            if (profileStatus?.status === "frozen" || profileStatus?.status === "suspended") {
                throw new Error(
                    profileStatus.status === "frozen"
                        ? "Akun kamu dibekukan. Penarikan saldo tidak dapat dilakukan."
                        : "Akun kamu disuspend. Hubungi admin untuk informasi lebih lanjut."
                );
            }

            const account = accounts.find((a) => a.id === accountId);
            // Deduct amount + fee so the full cost is reflected in the balance immediately
            const { error } = await supabase.from("seller_balance_transactions").insert({
                seller_id: user!.id,
                type: "debit",
                amount: amount + TRANSFER_FEE,
                platform_fee: TRANSFER_FEE,
                status: "pending",
                description: `Permintaan penarikan ${formatCurrency(amount)} ke ${account?.provider ?? ""} ${account?.account_number ?? ""} (biaya ${formatCurrency(TRANSFER_FEE)})`,
                payout_account_id: accountId,
                available_at: new Date().toISOString(),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BALANCE_TXS_KEY(user?.id ?? "") });
            setShowWithdraw(false);
            toast({ title: "Permintaan penarikan berhasil dikirim", description: "Admin akan memproses penarikanmu segera." });
        },
        onError: () => {
            toast({ title: "Gagal memproses penarikan", variant: "destructive" });
        },
    });

    const isLoading = accountsLoading || txsLoading;

    // ── Realtime: refresh balance when admin approves/rejects a withdrawal ──
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`balance-txs-updates-${user.id}`)
            .on(
                "postgres_changes" as any,
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "seller_balance_transactions",
                    filter: `seller_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: BALANCE_TXS_KEY(user.id) });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user, queryClient]);

    // ── Build description for history rows ──
    const buildDescription = (tx: BalanceTx) => {
        if (tx.description) return tx.description;
        if (tx.type === "credit") return "Pembayaran pesanan diterima";
        return "Penarikan saldo";
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-foreground">Saldo & Pencairan</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Kelola saldo dan rekening pencairan tokomu</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="saldo" className="flex-1 sm:flex-none gap-2">
                        <Wallet className="h-4 w-4" />
                        Saldo Saya
                    </TabsTrigger>
                    <TabsTrigger value="rekening" className="flex-1 sm:flex-none gap-2">
                        <CreditCard className="h-4 w-4" />
                        Rekening Pencairan
                    </TabsTrigger>
                </TabsList>

                {/* ── TAB: SALDO ── */}
                <TabsContent value="saldo" className="mt-5 space-y-5">

                    {/* Balance cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Saldo Aktif */}
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo Aktif</p>
                                        {isLoading
                                            ? <Skeleton className="h-7 w-32 mt-2" />
                                            : <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(saldoAktif)}</p>
                                        }
                                        <p className="text-xs text-muted-foreground mt-1">Dapat dicairkan sekarang</p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Saldo Tertunda */}
                        <Card className="border-amber-300/70 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-900/40 dark:to-amber-800/30">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Saldo Tertunda</p>
                                        {isLoading
                                            ? <Skeleton className="h-7 w-32 mt-2" />
                                            : <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{formatCurrency(saldoTertunda)}</p>
                                        }
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                            Aktif setelah {PENDING_DAYS} hari (anti-fraud)
                                        </p>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-700/60">
                                        <Clock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Withdraw section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Tarik Saldo</CardTitle>
                            <CardDescription className="text-xs">
                                Cairkan saldo aktifmu ke rekening terdaftar
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {accountsLoading ? (
                                <Skeleton className="h-14 w-full rounded-lg" />
                            ) : mainAccount ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn(
                                            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                                            mainAccount.type === "bank" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600",
                                        )}>
                                            {mainAccount.type === "bank"
                                                ? <Building2 className="h-4 w-4" />
                                                : <Smartphone className="h-4 w-4" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{mainAccount.provider} – {mainAccount.account_number}</p>
                                            <p className="text-xs text-muted-foreground truncate">{mainAccount.account_name}</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => setShowWithdraw(true)}
                                        disabled={saldoAktif < MIN_WITHDRAWAL + TRANSFER_FEE}
                                        className="flex-shrink-0 rounded-full gap-1.5"
                                        size="sm"
                                    >
                                        <ArrowUpRight className="h-4 w-4" />
                                        Tarik Saldo
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-3 text-center">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="text-sm text-muted-foreground">Belum ada rekening pencairan.</p>
                                    <Button
                                        variant="outline" size="sm"
                                        onClick={() => setActiveTab("rekening")}
                                    >
                                        Tambah Rekening
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Transaction history */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Riwayat Transaksi</CardTitle>
                            <CardDescription className="text-xs">Semua pergerakan saldo masuk dan keluar</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 px-0 pb-0 overflow-hidden rounded-b-lg">
                            {txsLoading ? (
                                <div className="px-6 pb-6 space-y-3">
                                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : txs.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
                                    <Wallet className="h-10 w-10 text-muted-foreground/30" />
                                    <p className="text-sm text-muted-foreground">Belum ada transaksi saldo.</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        Saldo akan masuk otomatis setelah pembeli menyelesaikan pembayaran.
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Tanggal</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead className="text-right pr-6">Jumlah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {txs.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(tx.created_at), "dd MMM yyyy", { locale: idLocale })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className={cn(
                                                            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                                                            tx.type === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600",
                                                        )}>
                                                            {tx.type === "credit"
                                                                ? <ArrowDownLeft className="h-3 w-3" />
                                                                : <ArrowUpRight className="h-3 w-3" />
                                                            }
                                                        </div>
                                                        <span className="text-sm">{buildDescription(tx)}</span>
                                                        {txStatusBadge(tx)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "text-right pr-6 font-semibold text-sm whitespace-nowrap",
                                                    tx.type === "credit" ? "text-emerald-600" : "text-red-600",
                                                )}>
                                                    {tx.type === "credit" ? "+" : "−"}{formatCurrency(tx.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Manual credit card — DEV only (BUG-002 fix) */}
                    {import.meta.env.DEV && (
                    <Card className="border-amber-200/60">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-semibold">Kredit Saldo Manual</CardTitle>
                                <Badge
                                    variant="outline"
                                    className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 gap-1"
                                >
                                    <FlaskConical className="h-3 w-3" />
                                    Mode Testing
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Tambahkan saldo langsung ke database saat payment gateway tidak tersedia.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => setShowManualCredit(true)}
                            >
                                <Plus className="h-4 w-4" />
                                Tambah Saldo
                            </Button>
                        </CardContent>
                    </Card>
                    )}
                </TabsContent>

                {/* ── TAB: REKENING ── */}
                <TabsContent value="rekening" className="mt-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold">Rekening Pencairan</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Daftarkan rekening bank atau e-wallet untuk menerima saldo
                            </p>
                        </div>
                        <Button size="sm" className="gap-1.5" onClick={() => setShowAddAccount(true)}>
                            <Plus className="h-4 w-4" />
                            Tambah
                        </Button>
                    </div>

                    {accountsLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                        </div>
                    ) : accounts.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                                <CreditCard className="h-12 w-12 text-muted-foreground/30" />
                                <div>
                                    <p className="font-medium text-sm">Belum ada rekening</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tambahkan rekening bank atau e-wallet untuk mulai menerima pencairan.
                                    </p>
                                </div>
                                <Button size="sm" className="gap-1.5" onClick={() => setShowAddAccount(true)}>
                                    <Plus className="h-4 w-4" />
                                    Tambah Rekening
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {accounts.map((account) => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    onSetMain={(id) => setMainMutation.mutate(id)}
                                    onDeleteRequest={(acc) => setDeleteTarget(acc)}
                                    isSettingMain={setMainMutation.isPending && setMainMutation.variables === account.id}
                                />
                            ))}
                        </div>
                    )}

                    {accounts.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                            Rekening bertanda ★ adalah rekening utama yang digunakan saat penarikan.
                        </p>
                    )}
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <AddAccountDialog
                open={showAddAccount}
                onOpenChange={setShowAddAccount}
                onSave={(data) => addAccountMutation.mutate(data)}
                isSaving={addAccountMutation.isPending}
            />
            <DeleteConfirmDialog
                account={deleteTarget}
                open={!!deleteTarget}
                onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
                onConfirm={() => { if (deleteTarget) deleteAccountMutation.mutate(deleteTarget.id); }}
                isDeleting={deleteAccountMutation.isPending}
            />
            <WithdrawDialog
                open={showWithdraw}
                onOpenChange={setShowWithdraw}
                saldoAktif={saldoAktif}
                accounts={accounts}
                onWithdraw={(accountId, amount) => withdrawMutation.mutate({ accountId, amount })}
                isWithdrawing={withdrawMutation.isPending}
            />

            {/* Manual credit dialog — DEV only (BUG-002 fix) */}
            {import.meta.env.DEV && (
            <Dialog
                open={showManualCredit}
                onOpenChange={(v) => { setShowManualCredit(v); if (!v) setManualAmountStr(""); }}
            >
                <DialogContent className="max-w-[95vw] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-amber-600" />
                            Kredit Saldo Manual
                        </DialogTitle>
                        <DialogDescription>
                            Jumlah yang dimasukkan akan langsung dicatat sebagai kredit selesai di riwayat saldo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-1.5">
                            <Label>Jumlah Saldo</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                                <Input
                                    className="pl-9"
                                    placeholder="50.000"
                                    value={manualAmountStr ? Number(manualAmountStr).toLocaleString("id-ID") : ""}
                                    onChange={(e) => setManualAmountStr(e.target.value.replace(/\D/g, ""))}
                                    inputMode="numeric"
                                    autoFocus
                                />
                            </div>
                            {parsedManualAmount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Saldo baru: {formatCurrency(saldoAktif + parsedManualAmount)}
                                </p>
                            )}
                        </div>
                        {/* Quick amount buttons */}
                        <div className="flex flex-wrap gap-2">
                            {[10_000, 50_000, 100_000, 200_000, 500_000].map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setManualAmountStr(String(amt))}
                                    className="px-3 py-1 rounded-full text-xs border border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors"
                                >
                                    +{formatCurrency(amt)}
                                </button>
                            ))}
                        </div>
                        <Button
                            className="w-full"
                            onClick={() => manualCreditMutation.mutate(parsedManualAmount)}
                            disabled={parsedManualAmount <= 0 || manualCreditMutation.isPending}
                        >
                            {manualCreditMutation.isPending
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                                : "Tambahkan ke Saldo"
                            }
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            )}
        </div>
    );
}
