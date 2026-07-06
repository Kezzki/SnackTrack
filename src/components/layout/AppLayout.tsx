import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { BuyerTopBar } from "./BuyerTopBar";
import { BalanceFloat } from "./BalanceFloat";
import { AccountStatusBanner } from "./AccountStatusBanner";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { collapsed } = useSidebar();
  const { activeRole } = useAuth();
  const isBuyer = activeRole === "pembeli";
  return (
    <div className="min-h-screen bg-transparent relative z-0">
      <AppSidebar />
      {isBuyer && <BuyerTopBar />}
      <main className={cn(
        "transition-all duration-300 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 relative z-10 pl-0 overflow-x-hidden",
        collapsed ? "md:pl-16" : "md:pl-60",
        isBuyer ? "pt-14 md:pt-0" : ""
      )}>
        <AccountStatusBanner />
        <div className="p-2.5 sm:p-4 md:p-6 lg:p-8"><Outlet /></div>
      </main>
      <BalanceFloat />
    </div>
  );
}

