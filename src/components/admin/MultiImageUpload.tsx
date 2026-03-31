import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { X, Image as ImageIcon, GripVertical, Star } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MultiImageUploadProps {
    urls: string[];
    onUpload: (urls: string[]) => void;
}

interface SortableImageProps {
    url: string;
    onRemove: (url: string) => void;
    isPrimary: boolean;
    onMakePrimary: (url: string) => void;
}

const SortableImage = ({ url, onRemove, isPrimary, onMakePrimary }: SortableImageProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: url });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group border rounded-lg overflow-hidden bg-muted aspect-square"
        >
            <img src={url} alt="Product" className="w-full h-full object-cover" />
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 bg-white/20 rounded-full hover:bg-white/40">
                    <GripVertical className="h-4 w-4 text-white" />
                </div>
                <button
                    type="button"
                    onClick={() => onMakePrimary(url)}
                    className={`p-1.5 rounded-full transition-colors ${isPrimary ? 'bg-yellow-500 text-white' : 'bg-white/20 text-white hover:bg-white/40'}`}
                    title={isPrimary ? "Primary Image" : "Make Primary"}
                >
                    <Star className={`h-4 w-4 ${isPrimary ? 'fill-current' : ''}`} />
                </button>
                <button
                    type="button"
                    onClick={() => onRemove(url)}
                    className="p-1.5 bg-destructive/80 rounded-full text-white hover:bg-destructive"
                    title="Remove"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {isPrimary && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    PRIMARY
                </div>
            )}
        </div>
    );
};

export const MultiImageUpload = ({ urls = [], onUpload }: MultiImageUploadProps) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const newUrls = [...urls];
        const bucket = "product-images";

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${crypto.randomUUID()}.${fileExt}`;

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, file, {
                        upsert: false,
                        cacheControl: "3600",
                    });

                if (error) {
                    toast.error(`Upload failed for ${file.name}: ${error.message}`);
                    continue;
                }

                const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
                if (publicData?.publicUrl) {
                    newUrls.push(publicData.publicUrl);
                }
                setProgress(Math.round(((i + 1) / files.length) * 100));
            }

            onUpload(newUrls);
            toast.success("Images uploaded successfully");
        } catch (error: any) {
            toast.error(`Error uploading images: ${error.message}`);
        } finally {
            setUploading(false);
            setProgress(0);
            e.target.value = ''; // Reset input
        }
    };

    const handleRemove = (urlToRemove: string) => {
        onUpload(urls.filter(url => url !== urlToRemove));
    };

    const handleMakePrimary = (url: string) => {
        // Move to first position
        const index = urls.indexOf(url);
        if (index > 0) {
            const newUrls = [url, ...urls.filter(u => u !== url)];
            onUpload(newUrls);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = urls.indexOf(active.id as string);
            const newIndex = urls.indexOf(over.id as string);
            onUpload(arrayMove(urls, oldIndex, newIndex));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Product Gallery</span>
                <label className={`
                    cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors 
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
                    disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Add Images'}
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="hidden"
                    />
                </label>
            </div>

            {uploading && (
                <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <p className="text-[10px] text-center text-muted-foreground">{progress}% uploaded</p>
                </div>
            )}

            {urls.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={urls}
                        strategy={horizontalListSortingStrategy}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {urls.map((url, index) => (
                                <SortableImage
                                    key={url}
                                    url={url}
                                    onRemove={handleRemove}
                                    isPrimary={index === 0}
                                    onMakePrimary={handleMakePrimary}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No images uploaded yet</p>
                    <p className="text-xs">Upload up to 10 images. First image will be primary.</p>
                </div>
            )}
        </div>
    );
};
