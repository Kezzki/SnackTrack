import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CategoryPickerModalProps {
    categories: string[];
    selected: string;
    onSelect: (cat: string) => void;
    open: boolean;
    onClose: () => void;
}

export function CategoryPickerModal({
    categories,
    selected,
    onSelect,
    open,
    onClose,
}: CategoryPickerModalProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const [centeredIndex, setCenteredIndex] = useState(
        categories.indexOf(selected)
    );

    // Scroll to the selected item when opening
    useEffect(() => {
        if (open && listRef.current) {
            const idx = categories.indexOf(selected);
            // child[0] is the top spacer, so the category at idx is child[idx + 1]
            const item = listRef.current.children[idx + 1] as HTMLElement | undefined;
            if (item) {
                item.scrollIntoView({ block: "center", behavior: "instant" });
            }
            setCenteredIndex(idx);
        }
    }, [open, selected, categories]);

    // Track which item is closest to center on scroll
    const handleScroll = useCallback(() => {
        if (!listRef.current) return;
        const container = listRef.current;
        const containerRect = container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        let closestIdx = 0;
        let closestDist = Infinity;

        Array.from(container.children).forEach((child) => {
            const el = child as HTMLElement;
            const catIdx = el.dataset.catIndex;
            if (catIdx === undefined) return; // skip spacers
            const rect = el.getBoundingClientRect();
            const childCenter = rect.top + rect.height / 2;
            const dist = Math.abs(childCenter - centerY);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = parseInt(catIdx, 10);
            }
        });

        setCenteredIndex(closestIdx);
    }, []);

    const handleSelect = (cat: string) => {
        onSelect(cat);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Picker — no card background, just floating content */}
            <div className="relative z-10 w-[85%] max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Center highlight zone */}
                <div className="relative h-64">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-white/10 rounded-lg border-y border-white/20 pointer-events-none z-10" />

                    {/* Scrollable list */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        className="overflow-y-auto h-full snap-y snap-mandatory"
                        style={{ scrollbarWidth: "none" }}
                    >
                        {/* Top spacer — pushes first item to center */}
                        <div className="h-[calc(50%-24px)]" aria-hidden />

                        {categories.map((cat, i) => {
                            const isCentered = i === centeredIndex;
                            return (
                                <button
                                    key={cat}
                                    data-cat-index={i}
                                    onClick={() => handleSelect(cat)}
                                    className={cn(
                                        "w-full py-3 px-4 text-center transition-all duration-200 snap-center",
                                        isCentered
                                            ? "text-lg font-bold text-white scale-110"
                                            : "text-sm font-medium text-white/40"
                                    )}
                                >
                                    {cat}
                                </button>
                            );
                        })}

                        {/* Bottom spacer — pushes last item to center */}
                        <div className="h-[calc(50%-24px)]" aria-hidden />
                    </div>
                </div>
            </div>
        </div>
    );
}
