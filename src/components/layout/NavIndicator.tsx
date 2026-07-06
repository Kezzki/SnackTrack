import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "snacktrack_nav_index";

interface NavIndicatorProps {
    navItems: { url: string }[];
    pathname: string;
    collapsed?: boolean;
}

export function NavIndicator({ navItems, pathname, collapsed }: NavIndicatorProps) {
    const activeIndex = navItems.findIndex((item) => pathname === item.url);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    const updatePosition = useCallback(() => {
        if (activeIndex === -1 || !indicatorRef.current) return;

        const el = indicatorRef.current;
        const nav = el.parentElement;
        if (!nav) return;

        // Find the actual nav link for the active item
        const navLinks = nav.querySelectorAll<HTMLElement>("[data-nav-item]");
        const activeLink = navLinks[activeIndex];
        if (!activeLink) return;

        const navRect = nav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();

        const top = linkRect.top - navRect.top;
        const height = linkRect.height;

        el.style.top = `${top}px`;
        el.style.height = `${height}px`;

        localStorage.setItem(STORAGE_KEY, String(activeIndex));
        setReady(true);
    }, [activeIndex]);

    useEffect(() => {
        // Wait for sidebar collapse/expand transition (300ms) to finish before measuring
        const timer = setTimeout(updatePosition, 350);
        return () => clearTimeout(timer);
    }, [updatePosition, collapsed]);

    // Also recalculate on window resize
    useEffect(() => {
        window.addEventListener("resize", updatePosition);
        return () => window.removeEventListener("resize", updatePosition);
    }, [updatePosition]);

    if (activeIndex === -1) return null;

    return (
        <div
            ref={indicatorRef}
            className={cn(
                "absolute left-0 right-0 rounded-lg bg-primary-foreground shadow-sm pointer-events-none transition-all duration-300"
            )}
            style={{
                opacity: ready ? 1 : 0,
            }}
        />
    );
}
