import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Bell, Shield, Palette, LogOut,
  ChevronRight, ChevronLeft, Moon, Sun, Smartphone, Mail,
  Lock, Eye, EyeOff, Save, Cookie, Camera,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotification } from "@/contexts/NotificationContext";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/contexts/OnboardingContext";

type SettingsTab = "profil" | "notifikasi" | "keamanan" | "tampilan" | "debug";

const tabs: { key: SettingsTab; label: string; desc: string; icon: typeof User }[] = [
  { key: "profil", label: "Profil", desc: "Nama, email, telepon", icon: User },
  { key: "notifikasi", label: "Notifikasi", desc: "Email, push, pesanan", icon: Bell },
  { key: "keamanan", label: "Keamanan", desc: "Password & sesi", icon: Shield },
  { key: "tampilan", label: "Tampilan", desc: "Tema & bahasa", icon: Palette },
  ...(import.meta.env.DEV ? [{ key: "debug" as SettingsTab, label: "Debug Actions", desc: "Test notifications, etc.", icon: Bell }] : []),
];

// ─── Content panels ────────────────────────────────────────────

function ProfilPanel({ name, setName, email, phone, setPhone, isBuyer, profileImage, setProfileImage, onSave, isSaving }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4 mb-4">
        <div className="flex-shrink-0 relative group">
          {profileImage ? (
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-primary/20">
              <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
              <User className="h-10 w-10 text-primary" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer overflow-hidden">
             <div className="absolute top-0 right-0 left-0 bottom-0 pointer-events-none" />
             <div className="w-full h-full opacity-0 absolute z-10 scale-[2]">
                <ImageUpload 
                   bucket="profile picture"
                   currentUrl={profileImage}
                   onUpload={setProfileImage}
                   className="w-full h-full m-0 p-0 absolute inset-0 opacity-0" 
                />
             </div>
             <Camera className="h-6 w-6 text-white pointer-events-none" />
          </div>
        </div>
        <div className="text-center sm:text-left pt-2">
          <p className="font-semibold text-foreground text-lg">{name || "Pengguna"}</p>
          <p className="text-sm text-muted-foreground">{isBuyer ? "Pembeli" : "Penjual"}</p>
          <p className="text-xs text-muted-foreground mt-1">Klik gambar untuk mengubah foto profil</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="s-name" className="text-xs">Nama Lengkap</Label>
          <Input id="s-name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Nama Anda" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email" className="text-xs">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="s-email" value={email} disabled className="pl-10 bg-muted" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-phone" className="text-xs">No. Telepon</Label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="s-phone" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="08xxxxxxxxx" className="pl-10" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Peran Aktif</Label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted text-sm">
            <Cookie className="h-4 w-4 text-primary" />
            {isBuyer ? "Pembeli" : "Penjual"}
          </div>
        </div>
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full sm:w-auto">
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </div>
  );
}

interface NotifikasiPanelProps {
  emailNotif: boolean;
  setEmailNotif: (v: boolean) => void;
  pushNotif: boolean;
  setPushNotif: (v: boolean) => void;
  orderNotif: boolean;
  setOrderNotif: (v: boolean) => void;
  promoNotif: boolean;
  setPromoNotif: (v: boolean) => void;
}

function NotifikasiPanel({ emailNotif, setEmailNotif, pushNotif, setPushNotif, orderNotif, setOrderNotif, promoNotif, setPromoNotif }: NotifikasiPanelProps) {
  const items = [
    { label: "Notifikasi Email", desc: "Terima pembaruan melalui email", checked: emailNotif, onChange: setEmailNotif },
    { label: "Push Notification", desc: "Notifikasi di perangkat Anda", checked: pushNotif, onChange: setPushNotif },
    { label: "Update Pesanan", desc: "Notifikasi status pesanan berubah", checked: orderNotif, onChange: setOrderNotif },
    { label: "Promo & Penawaran", desc: "Terima info diskon dan promo", checked: promoNotif, onChange: setPromoNotif },
  ];
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5 pr-4">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={item.checked} onCheckedChange={item.onChange} />
          </div>
          {i < items.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}

interface KeamananPanelProps {
  oldPassword: string;
  setOldPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showOldPassword: boolean;
  setShowOldPassword: (v: boolean) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean) => void;
  onChangePassword: () => void;
  isChangingPassword: boolean;
}

function KeamananPanel({ oldPassword, setOldPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, showOldPassword, setShowOldPassword, showNewPassword, setShowNewPassword, onChangePassword, isChangingPassword }: KeamananPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="old-pw" className="text-xs">Password Lama</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="old-pw" type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10" />
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowOldPassword(!showOldPassword)}>
            {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw" className="text-xs">Password Baru</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="new-pw" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10" />
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowNewPassword(!showNewPassword)}>
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-pw" className="text-xs">Konfirmasi Password Baru</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10" />
        </div>
      </div>

      <Button className="w-full sm:w-auto" onClick={onChangePassword} disabled={isChangingPassword || !newPassword || !confirmPassword}>
        <Shield className="h-4 w-4 mr-2" />
        {isChangingPassword ? "Mengubah..." : "Ubah Password"}
      </Button>

      <Separator className="my-4" />

      <div>
        <h3 className="text-sm font-semibold mb-1">Sesi Aktif</h3>
        <p className="text-xs text-muted-foreground mb-3">Perangkat yang login ke akun Anda</p>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Smartphone className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Perangkat ini</p>
            <p className="text-xs text-muted-foreground">Aktif sekarang</p>
          </div>
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">Aktif</span>
        </div>
      </div>
    </div>
  );
}

function TampilanPanel({ theme, setTheme, language, setLanguage }: any) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs font-medium mb-3 block">Tema</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            { key: "light", label: "Terang", icon: Sun },
            { key: "dark", label: "Gelap", icon: Moon },
            { key: "system", label: "Sistem", icon: Smartphone },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all",
                theme === t.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
            >
              <t.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", theme === t.key ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium", theme === t.key ? "text-primary" : "text-muted-foreground")}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs font-medium mb-3 block">Bahasa</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            { key: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
            { key: "en", label: "English", flag: "🇬🇧" },
          ] as const).map((l) => (
            <button
              key={l.key}
              onClick={() => setLanguage(l.key)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                language === l.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
            >
              <span className="text-2xl">{l.flag}</span>
              <span className={cn("text-sm font-medium", language === l.key ? "text-primary" : "text-muted-foreground")}>{l.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DebugPanel() {
  const { addNotification } = useNotification();

  const handleTestNotification = () => {
    addNotification({
      type: "system",
      title: "Test Notification",
      message: "This is a test notification generated from Settings.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-muted/50">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Test Toast & Notification</h3>
        <p className="text-xs text-muted-foreground mb-4">Clicking the button below will trigger a system notification locally. Ensure notifications show up floating on mobile and bottom-right on desktop.</p>
        <Button onClick={handleTestNotification} variant="default">
          Trigger Notification
        </Button>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate();
  const { user, activeRole, signOut } = useAuth();
  const { buyerProfile, sellerProfile, updateBuyerProfile, updateSellerProfile } = useOnboarding();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(null);

  // Form states
  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [email] = useState(user?.email || "");
  const [phone, setPhone] = useState(activeRole === "pembeli" ? buyerProfile?.phone || "" : sellerProfile?.shop_telephone || "");
  const [profileImage, setProfileImage] = useState(activeRole === "pembeli" ? buyerProfile?.profile_image_url || user?.user_metadata?.avatar_url || "" : user?.user_metadata?.avatar_url || "");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

    // BUG-005 FIX: Notification toggles persisted to localStorage
    const [emailNotif, setEmailNotif] = useState(() =>
        JSON.parse(localStorage.getItem("snacktrack_pref_emailNotif") ?? "true")
    );
    const [pushNotif, setPushNotif] = useState(() =>
        JSON.parse(localStorage.getItem("snacktrack_pref_pushNotif") ?? "true")
    );
    const [orderNotif, setOrderNotif] = useState(() =>
        JSON.parse(localStorage.getItem("snacktrack_pref_orderNotif") ?? "true")
    );
    const [promoNotif, setPromoNotif] = useState(() =>
        JSON.parse(localStorage.getItem("snacktrack_pref_promoNotif") ?? "false")
    );

    // Persist notification preferences to localStorage
    useEffect(() => {
        localStorage.setItem("snacktrack_pref_emailNotif", JSON.stringify(emailNotif));
        localStorage.setItem("snacktrack_pref_pushNotif", JSON.stringify(pushNotif));
        localStorage.setItem("snacktrack_pref_orderNotif", JSON.stringify(orderNotif));
        localStorage.setItem("snacktrack_pref_promoNotif", JSON.stringify(promoNotif));
    }, [emailNotif, pushNotif, orderNotif, promoNotif]);

    // Appearance
    const { theme, setTheme } = useTheme();
    const [language, setLanguage] = useState<"id" | "en">("id");

    // BUG-004 FIX: Password change state
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isBuyer = activeRole === "pembeli";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // BUG-004 FIX: Password change handler
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Password tidak cocok", description: "Password baru dan konfirmasi tidak sama.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password terlalu pendek", description: "Password baru minimal 6 karakter.", variant: "destructive" });
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password berhasil diubah", description: "Gunakan password baru saat login berikutnya." });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Gagal mengubah password", description: err.message, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // BUG-020 FIX: Re-seed phone from async profile data
  useEffect(() => {
    if (isBuyer && buyerProfile?.phone) setPhone(buyerProfile.phone);
    else if (!isBuyer && sellerProfile?.shop_telephone) setPhone(sellerProfile.shop_telephone);
  }, [buyerProfile, sellerProfile, isBuyer]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      // 1. Update Onboarding Profile based on role
      if (isBuyer) {
         const { error } = await updateBuyerProfile({
           phone: phone,
           profile_image_url: profileImage,
         });
         if (error) throw error;
      } else {
         const { error } = await updateSellerProfile({
           shop_telephone: phone,
         });
         if (error) throw error;
      }

      // 2. Update Auth User Metadata and trigger auth state change to update local hooks instantly
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: name, avatar_url: profileImage }
      });
      if (authError) throw authError;

      // Force a session refresh to propagate the updated user to AuthContext
      await supabase.auth.refreshSession();

      toast({ title: "Profil diperbarui", description: "Perubahan profil Anda berhasil disimpan." });
    } catch (err: any) {
      toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const allTabs = [...tabs];
  const activeTabData = allTabs.find((t) => t.key === activeTab);

  const renderContent = (tab: SettingsTab) => {
    switch (tab) {
      case "profil":
        return <ProfilPanel name={name} setName={setName} email={email} phone={phone} setPhone={setPhone} isBuyer={isBuyer} profileImage={profileImage} setProfileImage={setProfileImage} onSave={handleSaveProfile} isSaving={isSavingProfile} />;
      case "notifikasi":
        return <NotifikasiPanel emailNotif={emailNotif} setEmailNotif={setEmailNotif} pushNotif={pushNotif} setPushNotif={setPushNotif} orderNotif={orderNotif} setOrderNotif={setOrderNotif} promoNotif={promoNotif} setPromoNotif={setPromoNotif} />;
      case "keamanan":
        return <KeamananPanel oldPassword={oldPassword} setOldPassword={setOldPassword} newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showOldPassword={showOldPassword} setShowOldPassword={setShowOldPassword} showNewPassword={showNewPassword} setShowNewPassword={setShowNewPassword} onChangePassword={handleChangePassword} isChangingPassword={isChangingPassword} />;
      case "tampilan":
        return <TampilanPanel theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />;
      case "debug":
        return <DebugPanel />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">

      {/* ── MOBILE LAYOUT ──────────────────────────────── */}
      <div className="lg:hidden">
        {/* Mobile: Menu list or drill-down content */}
        {activeTab === null ? (
          <>
            <h1 className="text-xl font-bold text-foreground mb-1">Pengaturan</h1>
            <p className="text-sm text-muted-foreground mb-5">Kelola akun dan preferensi</p>

            {/* Profile card at top */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border mb-4">
              {profileImage ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 border border-primary/20 overflow-hidden">
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{name || "Pengguna"}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </div>

            {/* Menu items */}
            <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
              {allTabs.map((tab, i) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <tab.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tab.label}</p>
                    <p className="text-xs text-muted-foreground">{tab.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Keluar</span>
            </button>
          </>
        ) : (
          <>
            {/* Back header */}
            <button
              onClick={() => setActiveTab(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Kembali
            </button>
            <h2 className="text-lg font-bold text-foreground mb-1">{activeTabData?.label}</h2>
            <p className="text-xs text-muted-foreground mb-4">{activeTabData?.desc}</p>

            {renderContent(activeTab)}
          </>
        )}
      </div>

      {/* ── DESKTOP LAYOUT ─────────────────────────────── */}
      <div className="hidden lg:block">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola akun dan preferensi Anda</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-56 flex-shrink-0">
            <div className="flex flex-col gap-1">
              {allTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all w-full text-left",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <tab.icon className="h-4 w-4 flex-shrink-0" />
                  {tab.label}
                </button>
              ))}

              <Separator className="my-2" />

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-destructive hover:bg-destructive/10 w-full text-left"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                Keluar
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1">
            {activeTab ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{activeTabData?.label}</CardTitle>
                  <CardDescription>{activeTabData?.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderContent(activeTab)}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Pilih menu di samping untuk mulai mengatur</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
