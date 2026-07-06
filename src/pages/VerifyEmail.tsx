import { useState } from "react";
import { Cookie, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface VerifyEmailProps {
    email: string;
    onBack: () => void;
}

export default function VerifyEmail({ email, onBack }: VerifyEmailProps) {
    const { signUp } = useAuth();
    const { toast } = useToast();
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);

    const handleResend = async () => {
        setResending(true);
        // Supabase will resend the confirmation email if you call signUp again
        // But a cleaner way is to use resend via the auth API
        try {
            const { error } = await (await import("@/lib/supabase")).supabase.auth.resend({
                type: "signup",
                email,
            });

            if (error) throw error;

            setResent(true);
            toast({
                title: "Email terkirim!",
                description: "Silakan cek inbox Anda (dan folder spam).",
            });

            // Reset resent state after 60s
            setTimeout(() => setResent(false), 60000);
        } catch (err: any) {
            toast({
                title: "Gagal mengirim ulang",
                description: err?.message || "Silakan coba lagi nanti.",
                variant: "destructive",
            });
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-primary">
                        <Cookie className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-bold text-foreground">SnackTrack</span>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_24px_60px_-28px_hsl(var(--sidebar-primary)/0.45),0_8px_24px_-14px_hsl(var(--sidebar-primary)/0.25)]">
                    {/* Animated mail icon */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-[pulse_3s_ease-in-out_infinite]">
                                <Mail className="h-10 w-10 text-primary" />
                            </div>
                            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-warning flex items-center justify-center">
                                <span className="text-xs font-bold text-warning-foreground">1</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold text-foreground mb-2">Cek Email Anda 📬</h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Kami telah mengirim link verifikasi ke
                        </p>
                        <p className="text-sm font-semibold text-primary mt-1 break-all">
                            {email}
                        </p>
                    </div>

                    {/* Steps */}
                    <div className="space-y-3 mb-8">
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                            <p className="text-sm text-muted-foreground">Buka email dari <strong className="text-foreground">SnackTrack</strong></p>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                            <p className="text-sm text-muted-foreground">Klik tombol <strong className="text-foreground">"Konfirmasi Email Saya"</strong></p>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                            <p className="text-sm text-muted-foreground">Kembali ke halaman ini dan <strong className="text-foreground">masuk</strong> dengan akun Anda</p>
                        </div>
                    </div>

                    {/* Resend */}
                    <div className="text-center space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Tidak menerima email? Cek folder spam atau kirim ulang.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResend}
                            disabled={resending || resent}
                            className="gap-2"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                            {resent ? "Email terkirim ✓" : resending ? "Mengirim..." : "Kirim Ulang Email"}
                        </Button>
                    </div>

                    {/* Divider */}
                    <hr className="my-6 border-border" />

                    {/* Back to login */}
                    <Button
                        variant="ghost"
                        className="w-full gap-2 text-muted-foreground"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke halaman masuk
                    </Button>
                </div>
            </div>
        </div>
    );
}
