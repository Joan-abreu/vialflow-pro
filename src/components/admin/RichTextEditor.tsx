import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import CustomImage from '@/components/admin/CustomImageExtension';
import { supabase } from '@/integrations/supabase/client';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    Undo,
    Redo,
    Link as LinkIcon,
    AlignCenter,
    AlignLeft,
    AlignRight,
    AlignJustify,
    Type,
    ChevronDown,
    Rows as RowsIcon,
    Image as ImageIcon,
    UploadCloud,
    Loader2
} from 'lucide-react';
import { RICH_TEXT_STYLES } from '@/lib/rich-text-styles';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (lineHeight: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

// Custom Line Height Extension
const LineHeight = Extension.create({
    name: 'lineHeight',
    addOptions() {
        return {
            types: ['paragraph', 'heading'],
            defaultLineHeight: 'normal',
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: this.options.defaultLineHeight,
                        parseHTML: element => element.style.lineHeight || this.options.defaultLineHeight,
                        renderHTML: attributes => {
                            if (attributes.lineHeight === this.options.defaultLineHeight) {
                                return {};
                            }
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setLineHeight: (lineHeight: string) => ({ commands }) => {
                return this.options.types.every(type => commands.updateAttributes(type, { lineHeight }));
            },
            unsetLineHeight: () => ({ commands }) => {
                return this.options.types.every(type => commands.updateAttributes(type, { lineHeight: this.options.defaultLineHeight }));
            },
        } as any;
    },
});

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

const defaultExtensions = [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    TextAlign.configure({
        types: ['heading', 'paragraph'],
    }),
    Link.configure({
        openOnClick: false,
        HTMLAttributes: {
            class: 'text-primary underline',
        },
    }),
    CustomImage.configure({
        inline: false,
        allowBase64: false,
    }),
    LineHeight,
];

const RichTextEditor = ({ content, onChange, editable = true }: RichTextEditorProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const editor = useEditor({
        extensions: defaultExtensions,
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `${RICH_TEXT_STYLES.replace(/\s+/g, ' ').trim()} m-5 focus:outline-none min-h-[250px]`,
            },
        },
    });

    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor) return;

        setUploadingImage(true);
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `content/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

        try {
            toast.info("Uploading image to Supabase cloud storage...");
            let fileToUpload = file;
            try {
                fileToUpload = await imageCompression(file, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true,
                });
            } catch (compErr) {
                console.warn("Compression skipped:", compErr);
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
                editor.chain().focus().setImage({ src: publicData.publicUrl, alt: file.name }).run();
                toast.success("Image uploaded and inserted into article!");
            }
        } catch (err: any) {
            toast.error(`Image upload failed: ${err.message}`);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleInsertImageUrl = () => {
        if (!editor) return;
        const url = window.prompt('Enter Image URL:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    if (!editor) {
        return null;
    }

    if (!editable) {
        return <EditorContent editor={editor} />;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    const colors = [
        { name: 'Default', value: 'inherit' },
        { name: 'Primary', value: '#1E40AF' },
        { name: 'Red', value: '#EF4444' },
        { name: 'Green', value: '#10B981' },
        { name: 'Amber', value: '#F59E0B' },
        { name: 'Gray', value: '#6B7280' },
    ];

    const lineHeights = [
        { name: 'Small', value: '1.2' },
        { name: 'Normal', value: '1.5' },
        { name: 'Large', value: '1.8' },
        { name: 'Extra Large', value: '2.2' },
    ];

    return (
        <div className="border rounded-md overflow-hidden bg-background flex flex-col h-full">
            <div className="bg-muted p-2 border-b flex flex-wrap gap-1 sticky top-0 z-10">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Bold"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Italic"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Underline"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                            <Type className="h-4 w-4" />
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {colors.map((color) => (
                            <DropdownMenuItem
                                key={color.value}
                                onClick={() => editor.chain().focus().setColor(color.value).run()}
                                className="flex items-center gap-2"
                            >
                                <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.value === 'inherit' ? 'transparent' : color.value }} />
                                {color.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={editor.isActive({ textAlign: 'left' }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Align Left"
                >
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Align Center"
                >
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Align Right"
                >
                    <AlignRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    className={editor.isActive({ textAlign: 'justify' }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Align Justify"
                >
                    <AlignJustify className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1" title="Line Height">
                            <RowsIcon className="h-4 w-4" />
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {lineHeights.map((lh) => (
                            <DropdownMenuItem
                                key={lh.value}
                                onClick={() => (editor.commands as any).setLineHeight(lh.value)}
                            >
                                {lh.name} ({lh.value})
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onClick={() => (editor.commands as any).unsetLineHeight()}>
                            Default
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Heading 1"
                >
                    <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Heading 2"
                >
                    <Heading2 className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Ordered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={setLink}
                    className={editor.isActive('link') ? 'bg-accent text-accent-foreground' : ''}
                    type="button"
                    title="Link"
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>

                {/* Image Upload Dropdown Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            title="Insert Image"
                            disabled={uploadingImage}
                            className="gap-1 text-primary hover:bg-primary/10"
                        >
                            {uploadingImage ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ImageIcon className="h-4 w-4" />
                            )}
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer gap-2"
                        >
                            <UploadCloud className="h-4 w-4 text-primary" />
                            Upload from Computer (Supabase)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleInsertImageUrl}
                            className="cursor-pointer gap-2"
                        >
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            Insert via Image URL
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                    disabled={uploadingImage}
                />

                <div className="w-px h-6 bg-border mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    type="button"
                    title="Undo"
                >
                    <Undo className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    type="button"
                    title="Redo"
                >
                    <Redo className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default RichTextEditor;
