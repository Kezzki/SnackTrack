import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const SELLER_STORE_KEY = (userId: string | undefined) =>
    ["seller-store", userId] as const;

export interface SellerStore {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    image_url: string | null;
    banner_url: string | null;
    is_active: boolean;
    rating: number | null;
    is_on_holiday: boolean;
    holiday_message: string | null;
    auto_reply_enabled: boolean;
    auto_reply_prompt: string | null;
}

/**
 * Single source of truth for the current seller's store.
 * Shared query key means every component using this hook
 * reads from the same cache — only ONE DB call per 5 minutes.
 */
export function useSellerStore() {
    const { user } = useAuth();
    return useQuery<SellerStore | null>({
        queryKey: SELLER_STORE_KEY(user?.id),
        queryFn: async () => {
            if (!user) return null;
            const { data } = await supabase
                .from("stores")
                .select("id, name, description, address, image_url, banner_url, is_active, rating, is_on_holiday, holiday_message, auto_reply_enabled, auto_reply_prompt")
                .eq("seller_id", user.id)
                .maybeSingle();
            return data ?? null;
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes — realtime updates invalidate manually
    });
}

/** Call this after updating store data to bust the cache. */
export function useInvalidateSellerStore() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: SELLER_STORE_KEY(user?.id) });
}
