import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Store, MapPin, ArrowLeft, Star, ShoppingCart, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerProductCard } from "@/components/buyer/BuyerProductCard";
import { CartSheet } from "@/components/buyer/CartSheet";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { BuyerProduct } from "@/types/product";

export default function StoreProfile() {
    const { id } = useParams<{ id: string }>();
    const { cart, addToCart, updateQuantity, totalItems } = useCart();
    const { user, activeRole } = useAuth();
    const [cartOpen, setCartOpen] = useState(false);
    const isBuyer = activeRole === "pembeli";
    const { collapsed } = useSidebar();
    const { toast } = useToast();

    const { data: storeData, isLoading: isLoadingStore } = useQuery({
        queryKey: ['store-profile', id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                console.error("Error fetching store:", error);
                return null;
            }
            return data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['store-products', id],
        queryFn: async () => {
            if (!id) return [];
            const { data, error } = await supabase
                .from('products')
                .select('*, store:stores(name)')
                .eq('store_id', id)
                .eq('is_active', true);
            
            if (error) {
                console.error("Error fetching products:", error);
                return [];
            }
            
            return data.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                stock: p.stock || 0,
                image: p.image_url || 'https://via.placeholder.com/400',
                description: p.description,
                rating: p.rating || 0,
                soldCount: p.sold_count || 0,
                storeName: p.store?.name || "Toko Tidak Diketahui",
                storeId: id,
                category: p.category || "Lainnya"
            })) as BuyerProduct[];
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    const { data: reviewCountData } = useQuery({
        queryKey: ['store-review-count', id],
        queryFn: async () => {
            if (!id) return 0;
            // Count all reviews for products belonging to this store
            const { data: productIds } = await supabase
                .from('products')
                .select('id')
                .eq('store_id', id);
            if (!productIds || productIds.length === 0) return 0;
            const { count } = await supabase
                .from('reviews')
                .select('id', { count: 'exact', head: true })
                .in('product_id', productIds.map(p => p.id));
            return count || 0;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 10,
    });
    const storeReviewCount = reviewCountData ?? 0;

    return (
        <div className="min-h-screen bg-background relative">
            {user && <AppSidebar />}

            <CartSheet
                open={cartOpen}
                onOpenChange={setCartOpen}
                items={cart}
                onUpdateQuantity={updateQuantity}
            />

            <div className={cn("min-h-screen pb-20 transition-all duration-300", user && (collapsed ? "md:pl-16" : "md:pl-60"))}>
            {/* Header / Nav */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0 mr-1" onClick={() => window.history.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="font-semibold text-base sm:text-lg line-clamp-1 min-w-0">{storeData?.name || "Toko"}</h1>
            </div>

            {isLoadingStore ? (
                <div className="p-8 text-center">Loading profil toko...</div>
            ) : storeData ? (
                <>
                    {/* Banner Section */}
                    <div className="w-full h-24 md:h-32 bg-muted relative">
                        {storeData.banner_url ? (
                            <img src={storeData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                <Store className="h-16 w-16 text-primary/30" />
                            </div>
                        )}
                    </div>

                    {/* Profile Section */}
                    <div className="px-4 sm:px-6 max-w-5xl mx-auto">
                        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-3 -mt-8 sm:-mt-10 mb-6 text-center sm:text-left">
                            <div className="relative">
                                <img 
                                    src={storeData.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(storeData.name)}&background=random`} 
                                    alt={storeData.name} 
                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-background bg-muted shadow-md"
                                />
                            </div>
                            <div className="flex-1 pb-2">
                                <h1 className="text-2xl font-bold text-foreground">{storeData.name}</h1>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-sm text-muted-foreground">
                                    {storeData.address && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-4 w-4" /> {storeData.address}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        {storeData.rating > 0 ? (
                                            <>
                                                <Star className="h-4 w-4 fill-warning text-warning" />
                                                {storeData.rating} ({storeReviewCount} ulasan)
                                            </>
                                        ) : (
                                            "Belum ada ulasan"
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Holiday Banner */}
                            {storeData.is_on_holiday && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <Palmtree className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Toko Sedang Libur</p>
                                        {storeData.holiday_message && (
                                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">{storeData.holiday_message}</p>
                                        )}
                                        <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">Pemesanan tidak tersedia. Kamu masih bisa mengirim pesan ke toko.</p>
                                    </div>
                                </div>
                            )}

                            {storeData.description && (
                                <div>
                                    <h3 className="font-semibold text-lg mb-2">Tentang Toko</h3>
                                    <p className="text-muted-foreground">{storeData.description}</p>
                                </div>
                            )}

                            <div>
                                <h3 className="font-semibold text-lg mb-4">Semua Produk</h3>
                                {isLoadingProducts ? (
                                    <div className="py-8 text-center">Loading produk...</div>
                                ) : productsData && productsData.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {productsData.map(product => {
                                            const cartItem = cart.find(c => c.productId === product.id);
                                            return (
                                                <BuyerProductCard
                                                    key={product.id}
                                                    product={product}
                                                    cartQuantity={cartItem?.quantity ?? 0}
                                                    onAddToCart={() => {
                                                        if (storeData.is_on_holiday) {
                                                            toast({ title: "Toko sedang libur", description: "Pemesanan tidak tersedia saat ini.", variant: "destructive" });
                                                            return;
                                                        }
                                                        addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock });
                                                    }}
                                                    onUpdateQuantity={(qty) => updateQuantity(product.id, qty)}
                                                    isPublic={!user || !isBuyer}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center bg-muted/20 border-2 border-dashed border-border rounded-xl">
                                        <p className="text-muted-foreground">Toko ini belum memiliki produk.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-8 text-center text-destructive">Toko tidak ditemukan</div>
            )}
            </div>
        </div>
    );
}
