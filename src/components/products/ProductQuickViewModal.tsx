import { useState, useRef, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, X, ImageIcon, Trash2 } from "lucide-react";
import type { Product } from "@/types/product";

// IDR formatting helpers
const formatIDR = (value: string | number): string => {
    const raw = String(value).replace(/\D/g, "");
    if (!raw) return "";
    return new Intl.NumberFormat("id-ID").format(Number(raw));
};

const parseIDR = (formatted: string): number => {
    const raw = formatted.replace(/\D/g, "");
    return Number(raw) || 0;
};

interface ProductQuickViewModalProps {
    product: Product | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updated: Product) => void;
    onDelete?: (productId: string) => void;
    categories: string[];
}

export function ProductQuickViewModal({ product, open, onOpenChange, onSave, onDelete, categories }: ProductQuickViewModalProps) {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const [price, setPrice] = useState(""); // stored as formatted IDR string (e.g. "15.000")
    const [stock, setStock] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [customImage, setCustomImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (product) {
            setName(product.name);
            // If the product has a category not in the passed list, treat it as custom
            const knownCats = categories.filter(c => c !== "All");
            if (product.category && !knownCats.includes(product.category)) {
                setCategory("__custom__");
                setCustomCategory(product.category);
            } else {
                setCategory(product.category);
                setCustomCategory("");
            }
            setPrice(product.price ? formatIDR(product.price) : "");
            setStock(product.stock.toString());
            setDescription(product.description);
            setImageUrl(product.image);
            setCustomImage(null);
            setShowDeleteConfirm(false);
            setDeleteConfirmText("");
        }
    }, [product, categories]);

    const displayImage = customImage || imageUrl;

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => setCustomImage(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileSelect(file); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleRemoveImage = () => { setCustomImage(null); setImageUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        setPrice(raw ? formatIDR(raw) : "");
    };

    const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) {
            setStock("0");
        } else {
            setStock(val.toString());
        }
    };

    const handleSave = () => {
        if (!product) return;
        const parsedPrice = parseIDR(price);
        const parsedStock = Math.max(0, parseInt(stock, 10) || 0);
        const finalCategory = category === "__custom__" ? customCategory.trim() : category;
        onSave({ ...product, name, category: finalCategory, price: parsedPrice, stock: parsedStock, description, image: customImage || imageUrl });
        onOpenChange(false);
    };

    const handleDelete = () => {
        if (!product || !onDelete) return;
        if (deleteConfirmText === "HAPUS") {
            onDelete(product.id.toString());
        }
    };

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle className="text-xl font-bold">{product?.id ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">{product?.id ? "Lihat dan edit detail produk Anda" : "Tambahkan produk baru ke toko Anda"}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-6 py-4">
                    {/* Left — Image & Upload */}
                    <div className="flex flex-col gap-4">
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
                            {displayImage ? (
                                <>
                                    <img src={displayImage} alt={name} className="h-full w-full object-cover" />
                                    <button onClick={handleRemoveImage} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md" aria-label="Hapus gambar">
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-16 w-16 mb-2 opacity-40" />
                                    <p className="text-sm">Belum ada gambar</p>
                                </div>
                            )}
                        </div>

                        <div className={`relative rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Unggah gambar atau seret dan lepas di dalam kotak tersebut</p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Disarankan: 500 × 500 px (rasio 1:1, maks 2 MB)</p>
                    </div>

                    {/* Right — Form */}
                    <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="qv-name" className="text-sm font-medium">Nama Produk</Label>
                            <Input id="qv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama produk" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qv-category" className="text-sm font-medium">Kategori</Label>
                            <Select value={category} onValueChange={(val) => { setCategory(val); if (val !== "__custom__") setCustomCategory(""); }}>
                                <SelectTrigger id="qv-category"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                <SelectContent>
                                    {categories.filter((c) => c !== "All").map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    <SelectItem value="__custom__">Lainnya (Kustom)</SelectItem>
                                </SelectContent>
                            </Select>
                            {category === "__custom__" && (
                                <Input
                                    placeholder="Ketik nama kategori baru"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    className="mt-2"
                                    autoFocus
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qv-price" className="text-sm font-medium">Harga</Label>
                            <div className="flex items-stretch">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground font-medium select-none">Rp</span>
                                <Input id="qv-price" type="text" inputMode="numeric" value={price} onChange={handlePriceChange} placeholder="0" className="rounded-l-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qv-stock" className="text-sm font-medium">Stok</Label>
                            <Input id="qv-stock" type="number" min="0" value={stock} onChange={handleStockChange} placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qv-desc" className="text-sm font-medium">Deskripsi</Label>
                            <Textarea id="qv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Masukkan deskripsi produk" rows={4} />
                        </div>
                    </div>
                </div>

                {showDeleteConfirm && (
                    <div className="px-6 py-4 mx-6 mb-4 rounded-xl border border-destructive bg-destructive/10">
                        <Label className="text-destructive font-semibold mb-2 block">
                            Konfirmasi Hapus Produk
                        </Label>
                        <p className="text-sm text-muted-foreground mb-3">
                            Ketik <span className="font-bold text-foreground">HAPUS</span> di bawah ini untuk mengonfirmasi.
                        </p>
                        <div className="flex gap-2">
                            <Input 
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="HAPUS"
                                className="max-w-[150px] sm:max-w-[200px]"
                            />
                            <Button 
                                variant="destructive" 
                                disabled={deleteConfirmText !== "HAPUS"}
                                onClick={handleDelete}
                            >
                                Hapus Secara Permanen
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmText("");
                                }}
                            >
                                Batal
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:justify-between items-center px-6 pb-6 pt-2 border-t border-border">
                    {product.id && onDelete ? (
                        <div className="w-full sm:w-auto mb-2 sm:mb-0">
                            <Button 
                                variant="ghost" 
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={showDeleteConfirm}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Hapus Produk
                            </Button>
                        </div>
                    ) : <div />}

                    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Batal</Button>
                        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">Simpan Perubahan</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
