import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Bell, Send, Users, Store, ShoppingBag, User, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type TargetAudience = "all" | "penjual" | "pembeli" | "specific";
type NotifType = "system" | "promo";

interface SentNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
    user_id: string;
}

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; icon: React.ElementType; description: string }[] = [
    { value: "all", label: "Semua Pengguna", icon: Users, description: "Kirim ke seluruh pengguna terdaftar" },
    { value: "penjual", label: "Semua Penjual", icon: Store, description: "Hanya pengguna dengan peran Penjual" },
    { value: "pembeli", label: "Semua Pembeli", icon: ShoppingBag, description: "Hanya pengguna dengan peran Pembeli" },
    { value: "specific", label: "Pengguna Tertentu", icon: User, description: "Kirim ke satu pengguna (berdasarkan email)" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminNotifications() {
    const { toast } = useToast();
    const { user: adminUser } = useAuth();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [notifType, setNotifType] = useState<NotifType>("system");
    const [target, setTarget] = useState<TargetAudience>("all");
    const [specificEmail, setSpecificEmail] = useState("");

    // Recent admin broadcasts (system notifications ordered by date)
    const { data: recentBroadcasts, isLoading: loadingHistory } = useQuery({
        queryKey: ["admin-broadcasts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("notifications")
                .select("id, title, message, type, created_at, user_id")
                .in("type", ["system", "promo"])
                .order("created_at", { ascending: false })
                .limit(30);
            if (error) throw error;
            return (data ?? []) as SentNotification[];
        },
        staleTime: 1000 * 60,
    });

    // ─── Broadcast mutation ───────────────────────────────────────────────────

    const broadcast = useMutation({
        mutationFn: async () => {
            if (!title.trim() || !message.trim()) {
                throw new Error("Judul dan pesan wajib diisi.");
            }

            let recipientIds: string[] = [];

            if (target === "specific") {
                // Look up by email
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("email", specificEmail.trim())
                    .maybeSingle();
                if (error) throw error;
                if (!profile) throw new Error(`Pengguna dengan email "${specificEmail.trim()}" tidak ditemukan.`);
                recipientIds = [profile.id];
            } else if (target === "all") {
                const { data: profiles, error } = await supabase
                    .from("profiles")
                    .select("id");
                if (error) throw error;
                recipientIds = (profiles ?? []).map((p: { id: string }) => p.id);
            } else {
                // penjual or pembeli
                const { data: roles, error } = await supabase
                    .from("user_roles")
                    .select("user_id")
                    .eq("role", target);
                if (error) throw error;
                recipientIds = (roles ?? []).map((r: { user_id: string }) => r.user_id);
            }

            if (recipientIds.length === 0) {
                throw new Error("Tidak ada penerima yang ditemukan.");
            }

            // Insert notifications in batches of 50 to avoid request size limits
            const batchSize = 50;
            const rows = recipientIds.map((uid) => ({
                user_id: uid,
                title: title.trim(),
                message: message.trim(),
                type: notifType,
                is_read: false,
            }));

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const { error } = await supabase.from("notifications").insert(batch);
                if (error) throw error;
            }

            return recipientIds.length;
        },
        onSuccess: (count) => {
            toast({
                title: "Notifikasi Terkirim",
                description: `Berhasil dikirim ke ${count} pengguna.`,
            });
            setTitle("");
            setMessage("");
            setSpecificEmail("");
            queryClient.invalidateQueries({ queryKey: ["admin-broadcasts"] });
        },
        onError: (err: Error) => {
            toast({
                title: "Gagal Mengirim",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const canSend = title.trim().length > 0 && message.trim().length > 0 &&
        (target !== "specific" || specificEmail.trim().length > 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Bell className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifikasi Siaran</h1>
                    <p className="text-sm text-muted-foreground">Kirim pengumuman ke pengguna platform</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ── Compose form ── */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            Tulis Notifikasi
                        </CardTitle>
                        <CardDescription>Isi detail notifikasi yang akan dikirimkan</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Target audience */}
                        <div className="space-y-2">
                            <Label>Target Penerima</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {AUDIENCE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setTarget(opt.value)}
                                        className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                                            target === opt.value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                                        }`}
                                    >
                                        <opt.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${target === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                                        <div>
                                            <p className={`text-xs font-semibold ${target === opt.value ? "text-primary" : "text-foreground"}`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                {opt.description}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Specific email input */}
                        {target === "specific" && (
                            <div className="space-y-1.5">
                                <Label htmlFor="specific-email">Email Pengguna</Label>
                                <Input
                                    id="specific-email"
                                    type="email"
                                    placeholder="contoh@email.com"
                                    value={specificEmail}
                                    onChange={(e) => setSpecificEmail(e.target.value)}
                                />
                            </div>
                        )}

                        <Separator />

                        {/* Notification type */}
                        <div className="space-y-1.5">
                            <Label htmlFor="notif-type">Tipe Notifikasi</Label>
                            <Select value={notifType} onValueChange={(v) => setNotifType(v as NotifType)}>
                                <SelectTrigger id="notif-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">Sistem — Pengumuman penting</SelectItem>
                                    <SelectItem value="promo">Promo — Penawaran & promosi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label htmlFor="notif-title">Judul Notifikasi</Label>
                            <Input
                                id="notif-title"
                                placeholder="cth: Pemeliharaan Sistem Terjadwal"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={120}
                            />
                            <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
                        </div>

                        {/* Message */}
                        <div className="space-y-1.5">
                            <Label htmlFor="notif-message">Isi Pesan</Label>
                            <Textarea
                                id="notif-message"
                                placeholder="Tulis isi pesan notifikasi di sini..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
                        </div>

                        {/* Send button */}
                        <Button
                            className="w-full gap-2"
                            onClick={() => broadcast.mutate()}
                            disabled={!canSend || broadcast.isPending}
                        >
                            {broadcast.isPending ? (
                                <>
                                    <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                    Mengirim…
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Kirim Notifikasi
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Preview + History ── */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Preview */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Pratinjau</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${notifType === "promo" ? "bg-purple-100 text-purple-600" : "bg-red-100 text-red-600"}`}>
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            {title || <span className="text-muted-foreground italic">Judul notifikasi…</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Baru saja</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                        {notifType === "promo" ? "Promo" : "Sistem"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                                    {message || <span className="italic">Isi pesan…</span>}
                                </p>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                                {(() => {
                                    const opt = AUDIENCE_OPTIONS.find(o => o.value === target);
                                    if (!opt) return null;
                                    return (
                                        <>
                                            <opt.icon className="h-3.5 w-3.5" />
                                            <span>Akan dikirim ke: <strong>{opt.label}</strong>
                                                {target === "specific" && specificEmail ? ` (${specificEmail})` : ""}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Broadcast history */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Riwayat Siaran Terbaru
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y max-h-80 overflow-y-auto">
                                {loadingHistory ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="px-4 py-3 space-y-1.5">
                                            <Skeleton className="h-3.5 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    ))
                                ) : (recentBroadcasts ?? []).length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        Belum ada riwayat siaran
                                    </div>
                                ) : (
                                    // Deduplicate by title+message+date (same broadcast = multiple rows for each user)
                                    deduplicateBroadcasts(recentBroadcasts ?? []).map((notif) => (
                                        <div key={notif.id} className="px-4 py-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-xs font-semibold truncate">{notif.title}</p>
                                                <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${notif.type === "promo" ? "border-purple-200 text-purple-600" : "border-red-200 text-red-600"}`}>
                                                    {notif.type === "promo" ? "Promo" : "Sistem"}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                            <p className="text-[11px] text-muted-foreground/70 mt-1">
                                                {format(new Date(notif.created_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deduplicate broadcast rows that were sent to multiple users (same title+message within 1 min). */
function deduplicateBroadcasts(notifications: SentNotification[]): SentNotification[] {
    const seen = new Set<string>();
    return notifications.filter((n) => {
        // Round to the nearest minute to group bulk sends
        const minute = new Date(n.created_at);
        minute.setSeconds(0, 0);
        const key = `${n.title}__${n.message}__${minute.toISOString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
