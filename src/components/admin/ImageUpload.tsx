import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

/**
 * Simple image uploader that stores files in Supabase Storage bucket "product-images".
 * Returns the public URL of the uploaded image.
 */
export const ImageUpload = ({
    onUpload,
    existingUrl = "",
}: {
    onUpload: (url: string) => void;
    existingUrl?: string;
}) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const bucket = "product-images";

        setUploading(true);
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                upsert: false,
                cacheControl: "3600",
                onUploadProgress: (p) => setProgress(Math.round(p.percent)),
            });

        if (error) {
            toast.error(`Upload failed: ${error.message}`);
            setUploading(false);
            return;
        }

        // Get public URL
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        const url = publicData?.publicUrl || "";
        onUpload(url);
        toast.success("Image uploaded");
        setUploading(false);
        setProgress(0);
    };

    return (
        <div className="space-y-2">
            {existingUrl && (
                <img src={existingUrl} alt="Current" className="h-24 w-24 object-cover rounded" />
            )}
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {uploading && <Progress value={progress} className="w-full" />}
        </div>
    );
};
