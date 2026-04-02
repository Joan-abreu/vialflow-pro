import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
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
    Rows as RowsIcon
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
    LineHeight,
];

const RichTextEditor = ({ content, onChange, editable = true }: RichTextEditorProps) => {
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
