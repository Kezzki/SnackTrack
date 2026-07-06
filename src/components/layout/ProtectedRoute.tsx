import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "penjual" | "pembeli";
  skipRoleCheck?: boolean;
}

export function ProtectedRoute({ children, requiredRole, skipRoleCheck }: ProtectedRouteProps) {
  const { user, loading, activeRole } = useAuth();
  const { isSellerOnboardingComplete, isBuyerOnboardingComplete, loading: onboardingLoading } = useOnboarding();

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-medium">Memuat...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!skipRoleCheck && !activeRole) return <Navigate to="/pilih-peran" replace />;
  if (requiredRole && activeRole !== requiredRole) {
    return <Navigate to={activeRole === "pembeli" ? "/toko" : "/"} replace />;
  }

  // Redirect incomplete sellers/buyers to their onboarding flow
  if (requiredRole === "penjual" && !isSellerOnboardingComplete) {
    return <Navigate to="/onboarding/penjual" replace />;
  }
  if (requiredRole === "pembeli" && !isBuyerOnboardingComplete) {
    return <Navigate to="/onboarding/pembeli" replace />;
  }

  return <>{children}</>;
}
