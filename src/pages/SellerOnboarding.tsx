import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Cookie, ArrowRight, ArrowLeft, Check, Plus, Trash2, Loader2,
    Store, MapPin, Truck, ShoppingBag, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { OnboardingStepIndicator } from "@/components/onboarding/OnboardingStepIndicator";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { IndonesiaMapPicker } from "@/components/onboarding/IndonesiaMapPicker";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { cn } from "@/lib/utils";

const STEPS = [
    { label: "Info Toko" },
    { label: "Lokasi & Telepon" },
    { label: "Pengiriman" },
    { label: "Produk" },
];

const STEP_META = [
    { icon: Store, title: "Informasi Toko", subtitle: "Nama dan foto toko Anda" },
    { icon: MapPin, title: "Lokasi & Telepon", subtitle: "Agar pembeli bisa menemukan toko Anda" },
    { icon: Truck, title: "Metode Pengiriman", subtitle: "Tentukan bagaimana pembeli menerima pesanan" },
    { icon: ShoppingBag, title: "Tambah Produk", subtitle: "Mulai jualan lebih cepat dengan menambah produk sekarang" },
];

const DELIVERY_OPTIONS = [
    { value: "pickup", label: "Ambil di Toko", desc: "Pembeli datang ke toko" },
    { value: "delivery", label: "Pengiriman", desc: "Diantar ke pembeli" },
    { value: "both", label: "Keduanya", desc: "Pickup & pengiriman" },
];

interface ProductDraft {
    name: string;
    price: string;
    stock: string;
    category: string;
    image_url: string;
}

export default function SellerOnboarding() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, userRoles, addRole } = useAuth();
    const { sellerProfile, updateSellerProfile, advanceSellerStep, refreshOnboarding, isSellerOnboardingComplete } = useOnboarding();

    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [slideDirection, setSlideDirection] = useState<"right" | "left">("right");

    // Step 0: Shop Info
    const [shopName, setShopName] = useState("");
    const [shopImage, setShopImage] = useState("");
    const [shopBanner, setShopBanner] = useState("");

    // Step 1: Location & Telephone (merged)
    const [shopAddress, setShopAddress] = useState("");
    const [shopLat, setShopLat] = useState(0);
    const [shopLng, setShopLng] = useState(0);
    const [shopTelephone, setShopTelephone] = useState("");

    // Step 2: Delivery
    const [deliveryMethod, setDeliveryMethod] = useState("");

    // Step 3: Products
    const [products, setProducts] = useState<ProductDraft[]>([]);

    // Redirect away if seller has already completed onboarding
    useEffect(() => {
        if (isSellerOnboardingComplete) {
            navigate("/", { replace: true });
        }
    }, [isSellerOnboardingComplete, navigate]);

    useEffect(() => {
        const loadExistingData = async () => {
            if (!user) return;

            // Safety net: ensure user has "penjual" role
            if (!userRoles.includes("penjual")) {
                await addRole("penjual");
            }

            // Resume step from profile
            if (sellerProfile?.onboarding_step) {
                const mappedStep = Math.min(sellerProfile.onboarding_step, 3);
                setStep(mappedStep);
            }

            // Load telephone and delivery data
            if (sellerProfile) {
                setShopTelephone(sellerProfile.shop_telephone || "");
                setDeliveryMethod(sellerProfile.delivery_method || "");
            }

            // Load shop info and location
            const { data: store } = await supabase
                .from("stores")
                .select("*")
                .eq("seller_id", user.id)
                .maybeSingle();

            if (store) {
                setShopName(store.name || "");
                setShopImage(store.image_url || "");
                setShopBanner(store.banner_url || "");
                setShopAddress(store.address || "");
                setShopLat(store.latitude || 0);
                setShopLng(store.longitude || 0);
            }

            setIsInitialized(true);
        };

        if (!isInitialized) {
            loadExistingData();
        }
    }, [user, sellerProfile, isInitialized]);

    const addProduct = () => {
        setProducts((prev) => [...prev, { name: "", price: "", stock: "", category: "", image_url: "" }]);
    };

    const updateProduct = (idx: number, field: keyof ProductDraft, value: string) => {
        setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
    };

    const removeProduct = (idx: number) => {
        setProducts((prev) => prev.filter((_, i) => i !== idx));
    };

    const canProceed = () => {
        switch (step) {
            case 0: return shopName.trim().length > 0;
            case 1: return shopAddress.trim().length > 0 && (shopLat !== 0 || shopLng !== 0) && shopTelephone.trim().length > 0;
            case 2: return true; // optional
            case 3: return true; // optional
            default: return true;
        }
    };

    const saveCurrentStepData = async () => {
        switch (step) {
            case 0: {
                // Create or update the store
                const { data: existing } = await supabase
                    .from("stores")
                    .select("id")
                    .eq("seller_id", user!.id)
                    .maybeSingle();

                if (existing) {
                    await supabase.from("stores").update({
                        name: shopName,
                        image_url: shopImage || null,
                        banner_url: shopBanner || null,
                        updated_at: new Date().toISOString(),
                    }).eq("id", existing.id);
                } else {
                    await supabase.from("stores").insert({
                        seller_id: user!.id,
                        name: shopName,
                        image_url: shopImage || null,
                        banner_url: shopBanner || null,
                    });
                }
                await advanceSellerStep(1);
                break;
            }
            case 1: {
                // Location + Telephone
                await supabase.from("stores").update({
                    address: shopAddress, latitude: shopLat, longitude: shopLng,
                    updated_at: new Date().toISOString(),
                }).eq("seller_id", user!.id);
                await updateSellerProfile({ shop_telephone: shopTelephone });
                await advanceSellerStep(2);
                break;
            }
            case 2: {
                await updateSellerProfile({ delivery_method: deliveryMethod });
                await advanceSellerStep(3);
                break;
            }
            case 3: {
                // Save products
                const { data: store } = await supabase
                    .from("stores")
                    .select("id")
                    .eq("seller_id", user!.id)
                    .single();

                if (store && products.length > 0) {
                    const rows = products
                        .filter((p) => p.name.trim())
                        .map((p) => ({
                            store_id: store.id,
                            name: p.name,
                            price: parseFloat(p.price) || 0,
                            stock: parseInt(p.stock) || 0,
                            category: p.category,
                            image_url: p.image_url,
                        }));
                    if (rows.length) await supabase.from("products").insert(rows);
                }
                await advanceSellerStep(4);
                break;
            }
        }
    };

    const handleNext = async () => {
        setSaving(true);
        try {
            await saveCurrentStepData();
            if (step === 3) {
                toast({ title: "Toko siap! 🎉", description: "Selamat berjualan." });
                await refreshOnboarding();
                navigate("/");
                return;
            }
            setSlideDirection("right");
            setStep((s) => s + 1);
        } catch (err: any) {
            toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleBack = async () => {
        if (step === 0) return;
        try {
            await saveCurrentStepData();
        } catch {
            // Don't block back navigation
        }
        setSlideDirection("left");
        setStep((s) => s - 1);
    };

    const handleStepClick = async (targetStep: number) => {
        if (targetStep === step) return;
        try {
            await saveCurrentStepData();
        } catch {
            // Don't block navigation
        }
        setSlideDirection(targetStep > step ? "right" : "left");
        setStep(targetStep);
    };

    const handleSaveAndReturn = async () => {
        setSaving(true);
        try {
            await saveCurrentStepData();
            toast({ title: "Progres disimpan", description: "Anda dapat melanjutkan onboarding nanti." });
            navigate("/");
        } catch (err: any) {
            toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        if (step >= 2) {
            // Optional steps — just advance
            await advanceSellerStep(step + 1);
            if (step === 3) {
                navigate("/");
                return;
            }
            setSlideDirection("right");
            setStep((s) => s + 1);
        }
    };

    const isOptionalStep = step >= 2;
    const StepIcon = STEP_META[step]?.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-primary">
                        <Cookie className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-bold text-foreground">SnackTrack</span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-8 shadow-warm">
                    {/* Stepper */}
                    <OnboardingStepIndicator
                        steps={STEPS}
                        currentStep={step}
                        className="mb-6"
                        onStepClick={handleStepClick}
                    />

                    {/* Step header with icon */}
                    <div className="flex items-center gap-3 mb-6">
                        {StepIcon && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                <StepIcon className="h-5 w-5" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{STEP_META[step]?.title}</h1>
                            <p className="text-sm text-muted-foreground">{STEP_META[step]?.subtitle}</p>
                        </div>
                    </div>

                    {/* Step Content with transition */}
                    <div
                        key={step}
                        className={cn(
                            "space-y-4 min-h-[200px] sm:min-h-[250px]",
                            "animate-in fade-in duration-300",
                            slideDirection === "right" ? "slide-in-from-right-4" : "slide-in-from-left-4"
                        )}
                    >
                        {/* Step 0: Shop Info */}
                        {step === 0 && (
                            <>
                                <ImageUpload
                                    bucket="shop"
                                    currentUrl={shopImage}
                                    onUpload={setShopImage}
                                    label="Foto Toko"
                                />
                                <p className="text-xs text-muted-foreground -mt-2">Disarankan agar toko lebih menarik</p>
                                <ImageUpload
                                    bucket="shop"
                                    currentUrl={shopBanner}
                                    onUpload={setShopBanner}
                                    label="Banner Toko (Opsional)"
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="shopName">
                                        Nama Toko <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="shopName"
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        placeholder="Toko Camilan Enak"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {/* Step 1: Location & Telephone (merged) */}
                        {step === 1 && (
                            <>
                                <IndonesiaMapPicker
                                    latitude={shopLat || undefined}
                                    longitude={shopLng || undefined}
                                    onLocationSelect={(lat, lng, addr) => {
                                        setShopLat(lat);
                                        setShopLng(lng);
                                        if (addr && !shopAddress) setShopAddress(addr);
                                    }}
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="shopAddress">
                                        Alamat Toko <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="shopAddress"
                                        value={shopAddress}
                                        onChange={(e) => setShopAddress(e.target.value)}
                                        placeholder="Jl. Raya No. 1, Jakarta"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="shopTelephone">
                                        Nomor Telepon Toko <span className="text-destructive">*</span>
                                    </Label>
                                    <PhoneInput
                                        id="shopTelephone"
                                        value={shopTelephone}
                                        onChange={setShopTelephone}
                                    />
                                </div>
                            </>
                        )}

                        {/* Step 2: Delivery Method */}
                        {step === 2 && (
                            <div className="space-y-3">
                                <Label>Metode Pengiriman</Label>
                                <p className="text-xs text-muted-foreground">Bisa diubah nanti di pengaturan</p>
                                <div className="grid gap-3 mt-2">
                                    {DELIVERY_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setDeliveryMethod(opt.value)}
                                            className={cn(
                                                "flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 text-left",
                                                deliveryMethod === opt.value
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <span className="font-medium text-foreground">{opt.label}</span>
                                            <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Add Products */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Tambah Produk</Label>
                                        <p className="text-xs text-muted-foreground">Anda bisa menambah produk nanti</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={addProduct}>
                                        <Plus className="h-4 w-4 mr-1" /> Produk
                                    </Button>
                                </div>

                                {products.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground rounded-xl border-2 border-dashed border-border">
                                        <p className="text-sm">Belum ada produk</p>
                                        <p className="text-xs mt-1">Klik "Produk" untuk menambah</p>
                                    </div>
                                )}

                                {products.map((prod, idx) => (
                                    <div key={idx} className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Produk {idx + 1}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProduct(idx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Input placeholder="Nama produk *" value={prod.name} onChange={(e) => updateProduct(idx, "name", e.target.value)} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input placeholder="Harga (Rp)" type="number" value={prod.price} onChange={(e) => updateProduct(idx, "price", e.target.value)} />
                                            <Input placeholder="Stok" type="number" value={prod.stock} onChange={(e) => updateProduct(idx, "stock", e.target.value)} />
                                        </div>
                                        <Input placeholder="Kategori" value={prod.category} onChange={(e) => updateProduct(idx, "category", e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                            {step > 0 && (
                                <Button variant="ghost" size="sm" onClick={handleBack}>
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveAndReturn}
                                disabled={!canProceed() || saving}
                            >
                                <Save className="h-4 w-4 mr-1" /> Simpan & Keluar
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            {isOptionalStep && (
                                <Button variant="ghost" size="sm" onClick={handleSkip}>
                                    Lewati
                                </Button>
                            )}
                            <Button size="sm" onClick={handleNext} disabled={!canProceed() || saving}>
                                {saving ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Menyimpan...</>
                                ) : step === 3 ? (
                                    <>Selesai <Check className="h-4 w-4 ml-1" /></>
                                ) : (
                                    <>Lanjut <ArrowRight className="h-4 w-4 ml-1" /></>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
