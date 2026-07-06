import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cookie, Store, ShoppingBag, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RoleSelection = () => {
  const { user, userRoles, activeRole, setActiveRole, addRole, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  // BUG-018 FIX: Loading state to prevent double-click
  const [isAddingRole, setIsAddingRole] = useState(false);

  const handleSelectRole = (role: "penjual" | "pembeli") => {
    setActiveRole(role);
    navigate(role === "pembeli" ? "/toko" : "/");
  };

  const handleAddRole = async (role: "penjual" | "pembeli") => {
    if (isAddingRole) return;
    setIsAddingRole(true);
    try {
      const { error } = await addRole(role);
      if (error) {
        toast({ title: "Gagal menambah peran", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Peran berhasil ditambahkan!" });
        setActiveRole(role);
        // Redirect to onboarding for new roles
        navigate(role === "pembeli" ? "/onboarding/pembeli" : "/onboarding/penjual");
      }
    } finally {
      setIsAddingRole(false);
    }
  };

  const hasPenjual = userRoles.includes("penjual");
  const hasPembeli = userRoles.includes("pembeli");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-warm">
            <Cookie className="h-7 w-7 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl text-foreground">SnackTrack</span>
        </div>

        <p className="text-center text-muted-foreground mb-8">
          Pilih peran untuk melanjutkan
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Penjual Card */}
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-warm-lg hover:-translate-y-1 border-2",
              activeRole === "penjual" ? "border-primary" : "border-border",
              isAddingRole && "opacity-60 pointer-events-none"
            )}
            onClick={() => !isAddingRole && (hasPenjual ? handleSelectRole("penjual") : handleAddRole("penjual"))}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-primary">
                <Store className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">Penjual</CardTitle>
              <CardDescription>Kelola toko dan produk Anda</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant={hasPenjual ? "default" : "outline"} size="sm" className="w-full">
                {hasPenjual ? (
                  <>Masuk sebagai Penjual <ArrowRight className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Daftar sebagai Penjual <Plus className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Pembeli Card */}
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-warm-lg hover:-translate-y-1 border-2",
              activeRole === "pembeli" ? "border-primary" : "border-border",
              isAddingRole && "opacity-60 pointer-events-none"
            )}
            onClick={() => !isAddingRole && (hasPembeli ? handleSelectRole("pembeli") : handleAddRole("pembeli"))}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                <ShoppingBag className="h-8 w-8 text-accent-foreground" />
              </div>
              <CardTitle className="text-lg">Pembeli</CardTitle>
              <CardDescription>Jelajahi dan beli camilan favorit</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant={hasPembeli ? "default" : "outline"} size="sm" className="w-full">
                {hasPembeli ? (
                  <>Masuk sebagai Pembeli <ArrowRight className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Daftar sebagai Pembeli <Plus className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">
            Keluar dari akun
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
