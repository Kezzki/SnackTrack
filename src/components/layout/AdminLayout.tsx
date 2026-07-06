import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Users, DollarSign, Bell, Cookie, LogOut, ShieldCheck, Menu, X, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const adminNavItems = [
    { title: "Manajemen Pengguna", url: "/admin/users", icon: Users },
    { title: "Keuangan", url: "/admin/finance", icon: DollarSign },
    { title: "Notifikasi Siaran", url: "/admin/notifications", icon: Bell },
    { title: "Import Data", url: "/admin/import-data", icon: UploadCloud },
];

function SidebarContent({ onNavClick, onSignOut }: { onNavClick?: () => void; onSignOut: () => void }) {
    return (
        <>
            {/* Header */}
            <div className="flex h-16 items-center gap-2 px-4 border-b border-white/10">
                <Cookie className="h-5 w-5 text-white" />
                <span className="font-bold text-lg text-white">SnackTrack</span>
            </div>
            <div className="px-4 py-2 mb-4">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1 w-fit">
                    <ShieldCheck className="h-3 w-3 text-white/80" />
                    <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">Admin</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-3 flex-1">
                {adminNavItems.map((item) => (
                    <NavLink
                        key={item.url}
                        to={item.url}
                        onClick={onNavClick}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                                isActive
                                    ? "bg-white/15 text-white shadow-sm"
                                    : "text-white/75 hover:bg-white/10 hover:text-white"
                            )
                        }
                    >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.title}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Sign out */}
            <div className="p-3 border-t border-white/10">
                <Button
                    variant="ghost"
                    onClick={onSignOut}
                    className="w-full justify-start text-white/75 hover:bg-white/10 hover:text-white gap-3 text-sm"
                >
                    <LogOut className="h-4 w-4" />
                    Keluar
                </Button>
            </div>
        </>
    );
}

export function AdminLayout() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate("/auth");
    };

    return (
        <div className="min-h-screen bg-muted/30 flex">
            {/* Desktop sidebar */}
            <aside className="hidden md:fixed md:flex md:flex-col md:left-0 md:top-0 md:z-40 md:h-screen md:w-60 gradient-primary">
                <SidebarContent onSignOut={handleSignOut} />
            </aside>

            {/* Mobile drawer overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="absolute left-0 top-0 h-full w-64 gradient-primary flex flex-col">
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute top-3 right-3 text-white/70 hover:text-white p-1"
                            aria-label="Tutup menu"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <SidebarContent
                            onNavClick={() => setMobileOpen(false)}
                            onSignOut={handleSignOut}
                        />
                    </aside>
                </div>
            )}

            {/* Mobile top header */}
            <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 gradient-primary flex items-center px-4 gap-3 border-b border-white/10">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="text-white/80 hover:text-white p-1 -ml-1"
                    aria-label="Buka menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <Cookie className="h-4 w-4 text-white flex-shrink-0" />
                <span className="font-bold text-white text-sm">SnackTrack</span>
                <div className="ml-auto flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-0.5">
                    <ShieldCheck className="h-3 w-3 text-white/80" />
                    <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">Admin</span>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 min-w-0 md:pl-60 pt-14 md:pt-0">
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
