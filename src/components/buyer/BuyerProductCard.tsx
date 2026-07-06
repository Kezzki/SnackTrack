import { useNavigate } from "react-router-dom";
import { Star, ShoppingCart, Store, Plus, Minus, Trash2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { BuyerProduct } from "@/types/product";

interface BuyerProductCardProps {
    product: BuyerProduct;
    index: number;
    cartQuantity: number;
    onAddToCart: () => void;
    onUpdateQuantity: (quantity: number) => void;
    isPublic?: boolean;
    viewMode?: "grid" | "list";
}

export function BuyerProductCard({ product, index, cartQuantity, onAddToCart, onUpdateQuantity, isPublic, viewMode = "grid" }: BuyerProductCardProps) {
    const navigate = useNavigate();
    const inCart = cartQuantity > 0;
    const atStockLimit = cartQuantity >= product.stock;

    if (viewMode === "list") {
        return (
            <div
                className="group flex flex-row h-full overflow-hidden rounded-lg sm:rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 animate-fade-in cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/produk/${product.id}`)}
            >
                {/* Image */}
                <div className="w-24 sm:w-32 md:w-48 shrink-0 relative overflow-hidden bg-muted">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    <Badge className="absolute top-2 left-2 bg-background/90 text-[10px]">{product.category}</Badge>
                </div>
                {/* Content */}
                <div className="flex-1 p-2 sm:p-3 flex flex-col justify-center relative">
                    <div className="flex justify-between items-start gap-1 mb-1">
                        <h3 className="font-semibold text-xs sm:text-sm md:text-lg group-hover:text-primary transition-colors min-w-0">{product.name}</h3>
                        <span className="text-xs sm:text-base md:text-lg font-bold text-primary whitespace-nowrap flex-shrink-0">{formatCurrency(product.price)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
                    <div className="hidden sm:flex items-center gap-2 mb-2">
                        <Store className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{product.storeName}</span>
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-warning text-warning" />
                            <span className="text-xs sm:text-sm font-medium">{product.rating}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground mr-2">Stok: {product.stock}</span>
                            
                            {/* Action Buttons */}
                            {isPublic ? (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate("/auth"); }}>
                                    <LogIn className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Masuk</span>
                                </Button>
                            ) : inCart ? (
                                <div className="flex items-center gap-1 bg-primary rounded-full px-1 py-1 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full text-primary-foreground hover:bg-primary-foreground/20" onClick={() => onUpdateQuantity(cartQuantity - 1)}>
                                        {cartQuantity === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    </Button>
                                    <span className="text-xs sm:text-sm font-bold text-primary-foreground min-w-[20px] text-center">{cartQuantity}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full text-primary-foreground hover:bg-primary-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => onUpdateQuantity(cartQuantity + 1)} disabled={atStockLimit}>
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); onAddToCart(); }}>
                                    <ShoppingCart className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Tambah</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="group relative flex flex-col h-full overflow-hidden rounded-lg sm:rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 animate-fade-in cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate(`/produk/${product.id}`)}
        >
            {/* Image */}
            <div className="relative aspect-square overflow-hidden bg-muted">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Public: Login button on hover */}
                {isPublic ? (
                    <Button
                        size="sm"
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"
                        onClick={(e) => { e.stopPropagation(); navigate("/auth"); }}
                    >
                        <LogIn className="h-4 w-4 mr-1" /> Masuk
                    </Button>
                ) : inCart ? (
                    <div
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 bg-primary rounded-full px-1 py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-primary-foreground hover:bg-primary-foreground/20" onClick={() => onUpdateQuantity(cartQuantity - 1)}>
                            {cartQuantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        </Button>
                        <span className="text-sm font-bold text-primary-foreground min-w-[24px] text-center">{cartQuantity}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-primary-foreground hover:bg-primary-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => onUpdateQuantity(cartQuantity + 1)} disabled={atStockLimit}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ) : (
                    <Button size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300" onClick={(e) => { e.stopPropagation(); onAddToCart(); }}>
                        <ShoppingCart className="h-4 w-4 mr-1" /> Tambah
                    </Button>
                )}

                <Badge className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 text-foreground hover:bg-background/90 text-[10px] sm:text-xs">{product.category}</Badge>
                {!isPublic && inCart && <Badge className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-primary text-primary-foreground hover:bg-primary text-[10px] sm:text-xs">{cartQuantity}</Badge>}
            </div>

            {/* Content */}
            <div className="p-2.5 sm:p-4 flex flex-col flex-grow">
                <h3 className="font-semibold text-foreground text-xs sm:text-base line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
                <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-2">{product.description}</p>
                <div className="hidden sm:flex items-center gap-2 mt-2">
                    <Store className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{product.storeName}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2 mb-2 sm:mb-4">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-warning text-warning" />
                    <span className="text-[10px] sm:text-sm font-medium">{product.rating}</span>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3 border-t border-border">
                    <span className="text-sm sm:text-lg font-bold text-primary">{formatCurrency(product.price)}</span>
                    <span className="text-[9px] sm:text-xs text-muted-foreground">Stok: {product.stock}</span>
                </div>
            </div>
        </div>
    );
}
