import { useState } from "react";
import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useSidebar } from "@/contexts/SidebarContext";
import {
    LayoutDashboard, Package, ShoppingCart, TrendingUp,
    LogOut, ChevronLeft, Menu, Cookie, User, Store, ShoppingBag,
    AlertCircle, Settings, ChevronUp, Bell, Users, Check, Plus, MessageCircle, Wallet,
    MoreHorizontal, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
    DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNotification } from "@/contexts/NotificationContext";
import { NavIndicator } from "./NavIndicator";


const sellerNavItems = [
    { title: "Ringkasan", url: "/", icon: LayoutDashboard },
    { title: "Produk", url: "/products", icon: Package },
    { title: "Transaksi", url: "/orders", icon: ShoppingCart },
    { title: "Prediksi Penjualan", url: "/analytics", icon: TrendingUp },
    { title: "Saldo", url: "/balance", icon: Wallet },
    { title: "Pesan", url: "/pesan", icon: MessageCircle },
    { title: "Toko", url: "/store-settings", icon: Store },
];

/** Primary tabs shown in seller mobile bottom bar (max 4) */
const sellerMobilePrimaryItems = [
    { title: "Ringkasan", url: "/", icon: LayoutDashboard },
    { title: "Produk", url: "/products", icon: Package },
    { title: "Transaksi", url: "/orders", icon: ShoppingCart },
    { title: "Prediksi", url: "/analytics", icon: TrendingUp },
];

/** Secondary items shown inside the "Lainnya" drawer */
const sellerMobileSecondaryItems = [
    { title: "Saldo", url: "/balance", icon: Wallet },
    { title: "Pesan", url: "/pesan", icon: MessageCircle },
    { title: "Toko", url: "/store-settings", icon: Store },
    { title: "Notifikasi", url: "/notifikasi", icon: Bell },
    { title: "Pengaturan", url: "/settings", icon: Settings },
];

const buyerNavItems = [
    { title: "Shop", url: "/toko", icon: Store },
    { title: "Transaksi", url: "/transaksi", icon: ShoppingBag },
    { title: "Saldo", url: "/saldo", icon: Wallet },
    { title: "Pesan", url: "/pesan", icon: MessageCircle },
];

export function AppSidebar() {
    const { collapsed, toggle: toggleCollapsed } = useSidebar();
    const location = useLocation();
    const navigate = useNavigate();
    const { user, activeRole, userRoles, setActiveRole, switchToRole, signOut } = useAuth();
    const { totalItems } = useCart();
    const {
        buyerProfile,
        buyerProgress, sellerProgress,
        isBuyerOnboardingComplete, isSellerOnboardingComplete,
    } = useOnboarding();

    const { unreadCount } = useNotification();
    const [moreOpen, setMoreOpen] = useState(false);

    const isBuyer = activeRole === "pembeli";
    const navItems = isBuyer ? buyerNavItems : sellerNavItems;

    const onboardingProgress = isBuyer ? buyerProgress : sellerProgress;
    const onboardingComplete = isBuyer ? isBuyerOnboardingComplete : isSellerOnboardingComplete;
    const onboardingUrl = isBuyer ? "/onboarding/pembeli" : "/onboarding/penjual";

    const handleSignOut = async () => {
        setMoreOpen(false);
        await signOut();
        navigate("/auth");
    };

    const handleKeranjangClick = () => {
        if (totalItems === 0) {
            navigate("/toko?tutorial=cart");
        } else {
            navigate("/toko?openCart=1");
        }
    };

    /** Whether the current path matches one of the secondary "more" items */
    const isSecondaryActive = sellerMobileSecondaryItems.some(i => location.pathname === i.url);

    /** Total badge count for the "More" button (notifications) */
    const moreBadgeCount = unreadCount;

    return (
        <>
            {/* Desktop sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen gradient-primary hidden md:flex flex-col transition-all duration-300 ease-in-out",
                    collapsed ? "w-16" : "w-60"
                )}
            >
                {/* Header */}
                <div className="flex h-16 items-center justify-between px-4">
                    {!collapsed && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <Cookie className="h-5 w-5 text-white" />
                            <span className="font-bold text-lg text-white">SnackTrack</span>
                        </div>
                    )}
                    <Button
                        variant="ghost" size="icon" onClick={toggleCollapsed}
                        className={cn("h-8 w-8 text-white hover:bg-primary-foreground/10", collapsed && "mx-auto")}
                    >
                        {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                </div>

                {!collapsed && (
                    <p className="px-4 -mt-2 mb-4 text-xs text-white/70">
                        {isBuyer ? "Dashboard Pembeli" : "Dashboard Penjual"}
                    </p>
                )}

                {/* Navigation */}
                <nav className={cn("flex flex-col px-3 relative", collapsed ? "gap-2" : "gap-1")}>
                    <NavIndicator navItems={[...navItems, { url: "/notifikasi" }]} pathname={location.pathname} collapsed={collapsed} />

                    {navItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                            <NavLink
                                key={item.title} to={item.url}
                                data-nav-item
                                className={cn(
                                    "relative z-10 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                                    isActive ? "text-primary" : "text-white/80 hover:bg-primary-foreground/10",
                                    collapsed && "justify-center px-2"
                                )}
                            >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                        );
                    })}

                    {/* Keranjang — buyer only */}
                    {isBuyer && (
                        <button
                            onClick={handleKeranjangClick}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
                                "text-white/80 hover:bg-primary-foreground/10",
                                collapsed && "justify-center px-2"
                            )}
                        >
                            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                            {!collapsed && <span>Keranjang</span>}
                            {totalItems > 0 && (
                                <Badge className="absolute -top-1 right-1 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] bg-white text-primary">
                                    {totalItems}
                                </Badge>
                            )}
                        </button>
                    )}

                    {/* Notifications bell */}
                    <NavLink
                        to="/notifikasi"
                        data-nav-item
                        className={({ isActive }) => cn(
                            "relative z-10 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                            isActive ? "text-primary" : "text-white/80 hover:bg-primary-foreground/10",
                            collapsed && "justify-center px-2"
                        )}
                    >
                        <Bell className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>Notifikasi</span>}
                        {unreadCount > 0 && (
                            <Badge className="absolute -top-1 right-1 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] bg-red-500 text-white">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </Badge>
                        )}
                    </NavLink>
                </nav>

                {/* Onboarding progress banner */}
                {!onboardingComplete && (
                    <div className="px-3 mt-4">
                        <button
                            onClick={() => navigate(onboardingUrl)}
                            className={cn(
                                "w-full rounded-xl transition-all duration-200 hover:opacity-90",
                                collapsed
                                    ? "flex items-center justify-center p-2"
                                    : "p-3 bg-primary-foreground/15 backdrop-blur"
                            )}
                        >
                            {collapsed ? (
                                <div className="relative">
                                    <AlertCircle className="h-5 w-5 text-warning" />
                                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning animate-pulse" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
                                        <span className="text-xs font-semibold text-white">
                                            Lengkapi Profil
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-warning rounded-full transition-all duration-500"
                                            style={{ width: `${onboardingProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-white/70">
                                        {onboardingProgress}% selesai — klik untuk melanjutkan
                                    </p>
                                </div>
                            )}
                        </button>
                    </div>
                )}

                <div className="mt-auto flex flex-col">
                    {/* Legal links */}
                    <div className={cn("px-4 pb-3 pt-2 text-center", collapsed ? "hidden" : "block")}>
                        <div className="flex flex-wrap justify-center items-center gap-1.5 text-[10px] text-white/50">
                            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
                            <span>&middot;</span>
                            <Link to="/refund-policy" className="hover:text-white transition-colors">Refund</Link>
                            <span>&middot;</span>
                            <Link to="/terms-of-use" className="hover:text-white transition-colors">Terms</Link>
                        </div>
                    </div>

                    {/* Footer — User info with dropdown */}
                    <div className="p-3 border-t border-white/15 bg-black/15">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "w-full flex items-center gap-2 rounded-lg p-2 transition-colors duration-200 hover:bg-primary-foreground/10 focus:outline-none",
                                    collapsed && "justify-center"
                                )}
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 flex-shrink-0 overflow-hidden">
                                    {(user?.user_metadata?.avatar_url || (isBuyer ? buyerProfile?.profile_image_url : null)) ? (
                                        <img 
                                            src={user?.user_metadata?.avatar_url || (isBuyer ? buyerProfile?.profile_image_url : null)} 
                                            alt="Profile" 
                                            className="h-full w-full object-cover" 
                                        />
                                    ) : (
                                        <User className="h-4 w-4 text-white" />
                                    )}
                                </div>
                                {!collapsed && (
                                    <>
                                        <div className="min-w-0 flex-1 text-left">
                                            <p className="text-xs font-medium text-white truncate">
                                                {user?.user_metadata?.name || (isBuyer ? "Pembeli" : "Penjual")}
                                            </p>
                                            <p className="text-[10px] text-white/60 truncate">{user?.email}</p>
                                        </div>
                                        <ChevronUp className="h-4 w-4 text-white/60 flex-shrink-0" />
                                    </>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="right"
                            align="end"
                            sideOffset={8}
                            className="w-56 mb-1"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {user?.user_metadata?.name || (isBuyer ? "Pembeli" : "Penjual")}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user?.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                    <Users className="mr-2 h-4 w-4" />
                                    Ganti Peran
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        {userRoles.map(role => (
                                            <DropdownMenuItem 
                                                key={role} 
                                                onClick={() => {
                                                    if (role !== activeRole) {
                                                        switchToRole(role, navigate);
                                                    }
                                                }}
                                                className="cursor-pointer flex items-center"
                                            >
                                                {role === activeRole ? (
                                                    <Check className="mr-2 h-4 w-4" />
                                                ) : (
                                                    <span className="w-6" />
                                                )}
                                                {role === "penjual" ? "Dasbor Penjual" : role === "pembeli" ? "Dasbor Pembeli" : "Dasbor Admin"}
                                            </DropdownMenuItem>
                                        ))}
                                        {!(userRoles.includes("penjual") && userRoles.includes("pembeli")) && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="cursor-pointer flex items-center"
                                                    onClick={() => navigate("/pilih-peran")}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Tambah Peran
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => navigate(isBuyer ? "/pengaturan" : "/settings")}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Pengaturan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive"
                                onClick={handleSignOut}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Keluar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                </div>
            </aside>

            {/* Mobile bottom navigation bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-primary opacity-95 backdrop-blur-lg border-t border-primary-foreground/20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex items-center px-1 py-1">
                    {isBuyer ? (
                        // ── Buyer: streamlined 4-item nav ──────────────────────
                        <>
                            {/* Toko */}
                            <NavLink
                                to="/toko"
                                className={({ isActive }) => cn(
                                    "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 flex-1 min-w-0",
                                    isActive ? "text-white bg-primary-foreground/20" : "text-white/70"
                                )}
                            >
                                <Store className="h-5 w-5 flex-shrink-0" />
                                <span className="text-[9px] font-medium leading-tight truncate w-full text-center">Toko</span>
                            </NavLink>

                            {/* Transaksi */}
                            <NavLink
                                to="/transaksi"
                                className={({ isActive }) => cn(
                                    "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 flex-1 min-w-0",
                                    isActive ? "text-white bg-primary-foreground/20" : "text-white/70"
                                )}
                            >
                                <ShoppingBag className="h-5 w-5 flex-shrink-0" />
                                <span className="text-[9px] font-medium leading-tight truncate w-full text-center">Transaksi</span>
                            </NavLink>

                            {/* Notifikasi */}
                            <NavLink
                                to="/notifikasi"
                                className={({ isActive }) => cn(
                                    "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 relative flex-1 min-w-0",
                                    isActive ? "text-white bg-primary-foreground/20" : "text-white/70"
                                )}
                            >
                                <Bell className="h-5 w-5 flex-shrink-0" />
                                <span className="text-[9px] font-medium leading-tight truncate w-full text-center">Notifikasi</span>
                                {unreadCount > 0 && (
                                    <Badge className="absolute -top-0.5 right-0.5 h-4 min-w-[16px] flex items-center justify-center p-0 text-[9px] bg-red-500 text-white">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </Badge>
                                )}
                            </NavLink>

                            {/* Akun */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 text-white/70 flex-1 min-w-0">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20 overflow-hidden">
                                            {(user?.user_metadata?.avatar_url || buyerProfile?.profile_image_url) ? (
                                                <img src={user?.user_metadata?.avatar_url || buyerProfile?.profile_image_url} alt="Profile" className="h-full w-full object-cover" />
                                            ) : (
                                                <User className="h-3.5 w-3.5 text-white" />
                                            )}
                                        </div>
                                        <span className="text-[9px] font-medium leading-tight truncate w-full text-center">Akun</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-56">
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user?.user_metadata?.name || "Pembeli"}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="cursor-pointer">
                                            <Users className="mr-2 h-4 w-4" />
                                            Ganti Peran
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                {userRoles.map(role => (
                                                    <DropdownMenuItem key={role} onClick={() => { if (role !== activeRole) switchToRole(role, navigate); }} className="cursor-pointer flex items-center">
                                                        {role === activeRole ? <Check className="mr-2 h-4 w-4" /> : <span className="w-6" />}
                                                        {role === "penjual" ? "Dasbor Penjual" : role === "pembeli" ? "Dasbor Pembeli" : "Dasbor Admin"}
                                                    </DropdownMenuItem>
                                                ))}
                                                {!(userRoles.includes("penjual") && userRoles.includes("pembeli")) && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="cursor-pointer flex items-center" onClick={() => navigate("/pilih-peran")}>
                                                            <Plus className="mr-2 h-4 w-4" />Tambah Peran
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/pengaturan")}>
                                        <Settings className="mr-2 h-4 w-4" />Pengaturan
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
                                        <LogOut className="mr-2 h-4 w-4" />Keluar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <div className="flex flex-wrap justify-center items-center gap-2 p-2 text-[10px] text-muted-foreground">
                                        <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
                                        <span>&middot;</span>
                                        <Link to="/refund-policy" className="hover:underline">Refund</Link>
                                        <span>&middot;</span>
                                        <Link to="/terms-of-use" className="hover:underline">Terms</Link>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        // ── Seller: clean 5-tab nav (4 primary + "Lainnya" drawer) ──
                        <>
                            {sellerMobilePrimaryItems.map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <NavLink
                                        key={item.title}
                                        to={item.url}
                                        className={cn(
                                            "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 flex-1 min-w-0",
                                            isActive ? "text-white bg-primary-foreground/20" : "text-white/70"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5 flex-shrink-0" />
                                        <span className="text-[10px] font-medium leading-tight truncate w-full text-center">{item.title}</span>
                                    </NavLink>
                                );
                            })}

                            {/* "Lainnya" (More) button — opens bottom sheet */}
                            <button
                                onClick={() => setMoreOpen(true)}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors duration-200 flex-1 min-w-0 relative",
                                    isSecondaryActive || moreOpen ? "text-white bg-primary-foreground/20" : "text-white/70"
                                )}
                            >
                                <MoreHorizontal className="h-5 w-5 flex-shrink-0" />
                                <span className="text-[10px] font-medium leading-tight truncate w-full text-center">Lainnya</span>
                                {moreBadgeCount > 0 && (
                                    <Badge className="absolute -top-0.5 right-1 h-4 min-w-[16px] flex items-center justify-center p-0 text-[9px] bg-red-500 text-white">
                                        {moreBadgeCount > 9 ? "9+" : moreBadgeCount}
                                    </Badge>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* ── Seller "Lainnya" bottom sheet drawer (mobile only) ── */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-2xl px-0 pb-0 pt-0 max-h-[85vh] overflow-y-auto md:hidden [&>button:last-child]:hidden"
                >
                    <SheetTitle className="sr-only">Menu Lainnya</SheetTitle>

                    {/* Drag handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                    </div>

                    {/* User profile header */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 overflow-hidden">
                            {user?.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-5 w-5 text-primary" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                                {user?.user_metadata?.name || "Penjual"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                    </div>

                    {/* Navigation links */}
                    <div className="px-3 py-2">
                        <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Menu</p>
                        {sellerMobileSecondaryItems.map((item) => {
                            const isActive = location.pathname === item.url;
                            const showBadge = item.url === "/notifikasi" && unreadCount > 0;
                            return (
                                <button
                                    key={item.url}
                                    onClick={() => { setMoreOpen(false); navigate(item.url); }}
                                    className={cn(
                                        "w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-150",
                                        isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground hover:bg-muted active:bg-muted"
                                    )}
                                >
                                    <div className={cn(
                                        "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
                                        isActive ? "bg-primary/15" : "bg-muted"
                                    )}>
                                        <item.icon className="h-[18px] w-[18px]" />
                                    </div>
                                    <span className="flex-1 text-left">{item.title}</span>
                                    {showBadge && (
                                        <Badge className="h-5 min-w-[20px] flex items-center justify-center p-0 px-1.5 text-[10px] bg-red-500 text-white">
                                            {unreadCount > 9 ? "9+" : unreadCount}
                                        </Badge>
                                    )}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </button>
                            );
                        })}
                    </div>

                    {/* Onboarding banner inside drawer */}
                    {!onboardingComplete && (
                        <div className="px-5 py-2">
                            <button
                                onClick={() => { setMoreOpen(false); navigate(onboardingUrl); }}
                                className="w-full rounded-xl p-3.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/20 transition-all hover:opacity-90"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-foreground">Lengkapi Profil</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                        style={{ width: `${onboardingProgress}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                    {onboardingProgress}% selesai — ketuk untuk melanjutkan
                                </p>
                            </button>
                        </div>
                    )}

                    {/* Role switching section */}
                    <div className="px-3 py-2 border-t border-border">
                        <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Akun</p>

                        {/* Switch roles */}
                        {userRoles.filter(r => r !== activeRole).map(role => (
                            <button
                                key={role}
                                onClick={() => { setMoreOpen(false); switchToRole(role, navigate); }}
                                className="w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:bg-muted transition-colors duration-150"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                                    <Users className="h-[18px] w-[18px]" />
                                </div>
                                <span className="flex-1 text-left">
                                    {role === "pembeli" ? "Beralih ke Pembeli" : role === "penjual" ? "Beralih ke Penjual" : "Beralih ke Admin"}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </button>
                        ))}

                        {/* Add role */}
                        {!(userRoles.includes("penjual") && userRoles.includes("pembeli")) && (
                            <button
                                onClick={() => { setMoreOpen(false); navigate("/pilih-peran"); }}
                                className="w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:bg-muted transition-colors duration-150"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                                    <Plus className="h-[18px] w-[18px]" />
                                </div>
                                <span className="flex-1 text-left">Tambah Peran</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </button>
                        )}

                        {/* Sign out */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors duration-150"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 flex-shrink-0">
                                <LogOut className="h-[18px] w-[18px]" />
                            </div>
                            <span className="flex-1 text-left">Keluar</span>
                        </button>
                    </div>

                    {/* Legal links */}
                    <div className="flex flex-wrap justify-center items-center gap-2 px-5 py-4 border-t border-border text-[11px] text-muted-foreground">
                        <Link to="/privacy-policy" className="hover:underline" onClick={() => setMoreOpen(false)}>Privacy</Link>
                        <span>&middot;</span>
                        <Link to="/refund-policy" className="hover:underline" onClick={() => setMoreOpen(false)}>Refund</Link>
                        <span>&middot;</span>
                        <Link to="/terms-of-use" className="hover:underline" onClick={() => setMoreOpen(false)}>Terms</Link>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}

