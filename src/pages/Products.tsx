import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Loader2, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductQuickViewModal } from "@/components/products/ProductQuickViewModal";
import type { Product } from "@/types/product";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSellerStore } from "@/hooks/useSellerStore";

const DEFAULT_CATEGORIES = ["Chips", "Cookies", "Popcorn", "Nuts", "Candy"];
const ITEMS_PER_PAGE = 30;

export default function Products() {
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("popular");
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    const [isAddMode, setIsAddMode] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [currentPage, setCurrentPage] = useState(1);

    const { user } = useAuth();
    const { toast } = useToast();
    const { data: sellerStore } = useSellerStore();
    const storeId = sellerStore?.id ?? null;
    const queryClient = useQueryClient();

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['seller-products-list', storeId],
        queryFn: async () => {
            const { data: productsData, error } = await supabase
                .from('products')
                .select('id, name, category, description, price, stock, image_url, store_id, rating, sold_count')
                .eq('store_id', storeId!)
                .eq('is_active', true);

            if (error) {
                console.error("Error fetching products:", error);
                return [] as Product[];
            }

            return (productsData || []).map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                price: p.price,
                stock: p.stock,
                image: p.image_url || (p as any).image || null,
                description: p.description,
                rating: p.rating || 0,
                soldCount: p.sold_count || 0,
                store_id: p.store_id,
            })) as Product[];
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5,
    });

    // Dynamically derive categories from defaults + existing product categories
    const sellerCategories = useMemo(() => {
        const productCats = products.map(p => p.category).filter(Boolean);
        const unique = Array.from(new Set([...DEFAULT_CATEGORIES, ...productCats]));
        return ["All", ...unique];
    }, [products]);

    const filtered = useMemo(() => {
        let list = products.filter((p) => {
            const needle = search.trim().toLowerCase();
            const matchSearch = p.name.toLowerCase().includes(needle) || (p.description || "").toLowerCase().includes(needle);
            const matchCategory = selectedCategory === "All" || p.category === selectedCategory;
            return matchSearch && matchCategory;
        });

        switch (sortBy) {
            case "rating": list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
            case "price-low": list.sort((a, b) => a.price - b.price); break;
            case "price-high": list.sort((a, b) => b.price - a.price); break;
            default: list.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
        }
        return list;
    }, [products, search, selectedCategory, sortBy]);

    // Reset page on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedCategory, sortBy]);

    const currentProducts = filtered.slice(0, currentPage * ITEMS_PER_PAGE);

    const handleDeleteProduct = async (productId: string) => {
        if (!storeId) return;

        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', productId)
                .eq('store_id', storeId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['seller-products-list', storeId] });
            queryClient.invalidateQueries({ queryKey: ['buyer-products'] });
            toast({ title: "Berhasil", description: "Produk berhasil dihapus" });
            setQuickViewProduct(null);
        } catch (error) {
            console.error("Error deleting product:", error);
            toast({ title: "Error", description: "Gagal menghapus produk", variant: "destructive" });
        }
    };

    const handleSaveProduct = async (updated: Product) => {

        if (!storeId) return;

        try {
            const productPayload = {
                name: updated.name,
                category: updated.category,
                price: updated.price,
                stock: updated.stock,
                description: updated.description,
                image_url: updated.image,
                store_id: storeId
            };

            if (isAddMode) {
                const { data, error } = await supabase
                    .from('products')
                    .insert(productPayload)
                    .select()
                    .single();

                if (error) throw error;
                
                if (data) {
                    toast({ title: "Berhasil", description: "Produk berhasil ditambahkan" });
                    queryClient.invalidateQueries({ queryKey: ['seller-products-list', storeId] });
                    queryClient.invalidateQueries({ queryKey: ['buyer-products'] });
                }
            } else {
                const { data, error } = await supabase
                    .from('products')
                    .update(productPayload)
                    .eq('id', updated.id)
                    .select()
                    .single();

                if (error) throw error;
                
                if (data) {
                    toast({ title: "Berhasil", description: "Produk berhasil diperbarui" });
                    queryClient.invalidateQueries({ queryKey: ['seller-products-list', storeId] });
                    queryClient.invalidateQueries({ queryKey: ['buyer-products'] });
                }
            }
        } catch (error) {
            console.error("Error saving product:", error);
            toast({ title: "Error", description: "Gagal menyimpan produk", variant: "destructive" });
        }
        setIsAddMode(false);
    };

    const handleAddProductClick = () => {
        setIsAddMode(true);
        // @ts-ignore
        setQuickViewProduct({
            id: "", name: "", category: "", price: 0, stock: 0, image: "", description: ""
        });
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-3 sm:-mx-6 px-3 sm:px-6 pb-3 sm:pb-4 pt-1 sm:pt-2 border-b border-border mb-3 sm:mb-6">
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground">Produk</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{filtered.length} produk ditemukan</p>
                    </div>
                    <Button onClick={handleAddProductClick} size="sm" className="w-full xs:w-auto">
                        <Plus className="h-4 w-4 mr-2" /> <span className="xs:hidden">Tambah</span><span className="hidden xs:inline">Tambah Produk</span>
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
                        <Input placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} className="pl-10" />
                    </div>
                    <ProductFilters categories={sellerCategories} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} sortBy={sortBy} onSortChange={setSortBy} />
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Memuat produk...</p>
                </div>
            ) : filtered.length > 0 ? (
                <>
                    <div className={cn(
                        viewMode === "grid" 
                            ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-6"
                            : "flex flex-col gap-3 sm:gap-4"
                    )}>
                        {currentProducts.map((product, i) => (
                            <ProductCard key={product.id} product={product} index={i} onQuickView={setQuickViewProduct} viewMode={viewMode} />
                        ))}
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
                <div className="text-center py-16">
                    <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
                </div>
            )}

            <ProductQuickViewModal product={quickViewProduct} open={!!quickViewProduct} onOpenChange={(open) => { if (!open) { setQuickViewProduct(null); setIsAddMode(false); } }} onSave={handleSaveProduct} onDelete={handleDeleteProduct} categories={sellerCategories} />
        </div>
    );
}
