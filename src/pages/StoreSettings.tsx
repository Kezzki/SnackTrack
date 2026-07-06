import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store, MapPin, FileText, Palmtree, Bot, Save,
  Sun, Camera, ChevronLeft, Loader2,
  Sparkles, ShieldCheck, Info, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSellerStore, useInvalidateSellerStore } from "@/hooks/useSellerStore";
import { cn } from "@/lib/utils";

// ─── Inline image uploader ───────────────────────────────────────────────────

function UploadZone({
  url,
  onUpload,
  aspect = "banner",
}: {
  url: string;
  onUpload: (url: string) => void;
  aspect?: "banner" | "logo";
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("shop").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("shop").getPublicUrl(path);
      onUpload(data.publicUrl);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [user, onUpload]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("image/")) upload(f);
  };

  if (aspect === "logo") {
    return (
      <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
        {url ? (
          <img src={url} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-[3px] border-background shadow-lg" />
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-card border-[3px] border-background shadow-lg flex items-center justify-center">
            <Store className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        className="w-full h-40 sm:h-52 rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center"
        style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {!url && (
          <div className="text-center pointer-events-none select-none">
            <Camera className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground/60">Klik untuk unggah banner</p>
          </div>
        )}
      </div>
      <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 select-none">
        {uploading ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <>
            <Camera className="h-5 w-5 text-white" />
            <span className="text-sm text-white font-medium">{url ? "Ganti Banner" : "Unggah Banner"}</span>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Mode selector card ───────────────────────────────────────────────────────

function ModeCard({
  selected, icon: Icon, iconColor, iconBg, label, desc, onClick,
}: {
  selected: boolean; icon: React.ElementType; iconColor: string; iconBg: string;
  label: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex-1 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-muted/40"
      )}
    >
      {selected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-primary" />}
      <div className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <p className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</p>
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  title,
  description,
  badge,
  children,
}: {
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {/* Card body */}
      <div className="px-5 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Textarea helper ──────────────────────────────────────────────────────────

function Textarea({ id, value, onChange, placeholder, rows = 3 }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StoreSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: sellerStore } = useSellerStore();
  const invalidateStore = useInvalidateSellerStore();

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeBanner, setStoreBanner] = useState("");
  const [storeActive, setStoreActive] = useState(true);
  const [isOnHoliday, setIsOnHoliday] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyPrompt, setAutoReplyPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const seededRef = useRef(false);

  const seed = useCallback((store: typeof sellerStore) => {
    if (!store) return;
    setStoreName(store.name || "");
    setStoreDescription(store.description || "");
    setStoreAddress(store.address || "");
    setStoreLogo(store.image_url || "");
    setStoreBanner(store.banner_url || "");
    setStoreActive(store.is_active ?? true);
    setIsOnHoliday(store.is_on_holiday ?? false);
    setHolidayMessage(store.holiday_message || "");
    setAutoReplyEnabled(store.auto_reply_enabled ?? false);
    setAutoReplyPrompt(store.auto_reply_prompt || "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sellerStore || seededRef.current) return;
    seededRef.current = true;
    seed(sellerStore);
  }, [sellerStore, seed]);

  // Mark dirty after first seed
  useEffect(() => {
    if (seededRef.current) setIsDirty(true);
  }, [storeName, storeDescription, storeAddress, storeLogo, storeBanner, storeActive, isOnHoliday, holidayMessage, autoReplyEnabled, autoReplyPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!sellerStore?.id) {
      toast({ title: "Toko belum dimuat", description: "Tunggu sebentar dan coba lagi.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("stores").update({
        name: storeName,
        description: storeDescription,
        address: storeAddress,
        image_url: storeLogo,
        banner_url: storeBanner,
        is_active: storeActive,
        is_on_holiday: isOnHoliday,
        holiday_message: holidayMessage || null,
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_prompt: autoReplyPrompt || null,
        updated_at: new Date().toISOString(),
      }).eq("id", sellerStore.id);
      if (error) throw error;
      toast({ title: "Toko diperbarui ✓", description: "Semua perubahan berhasil disimpan." });
      setIsDirty(false);
      invalidateStore();
    } catch (err: any) {
      toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    seededRef.current = false;
    seed(sellerStore);
    seededRef.current = true;
    setIsDirty(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-32">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 py-5">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Kembali"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground leading-tight">Pengaturan Toko</h1>
          <p className="text-xs text-muted-foreground">Profil, jadwal & balasan otomatis</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOnHoliday && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-2">
              🌴 Libur
            </Badge>
          )}
          <Badge
            variant={storeActive ? "default" : "secondary"}
            className={cn("text-[10px] px-2", storeActive && "bg-emerald-600 hover:bg-emerald-600")}
          >
            {storeActive ? "● Aktif" : "○ Nonaktif"}
          </Badge>
        </div>
      </div>

      {/* ── Hero: Banner + overlapping Logo ──────────────────────────── */}
      <div className="relative mb-14">
        <UploadZone url={storeBanner} onUpload={setStoreBanner} aspect="banner" />
        {/* Logo overlapping bottom-left of banner */}
        <div className="absolute -bottom-10 left-5">
          <UploadZone url={storeLogo} onUpload={setStoreLogo} aspect="logo" />
        </div>
        {/* Store name hint on banner */}
        {storeName && (
          <div className="absolute bottom-3 right-4 max-w-[55%] pointer-events-none">
            <p className="text-white font-semibold text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] truncate">{storeName}</p>
          </div>
        )}
      </div>

      <div className="space-y-5">

        {/* ── Identitas Toko ──────────────────────────────────────────── */}
        <SectionCard icon={Store} title="Identitas Toko" description="Informasi yang terlihat oleh pembeli">
          <div className="space-y-1.5">
            <Label htmlFor="s-name" className="text-xs font-medium">Nama Toko</Label>
            <Input id="s-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Nama toko Anda" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc" className="text-xs font-medium">Deskripsi</Label>
            <Textarea id="s-desc" value={storeDescription} onChange={setStoreDescription} placeholder="Ceritakan tentang toko Anda singkat dan menarik..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-addr" className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Alamat
            </Label>
            <Input id="s-addr" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Jl. Contoh No. 1, Kota" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
            <Camera className="h-3 w-3 flex-shrink-0" />
            Klik banner atau logo di atas untuk mengganti gambar toko.
          </p>
        </SectionCard>

        {/* ── Mode Toko ───────────────────────────────────────────────── */}
        <SectionCard
          icon={isOnHoliday ? Palmtree : Sun}
          iconColor={isOnHoliday ? "text-amber-600" : storeActive ? "text-emerald-600" : "text-muted-foreground"}
          iconBg={isOnHoliday ? "bg-amber-100 dark:bg-amber-900/30" : storeActive ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"}
          title="Mode Toko"
          description="Pilih bagaimana toko Anda beroperasi saat ini"
        >
          <div className="flex gap-3">
            <ModeCard
              selected={storeActive && !isOnHoliday}
              icon={Sun}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              label="Buka Normal"
              desc="Terlihat dan bisa menerima pesanan"
              onClick={() => { setStoreActive(true); setIsOnHoliday(false); }}
            />
            <ModeCard
              selected={isOnHoliday}
              icon={Palmtree}
              iconColor="text-amber-600"
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              label="Mode Libur"
              desc="Tutup sementara, chat tetap aktif"
              onClick={() => { setStoreActive(true); setIsOnHoliday(true); }}
            />
            <ModeCard
              selected={!storeActive && !isOnHoliday}
              icon={Store}
              iconColor="text-muted-foreground"
              iconBg="bg-muted"
              label="Nonaktif"
              desc="Disembunyikan sepenuhnya"
              onClick={() => { setStoreActive(false); setIsOnHoliday(false); }}
            />
          </div>

          {isOnHoliday && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="s-holiday-msg" className="text-xs font-medium">Pesan Liburan</Label>
                <Textarea
                  id="s-holiday-msg"
                  value={holidayMessage}
                  onChange={setHolidayMessage}
                  placeholder="Kami libur hingga tanggal X. Terima kasih atas pengertiannya!"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Ditampilkan di halaman toko dan dikirim ke konteks AI.</p>
              </div>
            </>
          )}
        </SectionCard>

        {/* ── Balas Otomatis AI ───────────────────────────────────────── */}
        <SectionCard
          icon={Bot}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          title="Balas Otomatis AI"
          description="Gemini AI menjawab pesan pembeli kapan saja — saat online maupun mode liburan"
          badge={
            autoReplyEnabled ? (
              <Badge className="text-[10px] px-1.5 py-0 gap-1 h-4">
                <Sparkles className="h-2.5 w-2.5" />
                Aktif
              </Badge>
            ) : undefined
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Aktifkan Balas Otomatis</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {autoReplyEnabled ? "AI aktif — menjawab pertanyaan & menghubungkan ke penjual bila diminta" : "Nonaktif — balas manual"}
              </p>
            </div>
            <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
          </div>

          {autoReplyEnabled && (
            <>
              <Separator />
              <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3.5 space-y-2">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  AI sudah otomatis mengetahui:
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {["Nama & deskripsi toko", "Pesan liburan", "Katalog produk aktif (nama, harga, stok)", "Riwayat percakapan"].map((item) => (
                    <li key={item} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-ai-faq" className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  FAQ & Info Tambahan
                </Label>
                <Textarea
                  id="s-ai-faq"
                  value={autoReplyPrompt}
                  onChange={setAutoReplyPrompt}
                  placeholder={`Contoh:\n- Pengiriman tersedia dalam radius 10 km\n- Bisa request custom kue dengan DP 50%\n- Pengembalian tidak berlaku untuk produk basah\n- Jam operasional normal: Senin–Sabtu, 08.00–17.00`}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground flex gap-1.5">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  Kebijakan pengiriman, jam operasional, atau FAQ khusus yang perlu diketahui AI.
                </p>
              </div>
            </>
          )}
        </SectionCard>

      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300",
          isDirty ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-2xl px-4 py-3">
            <p className="text-sm text-muted-foreground hidden sm:block">Ada perubahan yang belum disimpan</p>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-muted-foreground">
                Batalkan
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 px-5">
                {isSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Simpan</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
