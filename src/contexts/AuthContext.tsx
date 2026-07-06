import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { RefreshCcw } from "lucide-react";

type AppRole = "penjual" | "pembeli" | "admin";

// ─── Session expiry config ─────────────────────────────────────────────
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_LOGIN_KEY = "snacktrack_session_login_at";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    activeRole: AppRole | null;
    userRoles: AppRole[];
    setActiveRole: (role: AppRole) => void;
    signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    addRole: (role: AppRole) => Promise<{ error: Error | null }>;
    isSwitchingRole: AppRole | null;
    switchToRole: (role: AppRole, navigate: (path: string) => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simple timeout race — resolves to fallback value on timeout instead of rejecting
function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState<AppRole | null>(null);
    const [userRoles, setUserRoles] = useState<AppRole[]>([]);
    const [isSwitchingRole, setIsSwitchingRole] = useState<AppRole | null>(null);
    const expiryTimer = useRef<ReturnType<typeof setTimeout>>();
    const initDone = useRef(false);

    // Stable ref so fetchRoles can read current roles without being a dependency.
    const userRolesRef = useRef<AppRole[]>([]);

    // ─── Fetch roles (with 4s hard timeout via Promise.race) ───────────
    const fetchRoles = async (userId: string): Promise<AppRole[]> => {
        try {
            const result = await raceTimeout(
                supabase.from("user_roles").select("role").eq("user_id", userId) as any,
                4000,
                { data: null, error: new Error("timeout") } as any,
            );
            const roles = (result.data || []).map((r: any) => r.role as AppRole);
            // Only update state (and trigger dependents) when roles actually changed.
            const prev = userRolesRef.current;
            const changed = roles.length !== prev.length || roles.some((r) => !prev.includes(r));
            if (changed) {
                userRolesRef.current = roles;
                setUserRoles(roles);
            }
            return roles;
        } catch {
            userRolesRef.current = [];
            setUserRoles([]);
            return [];
        }
    };

    // ─── Session expiry helpers ────────────────────────────────────────
    const checkAndScheduleExpiry = () => {
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        const loginAt = localStorage.getItem(SESSION_LOGIN_KEY);
        if (!loginAt) return false;

        const remaining = SESSION_MAX_AGE_MS - (Date.now() - parseInt(loginAt, 10));
        if (remaining <= 0) return true;

        expiryTimer.current = setTimeout(() => {
            console.info("Session expired — auto signing out");
            doSignOut();
        }, Math.min(remaining, 2_147_483_647));
        return false;
    };

    // ─── Sign out ──────────────────────────────────────────────────────
    const doSignOut = async () => {
        setSession(null);
        setUser(null);
        setActiveRole(null);
        setUserRoles([]);
        localStorage.removeItem("snacktrack_active_role");
        localStorage.removeItem(SESSION_LOGIN_KEY);
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        try { await supabase.auth.signOut(); } catch { /* offline */ }
    };

    // ─── Auth initialization ───────────────────────────────────────────
    useEffect(() => {
        if (initDone.current) return;
        initDone.current = true;

        let cancelled = false;
        const failsafe = setTimeout(() => {
            if (!cancelled) {
                console.warn("Auth failsafe: forcing loading=false");
                setLoading(false);
            }
        }, 6000);

        const resolveAuth = async (sess: Session | null) => {
            if (cancelled) return;

            // BUG-011 FIX: Check if the Supabase JWT is expired.
            // If so, attempt to refresh. If refresh fails, sign out.
            if (sess?.expires_at && sess.expires_at * 1000 < Date.now()) {
                try {
                    const { data: refreshed, error } = await supabase.auth.refreshSession();
                    if (error || !refreshed?.session) {
                        console.warn("Session JWT expired and refresh failed — signing out");
                        await doSignOut();
                        setLoading(false);
                        clearTimeout(failsafe);
                        return;
                    }
                    sess = refreshed.session;
                } catch {
                    console.warn("Session JWT expired and refresh threw — signing out");
                    await doSignOut();
                    setLoading(false);
                    clearTimeout(failsafe);
                    return;
                }
            }

            // Only update session/user state when the identity actually changes to
            // avoid re-rendering OnboardingContext (and its loading spinner) on every
            // SIGNED_IN event that Supabase fires on window refocus.
            setSession((prev) => {
                if (prev?.access_token === sess?.access_token) return prev;
                return sess;
            });
            setUser((prev) => {
                if (prev?.id === sess?.user?.id) return prev;
                return sess?.user ?? null;
            });

            if (sess?.user) {
                const expired = checkAndScheduleExpiry();
                if (expired) {
                    await doSignOut();
                    setLoading(false);
                    clearTimeout(failsafe);
                    return;
                }
                if (!localStorage.getItem(SESSION_LOGIN_KEY)) {
                    localStorage.setItem(SESSION_LOGIN_KEY, String(Date.now()));
                    checkAndScheduleExpiry();
                }

                const roles = await fetchRoles(sess.user.id);
                if (cancelled) return;

                const saved = localStorage.getItem("snacktrack_active_role") as AppRole | null;
                if (saved && roles.includes(saved)) {
                    setActiveRole(saved);
                } else if (roles.length === 1) {
                    setActiveRole(roles[0]);
                }
            } else {
                setUserRoles([]);
                setActiveRole(null);
            }
            setLoading(false);
            clearTimeout(failsafe);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, sess) => {
                // TOKEN_REFRESHED just silently rotates the access token — the user
                // and their roles haven't changed, so skip the full re-auth which would
                // cause userRoles to get a new reference, re-triggering onboarding loading.
                if (event === "TOKEN_REFRESHED") return;
                // SIGNED_IN also fires on window refocus when Supabase detects the
                // existing session is still valid. Skip it if we already have the same user.
                if (event === "SIGNED_IN" && sess?.user?.id === user?.id) return;
                resolveAuth(sess);
            }
        );

        supabase.auth.getSession()
            .then(({ data: { session: sess } }) => resolveAuth(sess))
            .catch(() => {
                if (!cancelled) setLoading(false);
                clearTimeout(failsafe);
            });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            clearTimeout(failsafe);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Public methods ────────────────────────────────────────────────
    const handleSetActiveRole = (role: AppRole) => {
        setActiveRole(role);
        localStorage.setItem("snacktrack_active_role", role);
    };

    const switchToRole = (role: AppRole, navigate: (path: string) => void) => {
        setIsSwitchingRole(role);
        setTimeout(() => {
            handleSetActiveRole(role);
            navigate(role === "penjual" ? "/" : role === "pembeli" ? "/toko" : "/admin");
            setTimeout(() => {
                setIsSwitchingRole(null);
            }, 800); // Wait bit before hiding
        }, 100);
    };

    const signIn = async (email: string, password: string) => {
        try {
            const result = await raceTimeout(
                supabase.auth.signInWithPassword({ email, password }),
                10000,
                { error: new Error("Koneksi ke server terlalu lama. Silakan coba lagi.") } as any,
            );
            if (!result.error) {
                localStorage.setItem(SESSION_LOGIN_KEY, String(Date.now()));
                checkAndScheduleExpiry();
            }
            return { error: result.error as Error | null };
        } catch (e: any) {
            return { error: e as Error };
        }
    };

    const signUp = async (email: string, password: string, name: string) => {
        try {
            const result = await raceTimeout(
                supabase.auth.signUp({
                    email, password,
                    options: { emailRedirectTo: window.location.origin, data: { name } },
                }),
                10000,
                { error: new Error("Koneksi ke server terlalu lama. Silakan coba lagi.") } as any,
            );
            if (!result.error) {
                localStorage.setItem(SESSION_LOGIN_KEY, String(Date.now()));
            }
            return { error: result.error as Error | null };
        } catch (e: any) {
            return { error: e as Error };
        }
    };

    const resetPassword = async (email: string) => {
        try {
            const result = await raceTimeout(
                supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth`,
                }),
                10000,
                { error: new Error("Koneksi ke server terlalu lama. Silakan coba lagi.") } as any,
            );
            return { error: (result as any).error as Error | null };
        } catch (e: any) {
            return { error: e as Error };
        }
    };

    const addRole = async (role: AppRole) => {
        if (!user) return { error: new Error("Belum login") };
        const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: role as any });
        if (!error) await fetchRoles(user.id);
        return { error: error as Error | null };
    };

    return (
        <AuthContext.Provider
            value={{ session, user, loading, activeRole, userRoles, setActiveRole: handleSetActiveRole, signUp, signIn, resetPassword, signOut: doSignOut, addRole, isSwitchingRole, switchToRole }}
        >
            {children}
            {isSwitchingRole && (
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex bg-primary/10 h-24 w-24 rounded-full items-center justify-center mb-6 animate-pulse">
                        <RefreshCcw className="h-10 w-10 text-primary animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                        Beralih ke {isSwitchingRole === "penjual" ? "Dasbor Penjual" : isSwitchingRole === "pembeli" ? "Dasbor Pembeli" : "Dasbor Admin"}...
                    </h2>
                    <p className="text-primary mt-3 text-sm animate-pulse font-medium">Mohon tunggu sebentar</p>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
