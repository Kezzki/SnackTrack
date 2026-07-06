import { useEffect, useState } from "react";
import { ShieldOff, ShieldBan, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type AccountStatus = "active" | "frozen" | "suspended";

const BANNER_CONFIG = {
    frozen: {
        icon: ShieldOff,
        bg: "bg-blue-600",
        title: "Akun Kamu Dibekukan",
        description:
            "Pembelian, pembayaran, dan penarikan saldo sementara dinonaktifkan. Kamu masih bisa melihat data dan riwayat pesanan.",
        appeal:
            "Jika kamu merasa ini adalah kesalahan, hubungi admin untuk mengajukan banding.",
    },
    suspended: {
        icon: ShieldBan,
        bg: "bg-red-600",
        title: "Akun Kamu Disuspend",
        description:
            "Akun kamu telah disuspend dan semua aktivitas platform diblokir sementara.",
        appeal:
            "Hubungi admin untuk mengajukan banding dan informasi lebih lanjut mengenai alasan suspensi.",
    },
};

export function AccountStatusBanner() {
    const { user } = useAuth();
    const [status, setStatus] = useState<AccountStatus>("active");

    useEffect(() => {
        if (!user) return;
        supabase
            .from("profiles")
            .select("status")
            .eq("id", user.id)
            .single()
            .then(({ data }) => {
                const s = data?.status as AccountStatus | undefined;
                if (s === "frozen" || s === "suspended") setStatus(s);
            });

        // Realtime: re-check if admin changes status while user is logged in
        const channel = supabase
            .channel(`profile-status-${user.id}`)
            .on(
                "postgres_changes" as any,
                { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
                (payload: any) => {
                    const s = payload.new?.status as AccountStatus | undefined;
                    setStatus(s ?? "active");
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    if (status === "active") return null;

    const cfg = BANNER_CONFIG[status];
    const Icon = cfg.icon;

    return (
        <div className={`${cfg.bg} text-white w-full z-50 shadow-md`}>
            <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Icon + Text */}
                <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5 flex-shrink-0">
                        <Icon className="h-5 w-5 opacity-90" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm leading-snug">{cfg.title}</p>
                        <p className="text-xs opacity-85 mt-0.5 leading-snug">{cfg.description}</p>
                    </div>
                </div>

                {/* Appeal info */}
                <div className="flex items-center gap-2 flex-shrink-0 bg-white/15 rounded-lg px-3 py-2 text-xs">
                    <Mail className="h-4 w-4 opacity-80 flex-shrink-0" />
                    <div>
                        <p className="font-medium opacity-90">Ajukan Banding</p>
                        <p className="opacity-75">{cfg.appeal}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
