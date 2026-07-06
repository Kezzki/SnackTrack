import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Cookie, Search, MessageCircle, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { Input } from "@/components/ui/input";

export function BuyerTopBar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { totalItems } = useCart();

    const isOnStore = location.pathname === "/toko";

    // Local input value — synced from URL when on the store page
    const [inputValue, setInputValue] = useState(() =>
        isOnStore ? (searchParams.get("q") ?? "") : ""
    );

    // Reset/sync input when navigating between pages
    useEffect(() => {
        setInputValue(isOnStore ? (searchParams.get("q") ?? "") : "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    const handleSearchChange = (val: string) => {
        setInputValue(val);
        if (isOnStore) {
            const next = new URLSearchParams(searchParams);
            if (val) next.set("q", val);
            else next.delete("q");
            setSearchParams(next, { replace: true });
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isOnStore) {
            navigate(`/toko${inputValue ? `?q=${encodeURIComponent(inputValue)}` : ""}`);
        }
    };

    const handleCartClick = () => {
        if (totalItems === 0) {
            navigate("/toko?tutorial=cart");
        } else {
            navigate("/toko?openCart=1");
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-30 md:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm">
            <div className="flex items-center gap-2 px-3 h-14">
                {/* Logo */}
                <button
                    onClick={() => navigate("/toko")}
                    className="flex items-center gap-1.5 flex-shrink-0"
                    aria-label="Beranda"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                        <Cookie className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm text-foreground">SnackTrack</span>
                </button>

                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="flex-1 mx-1">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            value={inputValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder={isOnStore ? "Cari produk…" : "Cari produk…"}
                            className="pl-8 h-8 text-sm bg-muted/60 border-0 focus-visible:ring-1 rounded-full"
                        />
                    </div>
                </form>

                {/* Chat */}
                <button
                    onClick={() => navigate("/pesan")}
                    className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors text-foreground/70"
                    aria-label="Pesan"
                >
                    <MessageCircle className="h-5 w-5" />
                </button>

                {/* Cart */}
                <button
                    onClick={handleCartClick}
                    className="relative flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors text-foreground/70"
                    aria-label="Keranjang"
                >
                    <ShoppingCart className="h-5 w-5" />
                    {totalItems > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center p-0 text-[9px] bg-primary text-primary-foreground border-0">
                            {totalItems > 9 ? "9+" : totalItems}
                        </Badge>
                    )}
                </button>
            </div>
        </header>
    );
}
