import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { UploadCloud, Image as ImageIcon, X, Loader2, Link2, Sparkles } from "lucide-react";

interface BlogCoverImageUploadProps {
    value: string;
    onChange: (url: string) => void;
}

export const BlogCoverImageUpload: React.FC<BlogCoverImageUploadProps> = ({
    value,
    onChange,
}) => {
    const [uploading, setUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `covers/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

        try {
            // Compress image for optimal web performance
            let fileToUpload = file;
            try {
                fileToUpload = await imageCompression(file, {
                    maxSizeMB: 0.6, // max 600KB
                    maxWidthOrHeight: 1600, // sharp 1600px width
                    useWebWorker: true,
                });
            } catch (cErr) {
                console.warn("Compression skipped:", cErr);
            }

            const { error: uploadError } = await supabase.storage
                .from("blog-images")
                .upload(fileName, fileToUpload, {
                    contentType: file.type || "image/jpeg",
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from("blog-images")
                .getPublicUrl(fileName);

            if (publicData?.publicUrl) {
                onChange(publicData.publicUrl);
                toast.success("Cover image uploaded to Supabase Storage!");
            }
        } catch (err: any) {
            toast.error(`Upload error: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Cover Hero Image
                </Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                >
                    <Link2 className="h-3.5 w-3.5" />
                    {showUrlInput ? "Hide Direct URL" : "Paste URL"}
                </Button>
            </div>

            {/* Visual Preview / Upload Dropzone */}
            {value ? (
                <div className="relative group rounded-xl overflow-hidden border bg-muted/30 aspect-[21/9] max-h-56 shadow-sm">
                    <img
                        src={value}
                        alt="Blog Cover Preview"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="text-xs gap-1.5 font-semibold"
                        >
                            {uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <UploadCloud className="h-3.5 w-3.5" />
                            )}
                            Replace Image
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => onChange("")}
                            className="text-xs gap-1.5 font-semibold"
                        >
                            <X className="h-3.5 w-3.5" />
                            Remove
                        </Button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        uploading
                            ? "border-primary bg-primary/5 cursor-wait"
                            : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-xs font-semibold text-foreground">
                                Uploading to Supabase Cloud Storage...
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                                <UploadCloud className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                                Click to upload cover image from computer
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PNG, JPG, WEBP up to 10MB (automatically optimized & stored in Supabase)
                            </p>
                        </div>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
            />

            {/* Optional URL Fallback */}
            {showUrlInput && (
                <div className="pt-1">
                    <Input
                        placeholder="https://images.unsplash.com/... or cloud storage URL"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="text-xs font-mono"
                    />
                </div>
            )}
        </div>
    );
};

export default BlogCoverImageUpload;
