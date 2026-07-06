import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Cookie, ArrowRight, ArrowLeft, Check, User, Heart, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingStepIndicator } from "@/components/onboarding/OnboardingStepIndicator";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const STEPS = [
    { label: "Profil & Kontak" },
    { label: "Preferensi" },
];

const STEP_META = [
    { icon: User, title: "Tentang Anda", subtitle: "Informasi dasar dan kontak" },
    { icon: Heart, title: "Preferensi Belanja", subtitle: "Bantu kami merekomendasikan produk terbaik" },
];

const FOOD_CATEGORIES = [
    "Keripik", "Kue", "Roti", "Permen", "Coklat",
    "Kacang", "Popcorn", "Minuman", "Makanan Ringan", "Lainnya",
];

export default function BuyerOnboarding() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const { buyerProfile, updateBuyerProfile, advanceBuyerStep, isBuyerOnboardingComplete } = useOnboarding();

    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [slideDirection, setSlideDirection] = useState<"right" | "left">("right");

    // Step 0: Profile & Contact (merged)
    const [profileImage, setProfileImage] = useState("");
    const [displayName, setDisplayName] = useState(user?.user_metadata?.name || "");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

    // Step 1: Preferences
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [maxDistance, setMaxDistance] = useState([10]);

    // Redirect away if buyer has already completed onboarding
    useEffect(() => {
        if (isBuyerOnboardingComplete) {
            navigate("/toko", { replace: true });
        }
    }, [isBuyerOnboardingComplete, navigate]);

    useEffect(() => {
        if (!user || isInitialized) return;

        if (buyerProfile?.onboarding_step) {
            setStep(Math.min(buyerProfile.onboarding_step, 1));
        }

        if (buyerProfile) {
            if (buyerProfile.profile_image_url) setProfileImage(buyerProfile.profile_image_url);
            if (buyerProfile.phone) setPhone(buyerProfile.phone);
            if (buyerProfile.address) setAddress(buyerProfile.address);
            if (buyerProfile.product_preference) setSelectedCategories(buyerProfile.product_preference);
            if (buyerProfile.delivery_max_distance_km) setMaxDistance([buyerProfile.delivery_max_distance_km]);
        }

        setIsInitialized(true);
    }, [user, buyerProfile, isInitialized]);

    const toggleCategory = (cat: string) => {
        setSelectedCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    };

    const canProceed = () => {
        switch (step) {
            case 0: return displayName.trim().length > 0 && phone.trim().length > 0 && address.trim().length > 0;
            case 1: return true; // preferences optional
            default: return true;
        }
    };

    const saveCurrentStepData = async () => {
        switch (step) {
            case 0: {
                await updateBuyerProfile({
                    profile_image_url: profileImage || undefined,
                    phone,
                    address,
                    onboarding_step: 1,
                });
                await supabase.auth.updateUser({
                    data: {
                        name: displayName,
                        ...(profileImage ? { avatar_url: profileImage } : {}),
                    },
                });
                await supabase.auth.refreshSession();
                break;
            }
            case 1: {
                await updateBuyerProfile({
                    product_preference: selectedCategories,
                    delivery_max_distance_km: maxDistance[0],
                    onboarding_step: 2,
                });
                break;
            }
        }
    };

    const handleNext = async () => {
        setSaving(true);
        try {
            await saveCurrentStepData();
            if (step === 1) {
                toast({ title: "Profil lengkap! 🎉", description: "Selamat berbelanja." });
                navigate("/toko");
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
        // Silently save current step data before going back
        try {
            await saveCurrentStepData();
        } catch {
            // Don't block navigation on save failure
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
            navigate("/toko");
        } catch (err: any) {
            toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        if (step === 1) {
            await advanceBuyerStep(2);
            navigate("/toko");
        } else {
            setSlideDirection("right");
            setStep((s) => s + 1);
        }
    };

    const StepIcon = STEP_META[step]?.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
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

                    {/* Step content with transition */}
                    <div
                        key={step}
                        className={cn(
                            "space-y-4 min-h-[150px] sm:min-h-[200px]",
                            "animate-in fade-in duration-300",
                            slideDirection === "right" ? "slide-in-from-right-4" : "slide-in-from-left-4"
                        )}
                    >
                        {step === 0 && (
                            <>
                                <ImageUpload
                                    bucket="profile picture"
                                    currentUrl={profileImage}
                                    onUpload={setProfileImage}
                                    label="Foto Profil"
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="displayName">
                                        Nama Lengkap <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Nama Anda"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">
                                        Nomor Telepon <span className="text-destructive">*</span>
                                    </Label>
                                    <PhoneInput
                                        id="phone"
                                        value={phone}
                                        onChange={setPhone}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">
                                        Alamat <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="address"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Jl. Contoh No. 123, Kota, Provinsi"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div className="space-y-2">
                                    <Label>Preferensi Makanan</Label>
                                    <p className="text-xs text-muted-foreground">Pilih kategori makanan favorit Anda</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {FOOD_CATEGORIES.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleCategory(cat)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
                                                    selectedCategories.includes(cat)
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                                )}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 mt-4">
                                    <Label>Jarak Pengiriman Maksimum</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Tampilkan toko dalam radius {maxDistance[0]} km
                                    </p>
                                    <Slider
                                        value={maxDistance}
                                        onValueChange={setMaxDistance}
                                        min={1}
                                        max={50}
                                        step={1}
                                        className="mt-3"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>1 km</span>
                                        <span>50 km</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Navigation buttons */}
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
                            {step === 1 && (
                                <Button variant="ghost" size="sm" onClick={handleSkip}>
                                    Lewati
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleNext}
                                disabled={!canProceed() || saving}
                            >
                                {saving ? "Menyimpan..." : step === 1 ? (
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
