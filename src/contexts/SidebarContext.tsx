import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarContextValue {
    collapsed: boolean;
    toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    collapsed: false,
    toggle: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem("snacktrack_sidebar_collapsed") === "true";
    });

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("snacktrack_sidebar_collapsed", String(next));
            return next;
        });
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
