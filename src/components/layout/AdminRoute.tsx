import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface AdminRouteProps {
    children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { user, loading, userRoles } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse text-primary font-medium">Memuat...</div>
            </div>
        );
    }

    if (!user) return <Navigate to="/auth" replace />;
    // BUG-024 FIX: Non-admin authenticated users should go home, not to /auth
    if (!userRoles.includes("admin")) return <Navigate to="/" replace />;

    return <>{children}</>;
}
