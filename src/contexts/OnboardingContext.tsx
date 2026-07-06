import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────────
export interface BuyerProfile {
    id?: string;
    user_id: string;
    phone: string;
    address: string;
    profile_image_url: string;
    product_preference: string[];
    delivery_max_distance_km: number;
    onboarding_step: number;
}

export interface SellerProfile {
    id?: string;
    user_id: string;
    shop_telephone: string;
    delivery_method: string;
    onboarding_step: number;
}

const BUYER_TOTAL_STEPS = 2;
const SELLER_TOTAL_STEPS = 4;

interface OnboardingContextType {
    buyerProfile: BuyerProfile | null;
    sellerProfile: SellerProfile | null;
    buyerProgress: number;
    sellerProgress: number;
    isBuyerOnboardingComplete: boolean;
    isSellerOnboardingComplete: boolean;
    loading: boolean;
    refreshOnboarding: () => Promise<void>;
    updateBuyerProfile: (data: Partial<BuyerProfile>) => Promise<{ error: Error | null }>;
    updateSellerProfile: (data: Partial<SellerProfile>) => Promise<{ error: Error | null }>;
    advanceBuyerStep: (step: number) => Promise<void>;
    advanceSellerStep: (step: number) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const { user, activeRole, userRoles, loading: authLoading } = useAuth();
    const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null);
    const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfiles = useCallback(async (isRefresh = false) => {
        if (!user) { if (!isRefresh) setLoading(false); return; }
        // Wait until auth has fully resolved roles before fetching profiles.
        // If we fetch with userRoles=[] we incorrectly see no profiles, clear loading,
        // and ProtectedRoute redirects to onboarding even for completed users.
        if (authLoading) return;
        // Only show loading spinner on initial fetch, not refreshes.
        // Setting loading=true during a refresh causes ProtectedRoute to unmount
        // the onboarding component (showing a spinner), which resets all local state.
        if (!isRefresh) setLoading(true);

        try {
            // Fetch buyer profile if user has buyer role
            if (userRoles.includes("pembeli")) {
                const { data: bp } = await supabase
                    .from("buyer_profiles")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();
                setBuyerProfile(bp);
            }

            // Fetch seller profile if user has seller role
            if (userRoles.includes("penjual")) {
                const { data: sp } = await supabase
                    .from("seller_profiles")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();
                setSellerProfile(sp);
            }
        } catch (err) {
            console.error("Failed to fetch onboarding profiles:", err);
        }
        if (!isRefresh) setLoading(false);
    // Use user?.id (not the whole user object) to avoid re-running when Supabase
    // refreshes the session token and creates a new user object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, userRoles, authLoading]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const buyerProgress = buyerProfile
        ? Math.round((buyerProfile.onboarding_step / BUYER_TOTAL_STEPS) * 100)
        : 0;

    const sellerProgress = sellerProfile
        ? Math.round((sellerProfile.onboarding_step / SELLER_TOTAL_STEPS) * 100)
        : 0;

    const isBuyerOnboardingComplete = buyerProgress >= 100;
    const isSellerOnboardingComplete = sellerProgress >= 100;

    const updateBuyerProfile = async (data: Partial<BuyerProfile>) => {
        if (!user) return { error: new Error("Not logged in") };

        const payload = { ...data, user_id: user.id, updated_at: new Date().toISOString() };

        const { error } = await supabase
            .from("buyer_profiles")
            .upsert(payload, { onConflict: "user_id" });
            
        if (!error) await fetchProfiles(true);
        return { error: error as Error | null };
    };

    const updateSellerProfile = async (data: Partial<SellerProfile>) => {
        if (!user) return { error: new Error("Not logged in") };

        const payload = { ...data, user_id: user.id, updated_at: new Date().toISOString() };

        const { error } = await supabase
            .from("seller_profiles")
            .upsert(payload, { onConflict: "user_id" });

        if (!error) await fetchProfiles(true);
        return { error: error as Error | null };
    };

    const advanceBuyerStep = async (step: number) => {
        if (!user) return;
        const { data } = await supabase.from("buyer_profiles").select("onboarding_step").eq("user_id", user.id).maybeSingle();
        const current = data?.onboarding_step ?? 0;
        if (step > current) {
            await updateBuyerProfile({ onboarding_step: step });
        }
    };

    const advanceSellerStep = async (step: number) => {
        if (!user) return;
        const { data } = await supabase.from("seller_profiles").select("onboarding_step").eq("user_id", user.id).maybeSingle();
        const current = data?.onboarding_step ?? 0;
        if (step > current) {
            await updateSellerProfile({ onboarding_step: step });
        }
    };

    return (
        <OnboardingContext.Provider
            value={{
                buyerProfile, sellerProfile,
                buyerProgress, sellerProgress,
                isBuyerOnboardingComplete, isSellerOnboardingComplete,
                loading,
                refreshOnboarding: () => fetchProfiles(true),
                updateBuyerProfile, updateSellerProfile,
                advanceBuyerStep, advanceSellerStep,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
    return ctx;
}
