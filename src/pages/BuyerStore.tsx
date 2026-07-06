import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, MapPin, ShoppingCart, LogIn, Cookie, ChevronDown, LayoutGrid, List, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { BuyerProductCard } from "@/components/buyer/BuyerProductCard";
import { CartSheet } from "@/components/buyer/CartSheet";
import { NearestStoreDialog } from "@/components/buyer/NearestStoreDialog";
import { TutorialOverlay } from "@/components/buyer/TutorialOverlay";
import { BannerCarousel } from "@/components/ui/BannerCarousel";
import { CategoryPickerModal } from "@/components/buyer/CategoryPickerModal";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { BuyerProduct } from "@/types/product";

const TUTORIAL_KEY = "snacktrack_buyer_tutorial_done";
const buyerCategories = ["Semua", "Keripik", "Kue", "Popcorn", "Kacang", "Permen", "Lainnya"];
const ITEMS_PER_PAGE = 30;

interface BuyerStoreProps {
    isPublic?: boolean;
}

export default function BuyerStore({ isPublic = false }: BuyerStoreProps) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    // Search is driven by URL param ?q= so BuyerTopBar can update it live
    const search = searchParams.get("q") ?? "";
    const handleSearchChange = (val: string) => {
        const next = new URLSearchParams(searchParams);
        if (val) next.set("q", val); else next.delete("q");
        setSearchParams(next, { replace: true });
    };
    const [selectedCategory, setSelectedCategory] = useState("Semua");
    const [sortBy, setSortBy] = useState("popular");
    const [cartOpen, setCartOpen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [currentPage, setCurrentPage] = useState(1);
    const { cart, addToCart, updateQuantity, totalItems } = useCart();
    
const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ['buyer-products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, category, description, price, stock, image_url, rating, store:stores(name)')
                .eq('is_active', true);

            if (error) {
                console.error("Error fetching products:", error);
                return [];
            }

            if (data) {
                return data.map((p) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    stock: p.stock,
                    image: p.image_url || null,
                    description: p.description,
                    rating: p.rating || 0,
                    // BUG-026 FIX: @ts-ignore removed — types now resolve via supabase-types.ts
                    storeName: p.store ? (p.store as any).name : "Toko Tidak Diketahui"  
                })) as unknown as BuyerProduct[];
            }
            return [];
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    // Tutorial
    const [showTutorial, setShowTutorial] = useState(false);
    const firstCardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Prompt for GPS early
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                () => {}, () => {}, { timeout: 10000 }
            );
        }
    }, []);

    useEffect(() => {
        if (isPublic) return;
        if (searchParams.get("openCart") === "1") { setCartOpen(true); setSearchParams({}, { replace: true }); }
        if (searchParams.get("tutorial") === "cart") {
            if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, isPublic]);

    const dismissTutorial = () => { setShowTutorial(false); localStorage.setItem(TUTORIAL_KEY, "1"); };

    const filtered = useMemo(() => {
        const list = products.filter((p) => {
            const needle = search.trim().toLowerCase();
            const matchSearch = p.name.toLowerCase().includes(needle) || (p.description || "").toLowerCase().includes(needle);
            const matchCategory = selectedCategory === "Semua" || p.category === selectedCategory;
            return matchSearch && matchCategory;
        });
        switch (sortBy) {
            case "rating": list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
            case "price-low": list.sort((a, b) => a.price - b.price); break;
            case "price-high": list.sort((a, b) => b.price - a.price); break;
        }
        return list;
    }, [products, search, selectedCategory, sortBy]);

    // Reset pagination on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedCategory, sortBy]);

    const currentProducts = filtered.slice(0, currentPage * ITEMS_PER_PAGE);

    return (
        <div className={cn("p-6 max-w-7xl mx-auto", isPublic && "min-h-screen bg-background pt-0")}>    
            {/* Public header with login */}
            {isPublic && (
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-primary">
                            <Cookie className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-xl text-foreground">SnackTrack</span>
                    </div>
                    <Button onClick={() => navigate("/auth")} size="sm">
                        <LogIn className="h-4 w-4 mr-1" /> Masuk
                    </Button>
                </div>
            )}

            {/* Banner carousel */}
            <BannerCarousel className="mb-6" />

            {/* Sticky filter bar — sits below the BuyerTopBar on mobile */}
            <div className={cn(
                "sticky z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 pb-3 pt-2 border-b border-border mb-4",
                isPublic ? "top-0" : "top-14 md:top-0"
            )}>
                {/* Desktop: title row */}
                <div className="hidden sm:flex flex-row items-center justify-between gap-2 mb-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                            {isPublic ? "Jelajahi Produk" : "Toko"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">{filtered.length} produk tersedia</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setMapOpen(true)}>
                            <MapPin className="h-4 w-4 mr-1" /> Toko Terdekat
                        </Button>
                        {isPublic && (
                            <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                                <LogIn className="h-4 w-4 mr-1" /> Masuk untuk belanja
                            </Button>
                        )}
                    </div>
                </div>

                {/* Desktop: search + view toggles */}
                <div className="hidden sm:flex gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setViewMode("grid")} className={cn(viewMode === "grid" && "bg-muted")}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setViewMode("list")} className={cn(viewMode === "list" && "bg-muted")}>
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari produk…" value={search} onChange={(e) => handleSearchChange(e.target.value)} maxLength={100} className="pl-10" />
                    </div>
                </div>

                {/* Mobile: single compact row — search lives in BuyerTopBar */}
                <div className="flex sm:hidden items-center gap-2 py-1">
                    {/* View toggles */}
                    <button onClick={() => setViewMode("grid")} className={cn("h-8 w-8 flex items-center justify-center rounded-md transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground")}>
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button onClick={() => setViewMode("list")} className={cn("h-8 w-8 flex items-center justify-center rounded-md transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground")}>
                        <List className="h-4 w-4" />
                    </button>
                    {/* Divider */}
                    <div className="w-px h-5 bg-border" />
                    {/* Product count */}
                    <span className="text-xs text-muted-foreground flex-1">{filtered.length} produk</span>
                    {/* Category chip */}
                    <button onClick={() => setCategoryOpen(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
                        <span className="text-primary">{selectedCategory}</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {/* Map pin */}
                    <button onClick={() => setMapOpen(true)} className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors">
                        <MapPin className="h-4 w-4" />
                    </button>
                    {isPublic && (
                        <button onClick={() => navigate("/auth")} className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors">
                            <LogIn className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Desktop: category tabs */}
                <div className="hidden sm:flex gap-1 mt-3 rounded-lg bg-muted p-1">
                    {buyerCategories.map((cat) => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap", selectedCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background")}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product grid */}
            {isLoadingProducts ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Memuat produk...</p>
                </div>
            ) : filtered.length > 0 ? (
                <>
                    <div className={cn(
                        viewMode === "grid"
                            ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-6"
                            : "flex flex-col gap-4"
                    )}>
                        {currentProducts.map((product, i) => {
                            const cartItem = cart.find((c) => c.productId === product.id);
                            return (
                                <div key={product.id} ref={i === 0 ? firstCardRef : undefined} className="h-full">
                                    <BuyerProductCard
                                        product={product} index={i}
                                        cartQuantity={cartItem?.quantity ?? 0}
                                        onAddToCart={() => addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock })}
                                        onUpdateQuantity={(qty) => updateQuantity(product.id, qty)}
                                        isPublic={isPublic}
                                        viewMode={viewMode}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    {filtered.length > currentProducts.length && (
                        <div className="flex justify-center mt-8">
                            <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)}>
                                Tampilkan Lebih Banyak
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16"><p className="text-muted-foreground">Tidak ada produk ditemukan</p></div>
            )}

            {/* Dialogs / sheets */}
            {!isPublic && <CartSheet open={cartOpen} onOpenChange={setCartOpen} items={cart} onUpdateQuantity={updateQuantity} />}
            <NearestStoreDialog open={mapOpen} onOpenChange={setMapOpen} />
            {showTutorial && firstCardRef.current && <TutorialOverlay targetRef={firstCardRef} onDismiss={dismissTutorial} />}
            <CategoryPickerModal
                categories={buyerCategories}
                selected={selectedCategory}
                onSelect={setSelectedCategory}
                open={categoryOpen}
                onClose={() => setCategoryOpen(false)}
            />
        </div>
    );
}
