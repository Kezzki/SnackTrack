import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VerifyEmail from "./VerifyEmail";
import { Cookie, Eye, EyeOff, Languages, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { BannerCarousel } from "@/components/ui/BannerCarousel";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";

type Language = "id" | "en";

const authCopy = {
    id: {
        appName: "SnackTrack",
        welcomeBack: "Selamat Datang Kembali",
        createAccount: "Daftar Akun Baru",
        signInSubtitle: "Masuk ke akun Anda",
        signUpSubtitle: "Buat akun untuk mulai berjualan",
        fullName: "Nama Lengkap",
        yourName: "Nama Anda",
        email: "Email",
        password: "Password",
        confirmPassword: "Konfirmasi Password",
        signIn: "Masuk",
        signUp: "Daftar",
        noAccount: "Belum punya akun?",
        hasAccount: "Sudah punya akun?",
        forgotPassword: "Lupa password?",
        resetPasswordSending: "Mengirim...",
        resetPasswordSuccessTitle: "Email reset terkirim",
        resetPasswordSuccessDescription: "Cek inbox email Anda untuk melanjutkan reset password.",
        emailRequiredError: "Masukkan email terlebih dahulu untuk reset password.",
        passwordMismatchError: "Password dan konfirmasi password tidak cocok.",
    },
    en: {
        appName: "SnackTrack",
        welcomeBack: "Welcome Back",
        createAccount: "Create New Account",
        signInSubtitle: "Sign in to your account",
        signUpSubtitle: "Create an account to start selling",
        fullName: "Full Name",
        yourName: "Your name",
        email: "Email",
        password: "Password",
        confirmPassword: "Confirm Password",
        signIn: "Sign In",
        signUp: "Sign Up",
        noAccount: "Don't have an account?",
        hasAccount: "Already have an account?",
        forgotPassword: "Forgot password?",
        resetPasswordSending: "Sending...",
        resetPasswordSuccessTitle: "Reset email sent",
        resetPasswordSuccessDescription: "Check your inbox to continue resetting your password.",
        emailRequiredError: "Enter your email first to reset your password.",
        passwordMismatchError: "Password and confirm password do not match.",
    },
};

export default function Auth() {
    const navigate = useNavigate();
    const { signIn, signUp, resetPassword } = useAuth();
    const { resolvedTheme, setTheme } = useTheme();
    const { toast } = useToast();

    const [isLogin, setIsLogin] = useState(true);
    const [language, setLanguage] = useState<Language>(() => {
        const stored = localStorage.getItem("snacktrack_auth_lang");
        return stored === "en" ? "en" : "id";
    });
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [error, setError] = useState("");
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

    const t = authCopy[language];

    const toggleLanguage = () => {
        const nextLanguage: Language = language === "id" ? "en" : "id";
        setLanguage(nextLanguage);
        localStorage.setItem("snacktrack_auth_lang", nextLanguage);
    };

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isLogin && password !== confirmPassword) {
            setError(t.passwordMismatchError);
            return;
        }

        setLoading(true);

        const result = isLogin
            ? await signIn(email, password)
            : await signUp(email, password, name);

        setLoading(false);

        if (result.error) {
            setError(result.error.message);
        } else if (isLogin) {
            // BUG-009 + BUG-021 FIX: Support ?redirect= query param and role-aware redirect
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get("redirect");
            if (redirect) {
                navigate(redirect);
            } else {
                const savedRole = localStorage.getItem("snacktrack_active_role");
                if (savedRole === "pembeli") navigate("/toko");
                else if (savedRole === "admin") navigate("/admin");
                else navigate("/"); // default for sellers or unknown
            }
        } else {
            // Show email verification screen after signup
            setPendingVerificationEmail(email);
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setError(t.emailRequiredError);
            return;
        }

        setError("");
        setResetLoading(true);
        const result = await resetPassword(email.trim());
        setResetLoading(false);

        if (result.error) {
            setError(result.error.message);
            return;
        }

        toast({
            title: t.resetPasswordSuccessTitle,
            description: t.resetPasswordSuccessDescription,
        });
    };

    const switchMode = () => { setIsLogin(!isLogin); setError(""); setConfirmPassword(""); };

    // Show verification screen after successful signup
    if (pendingVerificationEmail) {
        return (
            <VerifyEmail
                email={pendingVerificationEmail}
                onBack={() => {
                    setPendingVerificationEmail(null);
                    setIsLogin(true);
                }}
            />
        );
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8 sm:p-4">
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={toggleLanguage}>
                    <Languages className="h-4 w-4 mr-2" />
                    {language.toUpperCase()}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={toggleTheme}>
                    {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
            </div>

            <div className="w-full max-w-md">
                {/* Banner carousel — hidden on mobile to avoid scroll */}
                <BannerCarousel className="hidden sm:block mb-8" />

                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-4 sm:mb-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-primary">
                        <Cookie className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-bold text-foreground">{t.appName}</span>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 shadow-[0_24px_60px_-28px_hsl(var(--sidebar-primary)/0.45),0_8px_24px_-14px_hsl(var(--sidebar-primary)/0.25)]">
                    <div className="mb-4 sm:mb-6 text-center">
                        <h1 className="text-xl font-bold text-foreground">{isLogin ? t.welcomeBack : t.createAccount}</h1>
                        <p className="text-sm text-muted-foreground mt-1">{isLogin ? t.signInSubtitle : t.signUpSubtitle}</p>
                    </div>

                    {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">{error}</p>}

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="name">{t.fullName}</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.yourName} required />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">{t.email}</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">{t.password}</Label>
                            <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
                                <div className="relative">
                                    <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isLogin && (
                            <div className="-mt-1 text-right">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={resetLoading}
                                    className="text-sm text-primary font-medium hover:underline disabled:opacity-70"
                                >
                                    {resetLoading ? t.resetPasswordSending : t.forgotPassword}
                                </button>
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isLogin ? t.signIn : t.signUp}
                        </Button>
                    </form>

                    <div className="mt-4 sm:mt-6 text-center text-sm text-muted-foreground">
                        {isLogin ? t.noAccount : t.hasAccount}{" "}
                        <button className="text-primary font-medium hover:underline" onClick={switchMode}>
                            {isLogin ? t.signUp : t.signIn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
