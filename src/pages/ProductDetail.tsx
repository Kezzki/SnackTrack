import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Store, MapPin, ShoppingCart, Minus, Plus, MessageSquare, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useChat } from "@/contexts/ChatContext";
import { BuyerProductCard } from "@/components/buyer/BuyerProductCard";
import { CartSheet } from "@/components/buyer/CartSheet";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { BuyerProduct } from "@/types/product";

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { cart, addToCart, updateQuantity, totalItems } = useCart();
    const { user, activeRole } = useAuth();
    const { collapsed } = useSidebar();
    const { openChat } = useChat();

    const [mainImage, setMainImage] = useState<string>("");
    const [cartOpen, setCartOpen] = useState(false);

    const cartItem = cart.find((item) => item.productId === id);
    const cartQuantity = cartItem?.quantity || 0;

    const { data: queryData, isLoading } = useQuery({
        queryKey: ['product-detail', id],
        queryFn: async () => {
            if (!id) return null;
            const result = { product: null as BuyerProduct | null, recommendations: [] as BuyerProduct[] };
            
            const { data, error, status } = await supabase
                .from('products')
                .select('*, store:stores(id, name, address, image_url, rating, seller_id)')
                .eq('id', id)
                .single();

            if (error) {
                console.error("Fetch error:", error.message, status);
            }

            if (!error && data) {
                result.product = {
                    id: data.id,
                    name: data.name,
                    category: data.category,
                    price: data.price,
                    stock: data.stock,
                    soldCount: data.sold_count || 0,
                    image: data.image_url || 'https://via.placeholder.com/400',
                    images: data.images || [], 
                    description: data.description,
                    rating: data.rating || 0,
                    storeName: data.store ? data.store.name : "Toko Tidak Diketahui",
                    storeId: data.store?.id,
                    sellerId: data.store?.seller_id,
                    storeRating: data.store?.rating || null,
                    storeAvatar: data.store?.image_url,
                };

                // Fetch recommendations
                const { data: recData } = await supabase
                    .from('products')
                    .select('*, store:stores(name)')
                    .eq('is_active', true)
                    .eq('store_id', data.store_id)
                    .neq('id', id)
                    .limit(4);

                if (recData) {
                    result.recommendations = recData.map((p) => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        price: p.price,
                        stock: p.stock,
                        image: p.image_url || 'https://via.placeholder.com/400',
                        description: p.description,
                        rating: p.rating || 0,
                        storeName: p.store ? p.store.name : "Toko Tidak Diketahui"
                    }));
                }
            } else {
                const m = await import("@/data/mock-store-products");
                const mockP = m.mockStoreProducts.find(p => p.id === id); 
                if (mockP) {
                    result.product = mockP;
                    result.recommendations = m.mockStoreProducts.filter(p => p.id !== id).slice(0, 4);
                }
            }
            return result;
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const product = queryData?.product || null;
    const recommendations = queryData?.recommendations || [];

    const { data: reviewsData } = useQuery({
        queryKey: ['product-reviews', id],
        queryFn: async () => {
            if (!id) return [];
            // Step 1: fetch reviews (no embedded join — reviews.buyer_id → auth.users, not profiles)
            const { data: rows, error } = await supabase
                .from('reviews')
                .select('id, rating, comment, created_at, buyer_id')
                .eq('product_id', id)
                .order('created_at', { ascending: false });
            if (error) { console.error('Reviews fetch error:', error); return []; }
            if (!rows || rows.length === 0) return [];

            // Step 2: fetch profiles for those buyer_ids
            const buyerIds = [...new Set(rows.map((r: any) => r.buyer_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', buyerIds);

            const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

            return rows.map((r: any) => ({
                ...r,
                buyer: profileMap[r.buyer_id] ?? null,
            }));
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });

    const reviews = reviewsData || [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
        ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviewCount) * 10) / 10
        : (product?.rating || 0);

    // Automatically set main image to the default image when data loads
    useEffect(() => {
        if (product && !mainImage) {
            setMainImage(product.image);
        }
    }, [product, mainImage]);

    // Keep scroll restoration
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-4 flex items-center justify-center">
                Memuat produk...
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
                <h2 className="text-xl font-bold mb-4">Produk tidak ditemukan</h2>
                <Button onClick={() => navigate(-1)} variant="outline">Kembali</Button>
            </div>
        );
    }

    const allImages = product.images && product.images.length > 0 ? product.images : [product.image];
    const isBuyer = activeRole === "pembeli";

    return (
        <div className="min-h-screen bg-background relative">
            {user && <AppSidebar />}

            <CartSheet
                open={cartOpen}
                onOpenChange={setCartOpen}
                items={cart}
                onUpdateQuantity={updateQuantity}
            />

            <div className={cn("min-h-screen pb-28 md:pb-8 transition-all duration-300", user && (collapsed ? "md:pl-16" : "md:pl-60"))}>
                <div className="container max-w-5xl mx-auto px-4 py-4 md:py-8">
                {/* Back button */}
                <Button variant="ghost" className="mb-3 pl-0 h-8 text-sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12">
                    {/* Gallery */}
                    <div className="flex flex-col gap-3">
                        <div className="w-full aspect-square rounded-2xl overflow-hidden border border-border bg-muted">
                            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        {allImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setMainImage(img)}
                                        className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${mainImage === img ? "border-primary" : "border-border hover:border-primary/50"}`}
                                    >
                                        <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-col">
                        <div className="flex items-start gap-2 mb-1">
                            <Badge className="shrink-0">{product.category}</Badge>
                        </div>
                        <h1 className="text-xl md:text-3xl font-bold text-foreground mb-1 leading-tight">{product.name}</h1>
                        
                        <div className="flex items-center gap-3 mb-3 text-sm">
                            <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-warning text-warning" />
                                <span className="font-semibold">{avgRating > 0 ? avgRating : "—"}</span>
                                <span className="text-muted-foreground">({reviewCount})</span>
                            </div>
                            {(product as any).soldCount > 0 && (
                                <span className="text-muted-foreground">· Terjual {(product as any).soldCount}+</span>
                            )}
                        </div>

                        <div className="text-2xl md:text-4xl font-bold text-primary mb-4">
                            {formatCurrency(product.price)}
                        </div>

                        <Separator className="mb-4" />

                        {/* Store Profile — compact horizontal card */}
                        <div 
                            onClick={() => product.storeId && navigate(`/toko/profil/${product.storeId}`)}
                            className="flex items-center gap-3 mb-4 bg-muted/30 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <img src={product.storeAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.storeName)}&background=random`} alt={product.storeName} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate flex items-center gap-1">
                                    <Store className="h-3.5 w-3.5 text-primary shrink-0" /> {product.storeName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    {product.storeRating ? (
                                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" /> {product.storeRating}</span>
                                    ) : (
                                        <span>Belum ada ulasan</span>
                                    )}
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs" onClick={(e) => {
                                e.stopPropagation();
                                if (product.storeId) navigate(`/toko/profil/${product.storeId}`);
                            }}>Kunjungi</Button>
                        </div>

                        <div className="mb-4">
                            <h3 className="font-semibold text-base mb-1.5">Deskripsi</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {product.description || "Tidak ada deskripsi."}
                            </p>
                        </div>

                        {/* Stock info + desktop actions */}
                        <div className="hidden md:block mt-auto space-y-4 max-w-md w-full">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Sisa Stok:</span>
                                <span className="font-semibold">{product.stock} barang</span>
                            </div>
                            {cartQuantity > 0 ? (
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex items-center justify-between border border-border rounded-lg p-1 flex-1 h-12">
                                        <Button variant="ghost" size="icon" className="h-full w-10" onClick={() => updateQuantity(product.id, cartQuantity - 1)}><Minus className="h-4 w-4" /></Button>
                                        <span className="font-semibold text-lg">{cartQuantity}</span>
                                        <Button variant="ghost" size="icon" className="h-full w-10 disabled:opacity-50" onClick={() => updateQuantity(product.id, cartQuantity + 1)} disabled={cartQuantity >= product.stock}><Plus className="h-4 w-4" /></Button>
                                    </div>
                                    <Button className="flex-1 h-12" onClick={() => navigate('/transaksi')}>Beli Sekarang</Button>
                                </div>
                            ) : (
                                <div className="flex gap-3 w-full">
                                    <Button variant="outline" className="flex-1 h-12 border-primary text-primary hover:bg-primary/10" onClick={() => addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock })}>
                                        <ShoppingCart className="h-4 w-4 mr-2" /> Keranjang
                                    </Button>
                                    <Button className="flex-1 h-12" onClick={() => { addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock }); navigate('/transaksi'); }}>
                                        Beli Sekarang
                                    </Button>
                                    {isBuyer && product.sellerId && product.storeId && (
                                        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" title="Chat penjual"
                                            onClick={() => openChat({ storeId: product.storeId!, storeName: product.storeName, storeAvatar: product.storeAvatar, sellerId: product.sellerId!, productId: product.id, productName: product.name, productImage: product.image, isProductInquiry: true })}>
                                            <MessageCircle className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Separator className="my-6" />

                {/* Reviews */}
                <div className="mb-6">
                    <h2 className="text-lg md:text-2xl font-bold mb-4 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Ulasan
                        {reviewCount > 0 && <span className="text-sm font-normal text-muted-foreground">({reviewCount})</span>}
                    </h2>
                    {reviewCount === 0 ? (
                        <div className="text-center py-10 px-4 rounded-xl border-2 border-dashed border-border bg-muted/20">
                            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-40" />
                            <p className="text-muted-foreground">Belum ada ulasan untuk produk ini.</p>
                        </div>
                    ) : (
                        <>
                            {/* Rating summary */}
                            <div className="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-xl border border-border">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-foreground">{avgRating}</div>
                                    <div className="flex justify-center gap-0.5 mt-1">
                                        {[1,2,3,4,5].map(s => (
                                            <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                                        ))}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{reviewCount} ulasan</div>
                                </div>
                                <Separator orientation="vertical" className="h-16 mx-2" />
                                <div className="flex-1 space-y-1">
                                    {[5,4,3,2,1].map(star => {
                                        const count = reviews.filter((r: any) => r.rating === star).length;
                                        const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                                        return (
                                            <div key={star} className="flex items-center gap-2 text-xs">
                                                <span className="w-2 text-muted-foreground text-right">{star}</span>
                                                <Star className="h-3 w-3 fill-warning text-warning flex-shrink-0" />
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="w-6 text-muted-foreground">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Individual reviews */}
                            <div className="space-y-4">
                                {reviews.map((review: any) => (
                                    <div key={review.id} className="p-4 rounded-xl border border-border bg-muted/10">
                                        <div className="flex items-start gap-3">
                                            <img
                                                src={(review.buyer as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((review.buyer as any)?.name || 'P')}&background=random`}
                                                alt={(review.buyer as any)?.name || 'Pembeli'}
                                                className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium text-sm truncate">{(review.buyer as any)?.name || 'Pembeli'}</span>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                                        {new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="flex gap-0.5 mt-0.5 mb-2">
                                                    {[1,2,3,4,5].map(s => (
                                                        <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                                                    ))}
                                                </div>
                                                {review.comment && (
                                                    <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Recommendations */}
                <div className="mb-6">
                    <h2 className="text-lg md:text-2xl font-bold mb-4">Mungkin Anda Suka</h2>
                    {recommendations.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            {recommendations.map((rec, idx) => {
                                const rCartItem = cart.find(c => c.productId === rec.id);
                                return (
                                <BuyerProductCard
                                    key={rec.id}
                                    product={rec}
                                    index={idx}
                                    cartQuantity={rCartItem?.quantity || 0}
                                    onAddToCart={() => addToCart({ productId: rec.id, name: rec.name, price: rec.price, image: rec.image, stock: rec.stock })}
                                    onUpdateQuantity={(qty) => {
                                        updateQuantity(rec.id, qty);
                                    }}
                                />
                            )})}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-border bg-muted/20">
                            <Store className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                            <h3 className="font-semibold text-foreground mb-1">Belum ada produk lain</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Toko ini masih belum memiliki produk lain untuk direkomendasikan saat ini.</p>
                        </div>
                    )}
                </div>
            </div>
            </div>

            {/* Mobile sticky bottom CTA */}
            {isBuyer && (
                <div className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">{product.name}</p>
                            <p className="text-sm font-bold text-primary">{formatCurrency(product.price)}</p>
                        </div>
                        {cartQuantity > 0 ? (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                                    <button className="h-9 w-9 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => updateQuantity(product.id, cartQuantity - 1)}><Minus className="h-3.5 w-3.5" /></button>
                                    <span className="w-8 text-center text-sm font-semibold">{cartQuantity}</span>
                                    <button className="h-9 w-9 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40" onClick={() => updateQuantity(product.id, cartQuantity + 1)} disabled={cartQuantity >= product.stock}><Plus className="h-3.5 w-3.5" /></button>
                                </div>
                                <Button size="sm" className="h-9 px-4" onClick={() => navigate('/transaksi')}>Beli</Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {product.sellerId && product.storeId && (
                                    <button className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                                        onClick={() => openChat({ storeId: product.storeId!, storeName: product.storeName, storeAvatar: product.storeAvatar, sellerId: product.sellerId!, productId: product.id, productName: product.name, productImage: product.image, isProductInquiry: true })}>
                                        <MessageCircle className="h-4 w-4" />
                                    </button>
                                )}
                                <Button variant="outline" size="sm" className="h-9 border-primary text-primary hover:bg-primary/10"
                                    onClick={() => addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock })}>
                                    <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Keranjang
                                </Button>
                                <Button size="sm" className="h-9 px-4"
                                    onClick={() => { addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock }); navigate('/transaksi'); }}>
                                    Beli
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}