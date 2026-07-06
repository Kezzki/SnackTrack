import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    bucket: "profile-images" | "shop" | "profile picture";
    currentUrl?: string;
    onUpload: (url: string) => void;
    className?: string;
    label?: string;
    required?: boolean;
}

export function ImageUpload({ bucket, currentUrl, onUpload, className, label, required }: ImageUploadProps) {
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(async (file: File) => {
        if (!user) return;
        setUploading(true);

        try {
            const ext = file.name.split(".").pop();
            const path = `${user.id}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(path, file, { cacheControl: "3600", upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            setPreview(data.publicUrl);
            onUpload(data.publicUrl);
        } catch (err) {
            console.error("Upload error:", err);
        } finally {
            setUploading(false);
        }
    }, [bucket, user, onUpload]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) uploadFile(file);
    };

    const handleRemove = () => {
        setPreview(null);
        onUpload("");
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-sm font-medium text-foreground">
                    {label} {required && <span className="text-destructive">*</span>}
                </label>
            )}
            <div
                className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer",
                    dragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                    preview && "p-2"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Mengunggah...</span>
                    </div>
                ) : preview ? (
                    <div className="relative w-full">
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-40 object-cover rounded-lg"
                        />
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 rounded-full"
                            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                                <Upload className="inline h-4 w-4 mr-1" />
                                Klik atau seret gambar
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG hingga 5MB</p>
                        </div>
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
}
