import { useState, useRef, useEffect } from "react";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TutorialOverlayProps {
    targetRef: React.RefObject<HTMLDivElement>;
    onDismiss: () => void;
}

export function TutorialOverlay({ targetRef, onDismiss }: TutorialOverlayProps) {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [placement, setPlacement] = useState<"bottom" | "top" | "right">("bottom");

    useEffect(() => {
        function update() {
            if (targetRef.current) {
                setRect(targetRef.current.getBoundingClientRect());
            }
        }
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [targetRef]);

    useEffect(() => {
        if (!rect || !tooltipRef.current) return;
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const gap = 24;
        const padding = 8;

        const spaceBelow = window.innerHeight - (rect.bottom + padding + gap);
        const spaceAbove = rect.top - padding - gap;
        const spaceRight = window.innerWidth - (rect.right + padding + gap);

        if (spaceBelow >= tooltipRect.height) {
            setPlacement("bottom");
        } else if (spaceRight >= tooltipRect.width) {
            setPlacement("right");
        } else if (spaceAbove >= tooltipRect.height) {
            setPlacement("top");
        } else {
            const max = Math.max(spaceBelow, spaceRight, spaceAbove);
            if (max === spaceRight) setPlacement("right");
            else if (max === spaceAbove) setPlacement("top");
            else setPlacement("bottom");
        }
    }, [rect]);

    if (!rect) return null;

    const padding = 8;
    const gap = 24;

    const getTooltipStyle = (): React.CSSProperties => {
        switch (placement) {
            case "bottom":
                return { left: rect.left + rect.width / 2, top: rect.bottom + padding + gap, transform: "translateX(-50%)" };
            case "top":
                return { left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + padding + gap, transform: "translateX(-50%)" };
            case "right":
                return { left: rect.right + padding + gap, top: rect.top + rect.height / 2, transform: "translateY(-50%)" };
        }
    };

    const getArrowClass = (): string => {
        switch (placement) {
            case "bottom": return "w-4 h-4 bg-card rotate-45 -mb-2 border-l border-t border-border mx-auto";
            case "top": return "w-4 h-4 bg-card rotate-45 -mt-2 border-r border-b border-border mx-auto order-last";
            case "right": return "w-4 h-4 bg-card rotate-45 -ml-2 border-b border-l border-border self-center order-first";
        }
    };

    const arrowClass = getArrowClass();

    return (
        <div className="fixed inset-0 z-[100]" onClick={onDismiss}>
            {/* Dark overlay with cutout */}
            <div className="absolute inset-0">
                <svg width="100%" height="100%" className="block">
                    <defs>
                        <mask id="tutorial-mask">
                            <rect width="100%" height="100%" fill="white" />
                            <rect
                                x={rect.left - padding} y={rect.top - padding}
                                width={rect.width + padding * 2} height={rect.height + padding * 2}
                                rx="16" fill="black"
                            />
                        </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tutorial-mask)" />
                </svg>
            </div>

            {/* Highlight border */}
            <div
                className="absolute rounded-2xl ring-4 ring-primary ring-offset-2 pointer-events-none animate-pulse"
                style={{ left: rect.left - padding, top: rect.top - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }}
            />

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={cn(
                    "absolute z-[101] flex",
                    placement === "right" ? "flex-row items-center" : "flex-col items-center"
                )}
                style={getTooltipStyle()}
                onClick={(e) => e.stopPropagation()}
            >
                {placement !== "right" && <div className={arrowClass} />}
                <div className="flex items-center">
                    {placement === "right" && <div className={arrowClass} />}
                    <div className="bg-card border border-border rounded-xl shadow-warm-lg px-6 py-4 max-w-xs text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">
                            Yuk belanja dan tambahkan item ke keranjang!
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                            Arahkan kursor ke produk dan klik tombol <strong>"Tambah"</strong> untuk menambahkan ke keranjang.
                        </p>
                        <Button size="sm" onClick={onDismiss} className="w-full">
                            Okay
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
