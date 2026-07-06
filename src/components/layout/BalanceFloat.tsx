import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ShoppingCart } from "lucide-react";
import { isPast } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BalanceFloat() {
    const { user, activeRole } = useAuth();
    const { totalItems, cart } = useCart();
    const navigate = useNavigate();
    const location = useLocation();
    const isBuyer = activeRole === "pembeli";

    const { data: balance } = useQuery({
        queryKey: ["balance-float", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("seller_balance_transactions")
                .select("type, amount, status, available_at")
                .eq("seller_id", user!.id);
            let aktif = 0;
            for (const tx of data ?? []) {
                if (tx.status === "failed") continue;
                if (tx.type === "credit") {
                    if (
                        tx.status === "completed" ||
                        (tx.status === "pending" && isPast(new Date(tx.available_at)))
                    ) {
                        aktif += tx.amount;
                    }
                } else if (tx.type === "debit" && tx.status === "completed") {
                    aktif -= tx.amount;
                }
            }
            return Math.max(0, aktif);
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
    });

    if (!user) return null;

    const balanceUrl = isBuyer ? "/saldo" : "/balance";
    const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const showCart = isBuyer && totalItems > 0;
    const onBalancePage = location.pathname === balanceUrl;

    // If on balance page and no cart, nothing to show
    if (onBalancePage && !showCart) return null;

    return (
        <div
            className={cn(
                "fixed bottom-[4.5rem] right-4 z-50 md:bottom-6 md:right-6",
                "flex items-center rounded-full",
                "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                "border border-white/20 text-sm font-semibold",
                "transition-all duration-200 hover:shadow-xl hover:shadow-primary/40",
            )}
        >
            {/* Balance side — hidden when on balance page */}
            {!onBalancePage && (
                <button
                    onClick={() => navigate(balanceUrl)}
                    className={cn(
                        "flex items-center gap-2 pl-3 py-2.5 transition-opacity hover:opacity-80 active:scale-95",
                        showCart ? "pr-3" : "pr-4",
                    )}
                >
                    <Wallet className="h-4 w-4 flex-shrink-0" />
                    {/* Hide amount on mobile when cart is also visible to keep pill compact */}
                    <span className={showCart ? "hidden sm:inline" : undefined}>
                        {formatCurrency(balance ?? 0)}
                    </span>
                </button>
            )}

            {/* Divider */}
            {!onBalancePage && showCart && (
                <span className="w-px h-5 bg-white/30 flex-shrink-0" />
            )}

            {/* Cart side */}
            {showCart && (
                <button
                    onClick={() => navigate("/toko?openCart=1")}
                    className="flex items-center gap-2 pl-3 pr-4 py-2.5 hover:opacity-80 active:scale-95 transition-opacity"
                >
                    <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                    <span>{totalItems}</span>
                    <span className="opacity-75">· {formatCurrency(cartTotal)}</span>
                </button>
            )}
        </div>
    );
}
