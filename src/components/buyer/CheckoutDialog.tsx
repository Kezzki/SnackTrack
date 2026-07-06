import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Store, MapPin, CreditCard, ShoppingBag, Wallet, Loader2, Pencil, Phone } from "lucide-react";
import type { CartItem } from "@/contexts/CartContext";

// Declare Snap global from Midtrans JS
declare global {
    interface Window {
        snap?: {
            pay: (
                token: string,
                options: {
                    onSuccess?: (result: any) => void;
                    onPending?: (result: any) => void;
                    onError?: (result: any) => void;
                    onClose?: () => void;
                }
            ) => void;
        };
    }
}

interface CheckoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CartItem[];
    onSuccess: () => void;
}

// Load Midtrans Snap.js dynamically
function loadSnapScript(clientKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.snap) {
            resolve();
            return;
        }
        const existing = document.getElementById("midtrans-snap-script");
        if (existing) {
            // Script already loading, wait for it
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("Failed to load Midtrans")));
            return;
        }
        const script = document.createElement("script");
        script.id = "midtrans-snap-script";
        script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
        script.setAttribute("data-client-key", clientKey);
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Midtrans Snap.js"));
        document.head.appendChild(script);
    });
}

export function CheckoutDialog({ open, onOpenChange, items, onSuccess }: CheckoutDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const [deliveryType, setDeliveryType] = useState<"ambil_sendiri" | "dikirim">("ambil_sendiri");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [savedAddress, setSavedAddress] = useState("");
    const [savedPhone, setSavedPhone] = useState("");
    const [editingAddress, setEditingAddress] = useState(false);
    const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");

    const ADMIN_FEE_PERCENT = 0.02; // 2% platform fee
    const totalItemPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = deliveryType === "dikirim" ? 15000 : 0;
    const adminFee = Math.round(totalItemPrice * ADMIN_FEE_PERCENT);
    const finalTotal = totalItemPrice + deliveryFee + adminFee;

    // Fetch buyer profile when dialog opens
    useEffect(() => {
        if (open && user) {
            supabase.from("buyer_profiles").select("address, phone").eq("user_id", user.id).single()
                .then(({ data }) => {
                    const a = data?.address ?? "";
                    const p = data?.phone ?? "";
                    setSavedAddress(a);
                    setSavedPhone(p);
                    setAddress(a);
                    setPhone(p);
                    setEditingAddress(false);
                    setSaveAddressToProfile(false);
                });
        }
    }, [open, user]);

    const handleConfirm = async () => {
        if (!user || items.length === 0) return;
        if (deliveryType === "dikirim" && !address.trim()) {
            toast({ title: "Alamat Kosong", description: "Mohon isi alamat pengiriman.", variant: "destructive" });
            return;
        }

        setIsCheckingOut(true);
        try {
            // Check account status before proceeding
            const { data: profileStatus } = await supabase
                .from("profiles")
                .select("status")
                .eq("id", user.id)
                .single();
            if (profileStatus?.status === "frozen" || profileStatus?.status === "suspended") {
                toast({
                    title: "Akun Dibatasi",
                    description: profileStatus.status === "frozen"
                        ? "Akun kamu dibekukan. Pembelian tidak dapat dilakukan."
                        : "Akun kamu disuspend. Hubungi admin untuk informasi lebih lanjut.",
                    variant: "destructive",
                });
                return;
            }
            // BUG-007 FIX: Validate all cart items belong to the same store
            const { data: allCartProducts } = await supabase
                .from("products")
                .select("id, store_id, stores(seller_id)")
                .in("id", items.map(i => i.productId));

            if (!allCartProducts || allCartProducts.length === 0) throw new Error("Produk tidak valid");

            const uniqueStoreIds = new Set(allCartProducts.map(p => p.store_id));
            if (uniqueStoreIds.size > 1) {
                toast({
                    title: "Toko Berbeda",
                    description: "Keranjang berisi produk dari toko berbeda. Silakan checkout per toko.",
                    variant: "destructive",
                });
                return;
            }

            const storeId = allCartProducts[0].store_id;
            const sellerId = (allCartProducts[0].stores as any)?.seller_id;

            if (!storeId || !sellerId) throw new Error("Produk tidak valid");

            // Get buyer profile for customer details
            const { data: profile } = await supabase
                .from("profiles")
                .select("name, email")
                .eq("id", user.id)
                .single();

            // Optionally persist the changed address/phone back to the buyer profile
            if (saveAddressToProfile && deliveryType === "dikirim") {
                await supabase.from("buyer_profiles").upsert({
                    user_id: user.id,
                    address: address.trim(),
                    phone: phone.trim(),
                }, { onConflict: "user_id" });
            }

            // BUG-006 FIX: Decrement stock BEFORE creating the order.
            // If any decrement fails, no orphaned order is created.
            // 1. Decrement stock for each item atomically
            const stockResults = await Promise.all(
                items.map(item =>
                    supabase.rpc("decrement_stock", {
                        p_product_id: item.productId,
                        p_amount: item.quantity,
                    })
                )
            );
            const stockError = stockResults.find(r => r.error);
            if (stockError?.error) {
                toast({
                    title: "Stok Tidak Cukup",
                    description: "Salah satu produk tidak memiliki stok yang cukup. Silakan periksa kembali.",
                    variant: "destructive",
                });
                return;
            }

            // 2. Create order (stock is already reserved)
            const { data: orderData, error: orderError } = await supabase
                .from("orders")
                .insert({
                    buyer_id: user.id,
                    store_id: storeId,
                    status: paymentMethod === "cod" ? "menunggu" : "menunggu_pembayaran",
                    total_amount: finalTotal,
                    admin_fee: adminFee,
                    delivery_type: deliveryType,
                    delivery_address: deliveryType === "dikirim" ? address : null,
                    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Create order items
            const orderItemsData = items.map(item => ({
                order_id: orderData.id,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.price
            }));
            const { error: itemsError } = await supabase.from("order_items").insert(orderItemsData);
            if (itemsError) throw itemsError;

            // 3. Create initial transaction record
            const { error: txError } = await supabase.from("transactions").insert({
                order_id: orderData.id,
                buyer_id: user.id,
                seller_id: sellerId,
                payment_method: paymentMethod === "cod" ? "cod" : "midtrans",
                payment_status: paymentMethod === "cod" ? "unpaid" : "pending",
                amount: finalTotal
            });
            if (txError) throw txError;

            // 4. For COD, skip Midtrans
            if (paymentMethod === "cod") {
                const orderNumber = `TRX-${orderData.id.substring(0, 8).toUpperCase()}`;
                const itemsSummary = items.map(i => `${i.name} x${i.quantity}`).join(", ");

                // Notify seller about COD order
                await supabase.from("notifications").insert({
                    user_id: sellerId,
                    title: `Pesanan Baru — ${orderNumber}`,
                    message: `Pesanan COD ${formatCurrency(finalTotal)}. Item: ${itemsSummary}.`,
                    type: "order_status",
                    action_url: "/orders",
                    order_id: orderData.id,
                });

                // Notify buyer about their COD order
                if (user) {
                    await supabase.from("notifications").insert({
                        user_id: user.id,
                        title: `Pesanan Dibuat — ${orderNumber}`,
                        message: `Pesanan COD ${formatCurrency(finalTotal)} sedang diproses oleh penjual. Siapkan pembayaran tunai saat pesanan diterima.`,
                        type: "order_status",
                        action_url: "/transaksi",
                        order_id: orderData.id,
                    });
                }

                toast({ title: "Pesanan Berhasil", description: "Pesanan COD Anda sedang diproses oleh penjual." });
                onSuccess();
                onOpenChange(false);
                return;
            }

            // 5. Create Midtrans Snap token via backend
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sesi login tidak valid");

            const paymentResponse = await fetch("/api/payment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: "create-transaction",
                    order_id: orderData.id,
                    amount: finalTotal,
                    product_details: `Pesanan SnackTrack - ${items.length} item`,
                    customer_name: profile?.name || user.email?.split("@")[0] || "Customer",
                    customer_email: profile?.email || user.email || "",
                    customer_phone: phone.trim() || "",
                    item_details: [
                        ...items.map(item => ({
                            name: item.name,
                            price: item.price,
                            quantity: item.quantity,
                        })),
                        ...(adminFee > 0 ? [{ name: "Biaya Admin Platform (2%)", price: adminFee, quantity: 1 }] : []),
                    ],
                }),
            });

            if (!paymentResponse.ok) {
                const errData = await paymentResponse.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || "Gagal membuat transaksi pembayaran");
            }

            const paymentData = await paymentResponse.json();
            const snapToken = paymentData.snap_token;
            const clientKey = paymentData.client_key;

            if (!snapToken) {
                throw new Error("Tidak menerima token pembayaran dari Midtrans");
            }

            // 6. Load Snap.js and open payment popup
            await loadSnapScript(clientKey);

            if (!window.snap) {
                // Fallback to redirect URL if Snap.js failed to load
                if (paymentData.redirect_url) {
                    window.location.href = paymentData.redirect_url;
                    return;
                }
                throw new Error("Gagal memuat Midtrans Snap");
            }

            // Close checkout dialog before opening Snap popup
            onOpenChange(false);

            // Capture the orderId for use in Snap callbacks
            const currentOrderId = orderData.id;

            // Helper: fallback status sync for non-payment statuses only.
            // BUG-003 FIX: "paid" status must ONLY be set by the server-side Midtrans webhook
            // (api/payment.ts). The client may only update to "pending" or "failed" as
            // informational statuses — never "paid", to prevent payment bypass attacks.
            const fallbackStatusSync = async (expectedStatus: "pending" | "failed") => {
                try {
                    // Wait a few seconds for the webhook to arrive first
                    await new Promise(r => setTimeout(r, 5000));
                    const { data: txCheck } = await supabase
                        .from("transactions")
                        .select("payment_status")
                        .eq("order_id", currentOrderId)
                        .single();
                    const currentPaymentStatus = txCheck?.payment_status;
                    // If webhook already updated to the same status, skip
                    if (currentPaymentStatus === expectedStatus) return;
                    // Never overwrite a settled (paid) order
                    if (currentPaymentStatus === "paid") return;

                    // Webhook hasn't arrived yet — do a direct update as fallback
                    await supabase.from("transactions").update({
                        payment_status: expectedStatus,
                    }).eq("order_id", currentOrderId);

                    if (expectedStatus === "failed") {
                        await supabase.from("orders").update({
                            status: "dibatalkan",
                            updated_at: new Date().toISOString(),
                        }).eq("id", currentOrderId);
                    }
                } catch (err) {
                    console.error("Fallback status sync error:", err);
                }
            };

            window.snap.pay(snapToken, {
                onSuccess: (result: any) => {
                    console.log("Payment success:", result);
                    toast({ title: "Pembayaran Berhasil!", description: "Pesanan Anda sedang diproses oleh penjual." });
                    onSuccess();
                    navigate("/transaksi");
                    // BUG-003: "paid" status is now set exclusively by the server-side webhook.
                    // No client-side fallback for "paid" — the webhook will handle it.
                },
                onPending: (result: any) => {
                    console.log("Payment pending:", result);
                    toast({ title: "Menunggu Pembayaran", description: "Silakan selesaikan pembayaran Anda." });
                    onSuccess();
                    navigate("/transaksi");
                    fallbackStatusSync("pending");
                },
                onError: (result: any) => {
                    console.error("Payment error:", result);
                    toast({ title: "Pembayaran Gagal", description: "Terjadi kesalahan saat memproses pembayaran.", variant: "destructive" });
                    fallbackStatusSync("failed");
                },
                onClose: () => {
                    console.log("Snap popup closed");
                    toast({ title: "Pembayaran Ditutup", description: "Pesanan masih menunggu pembayaran. Buka halaman Transaksi untuk melanjutkan." });
                    onSuccess(); // Clear cart since order is already created
                    navigate("/transaksi");
                },
            });

        } catch (error: any) {
            console.error("Checkout error:", error);
            toast({
                title: "Checkout Gagal",
                description: error.message || "Terjadi kesalahan saat memproses pesanan.",
                variant: "destructive"
            });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ShoppingBag className="h-5 w-5" /> Konfirmasi Checkout
                    </DialogTitle>
                    <DialogDescription>Pilih metode pengiriman dan pembayaran Anda.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Delivery Method */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2"><Store className="h-4 w-4"/> Metode Pengiriman</Label>
                        <RadioGroup value={deliveryType} onValueChange={(v: any) => setDeliveryType(v)} className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                                <RadioGroupItem value="ambil_sendiri" id="ambil" />
                                <Label htmlFor="ambil" className="flex-1 cursor-pointer">Ambil di Toko</Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                                <RadioGroupItem value="dikirim" id="kirim" />
                                <Label htmlFor="kirim" className="flex-1 cursor-pointer flex justify-between">
                                    <span>Dikirim Kurir</span>
                                    <span className="text-muted-foreground">{formatCurrency(15000)}</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {deliveryType === "dikirim" && (
                        <div className="space-y-3 animate-fade-in pl-2 border-l-2 border-primary/20">
                            <Label className="text-base font-semibold flex items-center gap-2"><MapPin className="h-4 w-4"/> Alamat Pengiriman</Label>

                            {/* Saved address card */}
                            {!editingAddress ? (
                                <div className="rounded-lg border p-3 bg-muted/40 space-y-2">
                                    {savedAddress ? (
                                        <p className="text-sm leading-relaxed">{savedAddress}</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Belum ada alamat tersimpan</p>
                                    )}
                                    {savedPhone && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-3 w-3" />{savedPhone}
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-1"
                                        onClick={() => setEditingAddress(true)}
                                    >
                                        <Pencil className="h-3 w-3 mr-1" />
                                        {savedAddress ? "Ubah Alamat" : "Tambah Alamat"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Textarea
                                        placeholder="Masukkan alamat lengkap..."
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="resize-none h-20"
                                    />
                                    <Input
                                        placeholder="Nomor telepon (opsional)"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        type="tel"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="save-address"
                                            checked={saveAddressToProfile}
                                            onCheckedChange={(v) => setSaveAddressToProfile(!!v)}
                                        />
                                        <Label htmlFor="save-address" className="text-xs cursor-pointer">
                                            Simpan sebagai alamat default
                                        </Label>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (savedAddress) {
                                                setAddress(savedAddress);
                                                setPhone(savedPhone);
                                            }
                                            setEditingAddress(false);
                                        }}
                                    >
                                        Batal
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4"/> Metode Pembayaran</Label>
                        <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="flex flex-col gap-2">
                            <div className="flex items-center space-x-3 border p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                <RadioGroupItem value="online" id="pay-online" />
                                <Label htmlFor="pay-online" className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        <div>
                                            <span className="font-medium">Bayar Online</span>
                                            <p className="text-xs text-muted-foreground">QRIS, Transfer Bank, e-Wallet, Kartu Kredit</p>
                                        </div>
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-3 border p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                <RadioGroupItem value="cod" id="pay-cod" />
                                <Label htmlFor="pay-cod" className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4" />
                                        <div>
                                            <span className="font-medium">Bayar di Tempat (COD)</span>
                                            <p className="text-xs text-muted-foreground">Bayar tunai saat pesanan diterima</p>
                                        </div>
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Summary */}
                    <div className="bg-muted/50 p-4 rounded-xl space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Item ({items.length})</span>
                            <span>{formatCurrency(totalItemPrice)}</span>
                        </div>
                        {deliveryType === "dikirim" && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ongkos Kirim</span>
                                <span>{formatCurrency(deliveryFee)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Biaya Admin (2%)</span>
                            <span>{formatCurrency(adminFee)}</span>
                        </div>
                        <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-base">
                            <span>Total Pembayaran</span>
                            <span className="text-primary">{formatCurrency(finalTotal)}</span>
                        </div>
                    </div>

                    {/* Midtrans info note */}
                    {paymentMethod === "online" && (
                        <p className="text-xs text-muted-foreground text-center">
                            Pembayaran diproses secara aman melalui Midtrans. Pilih metode pembayaran di halaman berikutnya.
                        </p>
                    )}
                </div>

                <DialogFooter className="sm:justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCheckingOut}>
                        Batal
                    </Button>
                    <Button onClick={handleConfirm} disabled={isCheckingOut}>
                        {isCheckingOut ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memproses...</>
                        ) : paymentMethod === "cod" ? (
                            "Buat Pesanan"
                        ) : (
                            "Bayar Sekarang"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
