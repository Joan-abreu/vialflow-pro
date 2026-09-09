import React, { useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';
import { supabase } from '@/integrations/supabase/client';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import {
    Trash2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Maximize2,
    Minimize2,
    UploadCloud,
    Loader2,
    Check
} from 'lucide-react';
import { toast } from 'sonner';

// Custom Interactive NodeView for TipTap Images
const ImageNodeView: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    deleteNode,
    selected,
    editor,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const alignment = node.attrs.alignment || 'center';
    const size = node.attrs.size || 'full';
    const src = node.attrs.src;
    const alt = node.attrs.alt || '';

    // Handle image replacement from computer
    const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `content/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

        try {
            toast.info("Uploading replacement image...");
            let fileToUpload = file;
            try {
                fileToUpload = await imageCompression(file, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true,
                });
            } catch (cErr) {
                console.warn("Compression skipped:", cErr);
            }

            const { error: uploadError } = await supabase.storage
                .from('blog-images')
                .upload(fileName, fileToUpload, {
                    contentType: file.type || 'image/png',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('blog-images')
                .getPublicUrl(fileName);

            if (publicData?.publicUrl) {
                updateAttributes({ src: publicData.publicUrl, alt: file.name });
                toast.success("Image replaced successfully!");
            }
        } catch (err: any) {
            toast.error(`Replace error: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Container alignment styles
    const alignmentClass =
        alignment === 'left'
            ? 'mr-auto block text-left'
            : alignment === 'right'
            ? 'ml-auto block text-right'
            : 'mx-auto block text-center';

    // Image sizing styles
    const sizeClass =
        size === 'small'
            ? 'max-w-xs md:max-w-sm'
            : size === 'medium'
            ? 'max-w-md md:max-w-xl'
            : 'w-full max-w-full';

    const isEditable = editor.isEditable;

    return (
        <NodeViewWrapper className={`my-8 relative group ${alignmentClass}`}>
            <div className={`inline-block relative rounded-xl overflow-hidden border transition-all duration-200 ${
                selected ? 'ring-2 ring-primary border-primary shadow-lg' : 'border-border/60 hover:border-primary/40 shadow-md'
            } ${sizeClass}`}>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto object-cover max-h-[550px] rounded-xl block"
                    loading="lazy"
                />

                {/* Interactive Controls Overlay for Editor */}
                {isEditable && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/95 backdrop-blur-md border border-border/80 p-1.5 rounded-lg shadow-lg opacity-90 group-hover:opacity-100 transition-opacity z-20">
                        {/* Size Controls */}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-2 text-[11px] font-bold ${size === 'small' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ size: 'small' })}
                            title="Small width (50%)"
                        >
                            S
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-2 text-[11px] font-bold ${size === 'medium' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ size: 'medium' })}
                            title="Medium width (75%)"
                        >
                            M
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-2 text-[11px] font-bold ${size === 'full' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ size: 'full' })}
                            title="Full width (100%)"
                        >
                            Full
                        </Button>

                        <div className="w-px h-4 bg-border mx-1" />

                        {/* Alignment Controls */}
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${alignment === 'left' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ alignment: 'left' })}
                            title="Align Left"
                        >
                            <AlignLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${alignment === 'center' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ alignment: 'center' })}
                            title="Align Center"
                        >
                            <AlignCenter className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${alignment === 'right' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                            onClick={() => updateAttributes({ alignment: 'right' })}
                            title="Align Right"
                        >
                            <AlignRight className="h-3.5 w-3.5" />
                        </Button>

                        <div className="w-px h-4 bg-border mx-1" />

                        {/* Replace Image Button */}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            title="Replace Image"
                        >
                            {uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <UploadCloud className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Replace</span>
                        </Button>

                        {/* Delete Image Button */}
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs font-semibold gap-1 ml-1"
                            onClick={() => {
                                deleteNode();
                                toast.success("Image deleted from article");
                            }}
                            title="Delete Image from Article"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                        </Button>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReplaceImage}
                disabled={uploading}
            />
        </NodeViewWrapper>
    );
};

// Custom TipTap Image Extension with NodeView and Figure parsing
export const CustomImage = Image.extend({
    name: 'image',

    addAttributes() {
        return {
            ...this.parent?.(),
            alignment: {
                default: 'center',
                parseHTML: (element) => element.getAttribute('data-alignment') || 'center',
                renderHTML: (attributes) => ({
                    'data-alignment': attributes.alignment,
                }),
            },
            size: {
                default: 'full',
                parseHTML: (element) => element.getAttribute('data-size') || 'full',
                renderHTML: (attributes) => ({
                    'data-size': attributes.size,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'img[src]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    return {
                        src: el.getAttribute('src'),
                        alt: el.getAttribute('alt'),
                        title: el.getAttribute('title'),
                        alignment: el.getAttribute('data-alignment') || 'center',
                        size: el.getAttribute('data-size') || 'full',
                    };
                },
            },
            {
                tag: 'figure',
                getAttrs: (element) => {
                    const img = (element as HTMLElement).querySelector('img');
                    if (!img) return false;
                    return {
                        src: img.getAttribute('src'),
                        alt: img.getAttribute('alt'),
                        title: img.getAttribute('title'),
                        alignment: 'center',
                        size: 'full',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { alignment, size, ...rest } = HTMLAttributes;

        let alignClass = 'mx-auto block';
        if (alignment === 'left') alignClass = 'mr-auto block';
        if (alignment === 'right') alignClass = 'ml-auto block';

        let sizeClass = 'w-full max-h-[550px]';
        if (size === 'small') sizeClass = 'max-w-xs md:max-w-sm mx-auto block max-h-[350px]';
        if (size === 'medium') sizeClass = 'max-w-md md:max-w-xl mx-auto block max-h-[450px]';

        return [
            'img',
            mergeAttributes(rest, {
                class: `rounded-xl shadow-md my-8 object-cover border border-border/60 ${alignClass} ${sizeClass}`,
                'data-alignment': alignment || 'center',
                'data-size': size || 'full',
            }),
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },
});

export default CustomImage;
