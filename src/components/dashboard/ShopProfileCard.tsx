import { Store, MapPin, FileText, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSellerStore } from "@/hooks/useSellerStore";
import { useOnboarding } from "@/contexts/OnboardingContext";

export function ShopProfileCard({ onUpdate }: { onUpdate: () => void }) {
  const { data: store, isLoading } = useSellerStore();
  const { isSellerOnboardingComplete } = useOnboarding();

  if (isLoading) return <div className="animate-pulse bg-muted rounded-xl h-48 w-full border border-border mb-8" />;

  if (!store && !isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-sm mb-4 sm:mb-8 flex flex-col items-center justify-center gap-3 sm:gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Store className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg mb-1">Profil Toko Belum Dibuat</h3>
          <p className="text-sm text-muted-foreground mb-4">Silahkan lengkapi profil toko Anda agar terlihat oleh pembeli.</p>
          <Button asChild>
            <Link to="/onboarding/penjual">Lengkapi Profil Sekarang</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div className="bg-card rounded-lg sm:rounded-xl border border-border p-4 sm:p-6 shadow-sm mb-4 sm:mb-8">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <h2 className="text-base sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Profil Toko
        </h2>
        {isSellerOnboardingComplete ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/store-settings">Pengaturan Toko</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/onboarding/penjual">Lanjutkan Onboarding</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-row gap-4 sm:gap-8 md:flex-row">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center gap-3 sm:gap-4 shrink-0">
          {store.image_url ? (
            <img 
              src={store.image_url} 
              alt={store.name} 
              className="w-20 h-20 sm:w-32 sm:h-32 rounded-xl sm:rounded-2xl object-cover border-2 border-border shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-xl sm:rounded-2xl bg-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20">
              <Store className="w-8 h-8 sm:w-12 sm:h-12 text-primary/40" />
            </div>
          )}
        </div>

        {/* Store Details Section */}
        <div className="flex-1 space-y-2 sm:space-y-4 min-w-0">
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-foreground flex items-center gap-1.5 sm:gap-2">
              <span className="truncate">{store.name}</span>
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            </h3>
          </div>
          
          <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 shrink-0" />
            <p className="line-clamp-2 sm:line-clamp-none">{store.description || <span className="italic opacity-60">Belum ada deskripsi</span>}</p>
          </div>

          <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 shrink-0" />
            <p className="line-clamp-1 sm:line-clamp-none">{store.address || <span className="italic opacity-60">Alamat belum diatur</span>}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
