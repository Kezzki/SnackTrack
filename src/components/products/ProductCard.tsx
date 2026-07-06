import { Star, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/product";

interface ProductCardProps {
    product: Product;
    index: number;
    onQuickView?: (product: Product) => void;
    viewMode?: "grid" | "list";
}

export function ProductCard({ product, index, onQuickView, viewMode = "grid" }: ProductCardProps) {
    const isLowStock = product.stock < 30;

    if (viewMode === "list") {
        return (
            <div
                className="group flex flex-row overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 animate-fade-in cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => onQuickView?.(product)}
            >
                <div className="w-32 sm:w-48 shrink-0 overflow-hidden bg-muted relative">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    <Badge className="absolute top-2 left-2 bg-background/90 text-[10px]">{product.category}</Badge>
                </div>
                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-sm sm:text-lg group-hover:text-primary transition-colors">{product.name}</h3>
                        <span className="text-sm sm:text-lg font-bold text-primary">{formatCurrency(product.price)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
                    <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <span className="text-xs sm:text-sm">{product.rating}</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">• {product.soldCount.toLocaleString()} terjual</span>
                        </div>
                        <div className={cn("flex items-center gap-1 text-xs", isLowStock ? "text-warning" : "text-muted-foreground")}>
                            <Package className="h-4 w-4" />
                            <span>{product.stock} stok</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="relative aspect-square overflow-hidden bg-muted">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Button size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); onQuickView?.(product); }}>
                    Quick View
                </Button>
                <Badge className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 text-foreground hover:bg-background/90 text-[10px] sm:text-xs">{product.category}</Badge>
                {isLowStock && <Badge className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-warning/90 text-warning-foreground hover:bg-warning/90 text-[10px] sm:text-xs">Ulas Stok</Badge>}
            </div>

            <div className="p-2.5 sm:p-4">
                <h3 className="font-semibold text-foreground text-xs sm:text-base line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
                <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-2">{product.description}</p>
                <div className="flex items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-warning text-warning" />
                    <span className="text-[10px] sm:text-sm font-medium">{product.rating}</span>
                    <span className="text-muted-foreground text-[10px] sm:text-sm">•</span>
                    <span className="text-[10px] sm:text-sm text-muted-foreground">{product.soldCount.toLocaleString()} terjual</span>
                </div>
                <div className="flex items-center justify-between mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-border">
                    <span className="text-sm sm:text-lg font-bold text-primary">{formatCurrency(product.price)}</span>
                    <div className={cn("flex items-center gap-1 text-[9px] sm:text-xs", isLowStock ? "text-warning" : "text-muted-foreground")}>
                        <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{product.stock} stok</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
