import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
    Users, Search, ShieldCheck, Store, ShoppingBag, UserCircle,
    MoreHorizontal, ShieldBan, ShieldOff, ShieldAlert, CheckCircle2, Trash2, LogIn,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";


// ─── Types ────────────────────────────────────────────────────────────────────

type AccountStatus = "active" | "frozen" | "suspended";

interface UserRole {
    role: "penjual" | "pembeli" | "admin";
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    created_at: string;
    status: AccountStatus;
    user_roles: UserRole[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    penjual: "Penjual",
    pembeli: "Pembeli",
    admin: "Admin",
};

const ROLE_VARIANTS: Record<string, string> = {
    penjual: "bg-blue-100 text-blue-700 border-blue-200",
    pembeli: "bg-emerald-100 text-emerald-700 border-emerald-200",
    admin: "bg-purple-100 text-purple-700 border-purple-200",
};

const STATUS_CONFIG: Record<AccountStatus, { label: string; className: string; icon: React.ElementType }> = {
    active:    { label: "Aktif",      className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    frozen:    { label: "Dibekukan",  className: "bg-blue-100 text-blue-700 border-blue-200",          icon: ShieldOff },
    suspended: { label: "Disuspend",  className: "bg-red-100 text-red-700 border-red-200",             icon: ShieldBan },
};

type StatusAction = { label: string; next: AccountStatus; icon: React.ElementType; destructive?: boolean };

function getAvailableActions(current: AccountStatus): StatusAction[] {
    const all: Record<AccountStatus, StatusAction[]> = {
        active: [
            { label: "Bekukan Akun",   next: "frozen",    icon: ShieldOff,   destructive: false },
            { label: "Suspend Akun",   next: "suspended", icon: ShieldBan,   destructive: true  },
        ],
        frozen: [
            { label: "Aktifkan Akun",  next: "active",    icon: CheckCircle2, destructive: false },
            { label: "Suspend Akun",   next: "suspended", icon: ShieldBan,   destructive: true  },
        ],
        suspended: [
            { label: "Aktifkan Akun",  next: "active",    icon: CheckCircle2, destructive: false },
            { label: "Bekukan Akun",   next: "frozen",    icon: ShieldOff,   destructive: false },
        ],
    };
    return all[current];
}

const STATUS_DESCRIPTIONS: Record<AccountStatus, string> = {
    active:    "Akun berjalan normal.",
    frozen:    "Pembelian dan penarikan saldo diblokir. Pengguna masih dapat login dan melihat data.",
    suspended: "Semua aktivitas diblokir. Pengguna tidak dapat melakukan tindakan apapun.",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [pendingAction, setPendingAction] = useState<{ user: UserProfile; action: StatusAction } | null>(null);
    const [pendingClear, setPendingClear] = useState<{ user: UserProfile; type: "items" | "tx-buyer" | "tx-seller" } | null>(null);
    const [loggingInAs, setLoggingInAs] = useState<string | null>(null);

    const { data: users, isLoading } = useQuery({
        queryKey: ["admin-users"],
        queryFn: async () => {
            const [profilesRes, rolesRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, name, email, created_at, status")
                    .order("created_at", { ascending: false }),
                supabase.from("user_roles").select("user_id, role"),
            ]);
            if (profilesRes.error) throw profilesRes.error;
            if (rolesRes.error) throw rolesRes.error;

            const rolesByUser = new Map<string, UserRole[]>();
            for (const r of rolesRes.data ?? []) {
                if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
                rolesByUser.get(r.user_id)!.push({ role: r.role as UserRole["role"] });
            }

            return (profilesRes.data ?? []).map((p) => ({
                ...p,
                status: (p.status ?? "active") as AccountStatus,
                user_roles: rolesByUser.get(p.id) ?? [],
            })) as UserProfile[];
        },
        staleTime: 1000 * 60,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ userId, status }: { userId: string; status: AccountStatus }) => {
            const { error } = await supabase
                .from("profiles")
                .update({ status })
                .eq("id", userId);
            if (error) throw error;
        },
        onSuccess: (_, { status }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast({
                title: STATUS_CONFIG[status].label,
                description: STATUS_DESCRIPTIONS[status],
            });
            setPendingAction(null);
        },
        onError: () => {
            toast({ title: "Gagal", description: "Terjadi kesalahan. Coba lagi.", variant: "destructive" });
            setPendingAction(null);
        },
    });

    const clearItemsMutation = useMutation({
        mutationFn: async ({ userId }: { userId: string }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sesi tidak valid");

            const res = await fetch("/api/admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ action: "clear-items", user_id: userId }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Terjadi kesalahan" }));
                throw new Error(err.detail || `Error ${res.status}`);
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast({ title: "Item Dibersihkan", description: "Semua item dinonaktifkan dan pesanan aktif dibatalkan." });
            setPendingClear(null);
        },
        onError: (err) => {
            toast({ title: "Gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan.", variant: "destructive" });
            setPendingClear(null);
        },
    });

    const clearTransactionsMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: "buyer" | "seller" }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sesi tidak valid");

            const res = await fetch("/api/admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ action: "clear-transactions", user_id: userId, role }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Terjadi kesalahan" }));
                throw new Error(err.detail || `Error ${res.status}`);
            }
            return res.json();
        },
        onSuccess: (_, { role }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast({ title: "Riwayat Dibersihkan", description: `Riwayat transaksi sebagai ${role === "buyer" ? "pembeli" : "penjual"} telah dihapus.` });
            setPendingClear(null);
        },
        onError: () => {
            toast({ title: "Gagal", description: "Terjadi kesalahan. Coba lagi.", variant: "destructive" });
            setPendingClear(null);
        },
    });

    const handleLoginAsUser = async (user: UserProfile) => {
        setLoggingInAs(user.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sesi tidak valid");

            const res = await fetch("/api/admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ action: "login-as-user", user_email: user.email, redirect_to: window.location.origin }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Terjadi kesalahan" }));
                throw new Error(err.detail || `Error ${res.status}`);
            }

            const { action_link } = await res.json();
            if (!action_link) throw new Error("Link tidak tersedia");
            window.open(action_link, "_blank", "noopener,noreferrer");
        } catch (err) {
            toast({
                title: "Gagal Login sebagai Pengguna",
                description: err instanceof Error ? err.message : "Terjadi kesalahan.",
                variant: "destructive",
            });
        } finally {
            setLoggingInAs(null);
        }
    };

    const filtered = useMemo(() => {
        if (!users) return [];
        return users.filter((u) => {
            const matchSearch =
                !search ||
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase());
            const matchRole =
                roleFilter === "all" ||
                u.user_roles.some((r) => r.role === roleFilter);
            const matchStatus = statusFilter === "all" || u.status === statusFilter;
            return matchSearch && matchRole && matchStatus;
        });
    }, [users, search, roleFilter, statusFilter]);

    const stats = useMemo(() => {
        if (!users) return { total: 0, sellers: 0, buyers: 0, admins: 0, frozen: 0, suspended: 0 };
        return {
            total: users.length,
            sellers:   users.filter((u) => u.user_roles.some((r) => r.role === "penjual")).length,
            buyers:    users.filter((u) => u.user_roles.some((r) => r.role === "pembeli")).length,
            admins:    users.filter((u) => u.user_roles.some((r) => r.role === "admin")).length,
            frozen:    users.filter((u) => u.status === "frozen").length,
            suspended: users.filter((u) => u.status === "suspended").length,
        };
    }, [users]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Manajemen Pengguna</h1>
                    <p className="text-sm text-muted-foreground">Kelola semua pengguna platform</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <StatCard icon={UserCircle}   label="Total"      value={stats.total}     color="text-primary"       isLoading={isLoading} />
                <StatCard icon={Store}        label="Penjual"    value={stats.sellers}   color="text-blue-600"      isLoading={isLoading} />
                <StatCard icon={ShoppingBag}  label="Pembeli"    value={stats.buyers}    color="text-emerald-600"   isLoading={isLoading} />
                <StatCard icon={ShieldCheck}  label="Admin"      value={stats.admins}    color="text-purple-600"    isLoading={isLoading} />
                <StatCard icon={ShieldOff}    label="Dibekukan"  value={stats.frozen}    color="text-blue-600"      isLoading={isLoading} />
                <StatCard icon={ShieldBan}    label="Disuspend"  value={stats.suspended} color="text-red-600"       isLoading={isLoading} />
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama atau email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Semua peran" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua peran</SelectItem>
                                <SelectItem value="penjual">Penjual</SelectItem>
                                <SelectItem value="pembeli">Pembeli</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Semua status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua status</SelectItem>
                                <SelectItem value="active">Aktif</SelectItem>
                                <SelectItem value="frozen">Dibekukan</SelectItem>
                                <SelectItem value="suspended">Disuspend</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Peran</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="whitespace-nowrap">Bergabung</TableHead>
                                <TableHead className="text-center w-16">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((__, j) => (
                                            <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        Tidak ada pengguna ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((u) => {
                                    const statusCfg = STATUS_CONFIG[u.status];
                                    const StatusIcon = statusCfg.icon;
                                    return (
                                        <TableRow key={u.id} className={u.status === "suspended" ? "opacity-60" : ""}>
                                            <TableCell className="font-medium">{u.name || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {u.user_roles.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        u.user_roles.map((r) => (
                                                            <span
                                                                key={r.role}
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_VARIANTS[r.role] ?? ""}`}
                                                            >
                                                                {ROLE_LABELS[r.role] ?? r.role}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {statusCfg.label}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatDate(u.created_at)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate max-w-[120px] sm:max-w-[170px]">
                                                            {u.name || u.email}
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {getAvailableActions(u.status).map((action) => {
                                                            const ActionIcon = action.icon;
                                                            return (
                                                                <DropdownMenuItem
                                                                    key={action.next}
                                                                    className={action.destructive ? "text-red-600 focus:text-red-600" : ""}
                                                                    onClick={() => setPendingAction({ user: u, action })}
                                                                >
                                                                    <ActionIcon className="h-4 w-4 mr-2" />
                                                                    {action.label}
                                                                </DropdownMenuItem>
                                                            );
                                                        })}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            disabled={loggingInAs === u.id}
                                                            onClick={() => handleLoginAsUser(u)}
                                                        >
                                                            <LogIn className="h-4 w-4 mr-2" />
                                                            {loggingInAs === u.id ? "Memproses..." : "Login sebagai Pengguna"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-xs text-muted-foreground"
                                                            onClick={() => navigator.clipboard.writeText(u.id)}
                                                        >
                                                            <ShieldAlert className="h-4 w-4 mr-2" />
                                                            Salin ID Pengguna
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Data Pengguna</DropdownMenuLabel>
                                                        {u.user_roles.some((r) => r.role === "penjual") && (
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => setPendingClear({ user: u, type: "items" })}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Bersihkan Item
                                                            </DropdownMenuItem>
                                                        )}
                                                        {u.user_roles.some((r) => r.role === "pembeli") && (
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => setPendingClear({ user: u, type: "tx-buyer" })}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Hapus Riwayat (Pembeli)
                                                            </DropdownMenuItem>
                                                        )}
                                                        {u.user_roles.some((r) => r.role === "penjual") && (
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => setPendingClear({ user: u, type: "tx-seller" })}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Hapus Riwayat (Penjual)
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    {!isLoading && filtered.length > 0 && (
                        <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                            Menampilkan {filtered.length} dari {users?.length ?? 0} pengguna
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirm Action Dialog */}
            <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingAction?.action.label}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-1">
                            <span className="block">
                                Pengguna: <strong>{pendingAction?.user.name || pendingAction?.user.email}</strong>
                            </span>
                            <span className="block">
                                {pendingAction ? STATUS_DESCRIPTIONS[pendingAction.action.next] : ""}
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className={pendingAction?.action.destructive ? "bg-red-600 hover:bg-red-700" : ""}
                            onClick={() => {
                                if (!pendingAction) return;
                                updateStatusMutation.mutate({
                                    userId: pendingAction.user.id,
                                    status: pendingAction.action.next,
                                });
                            }}
                        >
                            Konfirmasi
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Clear Data Dialog */}
            <AlertDialog open={!!pendingClear} onOpenChange={(open) => { if (!open) setPendingClear(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            {pendingClear?.type === "items"
                                ? "Bersihkan Semua Item"
                                : pendingClear?.type === "tx-buyer"
                                ? "Hapus Riwayat Transaksi (Pembeli)"
                                : "Hapus Riwayat Transaksi (Penjual)"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span className="block">
                                Pengguna: <strong>{pendingClear?.user.name || pendingClear?.user.email}</strong>
                            </span>
                            <span className="block">
                                {pendingClear?.type === "items"
                                    ? "Semua produk akan dinonaktifkan, pesanan aktif akan dibatalkan, dan pembeli akan di-refund jika sudah membayar. Tindakan ini tidak dapat dibatalkan."
                                    : `Semua riwayat transaksi sebagai ${pendingClear?.type === "tx-buyer" ? "pembeli" : "penjual"} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={clearItemsMutation.isPending || clearTransactionsMutation.isPending}
                            onClick={() => {
                                if (!pendingClear) return;
                                if (pendingClear.type === "items") {
                                    clearItemsMutation.mutate({ userId: pendingClear.user.id });
                                } else {
                                    clearTransactionsMutation.mutate({
                                        userId: pendingClear.user.id,
                                        role: pendingClear.type === "tx-buyer" ? "buyer" : "seller",
                                    });
                                }
                            }}
                        >
                            {(clearItemsMutation.isPending || clearTransactionsMutation.isPending) ? "Memproses..." : "Hapus Permanen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    isLoading,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    isLoading: boolean;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${color}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        {isLoading ? (
                            <Skeleton className="h-6 w-10 mt-0.5" />
                        ) : (
                            <p className="text-xl font-bold">{value}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
