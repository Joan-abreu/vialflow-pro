import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlogPost, BlogPostInput, BLOG_CATEGORIES, BlogCategory } from "@/types/blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/admin/RichTextEditor";
import BlogCoverImageUpload from "@/components/admin/BlogCoverImageUpload";
import { downloadSitemapXML } from "@/utils/sitemapGenerator";
import {
    BookOpen,
    Plus,
    Edit,
    Trash2,
    ExternalLink,
    Eye,
    Download,
    Search,
    Lock,
    Unlock,
    Sparkles,
    Smartphone,
    Monitor,
    Clock,
    FileText,
    Calendar,
    Globe,
    CheckCircle2,
    Image as ImageIcon,
    UploadCloud
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import { toast } from "sonner";

const initialFormState: BlogPostInput = {
    title: "",
    slug: "",
    excerpt: "",
    content: "<h2>Introduction</h2><p>Provide educational and laboratory context here...</p>",
    cover_image_url: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=1200&auto=format&fit=crop",
    category: "Reconstitution Protocols",
    tags: ["bacteriostatic water", "reconstitution", "laboratory"],
    author_name: "Liv Well Scientific Communications",
    author_role: "Laboratory Research Team",
    author_avatar_url: "/placeholder.svg",
    reading_time_minutes: 5,
    is_published: false,
    published_at: null,
    seo_title: "",
    seo_description: "",
    seo_keywords: [],
    featured_product_ids: [],
};

const BlogManagement = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [formData, setFormData] = useState<BlogPostInput>(initialFormState);
    const [isSlugLocked, setIsSlugLocked] = useState(true);
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
    const [tagInput, setTagInput] = useState("");
    const [keywordInput, setKeywordInput] = useState("");

    // Delete confirmation dialog
    const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);

    // Detect all images in formData.content
    const detectedImages = useMemo(() => {
        if (!formData.content) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(formData.content, "text/html");
        const imgEls = Array.from(doc.querySelectorAll("img"));
        return imgEls
            .map((img, idx) => ({
                index: idx,
                src: img.getAttribute("src") || "",
                alt: img.getAttribute("alt") || `Article Image ${idx + 1}`,
            }))
            .filter((img) => Boolean(img.src));
    }, [formData.content]);

    // Delete image from article body content
    const handleDeleteImageFromContent = (srcToDelete: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(formData.content, "text/html");
        let removed = 0;
        doc.querySelectorAll(`img[src="${srcToDelete}"]`).forEach((img) => {
            if (img.parentElement && img.parentElement.tagName.toLowerCase() === "figure") {
                img.parentElement.remove();
            } else {
                img.remove();
            }
            removed++;
        });
        setFormData((prev) => ({ ...prev, content: doc.body.innerHTML }));
        toast.success(`Removed ${removed} image from article content`);
    };

    // Upload & append image to article body content
    const handleUploadImageToContent = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
                const imgHtml = `<p><img src="${publicData.publicUrl}" alt="${file.name}" class="rounded-xl shadow-md my-8 mx-auto block w-full border border-border/60" /></p>`;
                setFormData(prev => ({
                    ...prev,
                    content: (prev.content || "") + imgHtml
                }));
                toast.success("Image uploaded and appended to article content!");
            }
        } catch (err: any) {
            toast.error(`Image upload failed: ${err.message}`);
        }
    };

    // Fetch all blog posts for backoffice
    const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
        queryKey: ["admin-blog-posts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("blog_posts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as BlogPost[];
        },
    });

    // Fetch store products to allow embedding
    const { data: storeProducts = [] } = useQuery({
        queryKey: ["admin-store-products-selector"],
        queryFn: async () => {
            const { data } = await supabase
                .from("products")
                .select("id, name, slug, price")
                .eq("status", "active")
                .order("name");
            return data || [];
        },
    });

    // Stats calculations
    const stats = useMemo(() => {
        const total = posts.length;
        const published = posts.filter((p) => p.is_published).length;
        const drafts = total - published;
        const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);
        return { total, published, drafts, totalViews };
    }, [posts]);

    // Filtered list
    const filteredPosts = useMemo(() => {
        return posts.filter((p) => {
            const matchesSearch =
                !searchQuery ||
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.slug.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "published" && p.is_published) ||
                (statusFilter === "draft" && !p.is_published);

            const matchesCategory =
                categoryFilter === "all" || p.category === categoryFilter;

            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [posts, searchQuery, statusFilter, categoryFilter]);

    // Auto-generate slug from title
    const handleTitleChange = (newTitle: string) => {
        if (isSlugLocked && !editingPostId) {
            const generatedSlug = newTitle
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setFormData((prev) => ({
                ...prev,
                title: newTitle,
                slug: generatedSlug,
            }));
        } else {
            setFormData((prev) => ({ ...prev, title: newTitle }));
        }
    };

    // Open create dialog
    const handleOpenCreate = () => {
        setEditingPostId(null);
        setFormData(initialFormState);
        setIsSlugLocked(true);
        setTagInput("");
        setKeywordInput("");
        setIsDialogOpen(true);
    };

    // Open edit dialog
    const handleOpenEdit = (post: BlogPost) => {
        setEditingPostId(post.id);
        setFormData({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt || "",
            content: post.content,
            cover_image_url: post.cover_image_url || "",
            category: post.category,
            tags: post.tags || [],
            author_name: post.author_name,
            author_role: post.author_role,
            author_avatar_url: post.author_avatar_url || "/placeholder.svg",
            reading_time_minutes: post.reading_time_minutes || 5,
            is_published: post.is_published,
            published_at: post.published_at,
            seo_title: post.seo_title || "",
            seo_description: post.seo_description || "",
            seo_keywords: post.seo_keywords || [],
            featured_product_ids: post.featured_product_ids || [],
        });
        setIsSlugLocked(false);
        setTagInput(post.tags ? post.tags.join(", ") : "");
        setKeywordInput(post.seo_keywords ? post.seo_keywords.join(", ") : "");
        setIsDialogOpen(true);
    };

    // Save Mutation (Create / Update)
    const saveMutation = useMutation({
        mutationFn: async (payload: BlogPostInput) => {
            const tags = tagInput
                ? tagInput.split(",").map((t) => t.trim()).filter(Boolean)
                : payload.tags;

            const seo_keywords = keywordInput
                ? keywordInput.split(",").map((k) => k.trim()).filter(Boolean)
                : payload.seo_keywords;

            const finalPayload = {
                ...payload,
                tags,
                seo_keywords,
                published_at: payload.is_published
                    ? payload.published_at || new Date().toISOString()
                    : null,
            };

            if (editingPostId) {
                const { error } = await supabase
                    .from("blog_posts")
                    .update(finalPayload)
                    .eq("id", editingPostId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("blog_posts")
                    .insert([finalPayload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
            queryClient.invalidateQueries({ queryKey: ["public-blog-posts"] });
            toast.success(
                editingPostId
                    ? "Article updated successfully!"
                    : "Article created successfully!"
            );
            setIsDialogOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save article");
        },
    });

    // Quick toggle published status
    const togglePublishMutation = useMutation({
        mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
            const { error } = await supabase
                .from("blog_posts")
                .update({
                    is_published,
                    published_at: is_published ? new Date().toISOString() : null,
                })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
            queryClient.invalidateQueries({ queryKey: ["public-blog-posts"] });
            toast.success(
                variables.is_published ? "Article published live!" : "Article moved to draft"
            );
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update publication status");
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("blog_posts")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
            queryClient.invalidateQueries({ queryKey: ["public-blog-posts"] });
            toast.success("Article deleted successfully");
            setDeletingPost(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete article");
        },
    });

    // Character counter helpers
    const seoTitleLength = (formData.seo_title || formData.title).length;
    const seoDescLength = (formData.seo_description || formData.excerpt || "").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <BookOpen className="h-7 w-7 text-primary" />
                        Blog & SEO Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Publish laboratory protocols, manage SEO meta tags, and drive organic research traffic.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            downloadSitemapXML();
                            toast.success("Downloaded sitemap.xml");
                        }}
                        className="gap-1.5"
                    >
                        <Download className="h-4 w-4" /> Download Sitemap.xml
                    </Button>
                    <Button onClick={handleOpenCreate} className="gap-1.5 font-semibold">
                        <Plus className="h-4 w-4" /> New Article
                    </Button>
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs font-semibold">Total Articles</CardDescription>
                        <CardTitle className="text-2xl font-bold">{stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Published Live
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.published}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Drafts
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {stats.drafts}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-xs font-semibold">Total Article Reads</CardDescription>
                        <CardTitle className="text-2xl font-bold flex items-center gap-1.5">
                            <Eye className="h-5 w-5 text-muted-foreground" />
                            {stats.totalViews}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filter & Search Bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search articles by title or slug..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-sm"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {BLOG_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="draft">Drafts</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Articles Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[45%]">Article</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Views</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        Loading articles...
                                    </TableCell>
                                </TableRow>
                            ) : filteredPosts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No articles found. Click "New Article" to create your first protocol.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPosts.map((post) => (
                                    <TableRow key={post.id} className="hover:bg-muted/40">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={
                                                        post.cover_image_url ||
                                                        "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=200&auto=format&fit=crop"
                                                    }
                                                    alt={post.title}
                                                    className="w-14 h-10 object-cover rounded border shrink-0 bg-muted"
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-foreground text-sm truncate max-w-md">
                                                        {post.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-sm">
                                                        /blog/{post.slug}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-xs">
                                                {post.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={post.is_published}
                                                    onCheckedChange={(checked) =>
                                                        togglePublishMutation.mutate({
                                                            id: post.id,
                                                            is_published: checked,
                                                        })
                                                    }
                                                />
                                                <span className="text-xs font-medium">
                                                    {post.is_published ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                            Published
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Draft</span>
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-xs font-semibold">
                                            {post.views_count}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {post.published_at
                                                ? format(new Date(post.published_at), "MMM d, yyyy")
                                                : format(new Date(post.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {post.is_published && (
                                                    <a
                                                        href={`/blog/${post.slug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                                        title="View live post"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleOpenEdit(post)}
                                                    title="Edit post"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => setDeletingPost(post)}
                                                    title="Delete post"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create / Edit Article Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {editingPostId ? "Edit Article & SEO" : "Create New Protocol Article"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure content, meta tags, and structured data to dominate search rankings.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="content" className="w-full">
                        <TabsList className="grid grid-cols-4 mb-4">
                            <TabsTrigger value="content" className="flex items-center gap-1.5 text-xs">
                                <FileText className="h-4 w-4" /> Content & Editor
                            </TabsTrigger>
                            <TabsTrigger value="media" className="flex items-center gap-1.5 text-xs">
                                <ImageIcon className="h-4 w-4" /> Media & Images
                                {detectedImages.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-4 ml-1">
                                        {detectedImages.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="seo" className="flex items-center gap-1.5 text-xs">
                                <Globe className="h-4 w-4" /> Google SEO & SERP
                            </TabsTrigger>
                            <TabsTrigger value="products" className="flex items-center gap-1.5 text-xs">
                                <Sparkles className="h-4 w-4" /> Product Links
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Content & Info */}
                        <TabsContent value="content" className="space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <Label htmlFor="title" className="text-xs font-bold">
                                    Article Title *
                                </Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Bacteriostatic Water vs. Sterile Water: The Definitive Laboratory Guide"
                                    value={formData.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="font-medium"
                                />
                            </div>

                            {/* Slug */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="slug" className="text-xs font-bold">
                                        URL Slug (Permanent SEO identifier) *
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => setIsSlugLocked(!isSlugLocked)}
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                    >
                                        {isSlugLocked ? (
                                            <>
                                                <Lock className="h-3 w-3" /> Auto-sync with title
                                            </>
                                        ) : (
                                            <>
                                                <Unlock className="h-3 w-3 text-amber-500" /> Manual edit
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground shrink-0">/blog/</span>
                                    <Input
                                        id="slug"
                                        placeholder="bacteriostatic-water-vs-sterile-water"
                                        value={formData.slug}
                                        disabled={isSlugLocked}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                slug: e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9]+/g, "-"),
                                            }))
                                        }
                                        className="font-mono text-xs"
                                    />
                                </div>
                            </div>

                            {/* Category & Reading Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold">Category</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(val) =>
                                            setFormData((prev) => ({ ...prev, category: val }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BLOG_CATEGORIES.map((cat) => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="readingTime" className="text-xs font-bold">
                                        Estimated Reading Time (Minutes)
                                    </Label>
                                    <Input
                                        id="readingTime"
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={formData.reading_time_minutes}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                reading_time_minutes: parseInt(e.target.value) || 5,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            {/* Cover Image Upload (Supabase Storage) */}
                            <BlogCoverImageUpload
                                value={formData.cover_image_url || ""}
                                onChange={(url) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        cover_image_url: url,
                                    }))
                                }
                            />

                            {/* Excerpt */}
                            <div className="space-y-1.5">
                                <Label htmlFor="excerpt" className="text-xs font-bold">
                                    Article Summary / Excerpt (Displayed on Cards & Fallback Meta)
                                </Label>
                                <Textarea
                                    id="excerpt"
                                    rows={2}
                                    placeholder="Brief summary of the protocol or research guide..."
                                    value={formData.excerpt || ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
                                    }
                                />
                            </div>

                            {/* Author Information */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="authorName" className="text-xs font-bold">
                                        Author Name
                                    </Label>
                                    <Input
                                        id="authorName"
                                        value={formData.author_name}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                author_name: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="authorRole" className="text-xs font-bold">
                                        Author Role / Department
                                    </Label>
                                    <Input
                                        id="authorRole"
                                        value={formData.author_role}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                author_role: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            {/* Tags Input */}
                            <div className="space-y-1.5">
                                <Label htmlFor="tags" className="text-xs font-bold">
                                    Article Tags (Comma separated)
                                </Label>
                                <Input
                                    id="tags"
                                    placeholder="bacteriostatic water, sterile water, dilution math"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                />
                            </div>

                            {/* Rich Content Editor */}
                            <div className="space-y-1.5 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold">Article Rich Content *</Label>
                                    <span className="text-[11px] text-muted-foreground">
                                        Tip: Click any image in editor to resize, align, replace, or delete.
                                    </span>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                    <RichTextEditor
                                        content={formData.content}
                                        onChange={(html) =>
                                            setFormData((prev) => ({ ...prev, content: html }))
                                        }
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tab 2: Media & Images Gallery */}
                        <TabsContent value="media" className="space-y-6">
                            {/* Cover Hero Image Card */}
                            <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                                <BlogCoverImageUpload
                                    value={formData.cover_image_url || ""}
                                    onChange={(url) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            cover_image_url: url,
                                        }))
                                    }
                                />
                            </div>

                            {/* Article Body Images Manager */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <ImageIcon className="h-4 w-4 text-primary" />
                                            Article Body Images ({detectedImages.length})
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Images embedded in the article body. You can delete, set as cover, or upload new figures directly to Supabase.
                                        </p>
                                    </div>
                                    <label className="cursor-pointer">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-xs gap-1.5 font-semibold pointer-events-none"
                                        >
                                            <UploadCloud className="h-3.5 w-3.5 text-primary" />
                                            Upload Image to Article Body
                                        </Button>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleUploadImageToContent}
                                        />
                                    </label>
                                </div>

                                {detectedImages.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed rounded-xl bg-muted/10">
                                        <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                                        <p className="text-xs font-semibold text-foreground">
                                            No images currently in article content
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Use the button above or the Image button in the Rich Text Editor to insert figures.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {detectedImages.map((img, idx) => {
                                            const isCover = formData.cover_image_url === img.src;
                                            return (
                                                <div
                                                    key={`${img.src}-${idx}`}
                                                    className={`rounded-xl border overflow-hidden bg-card shadow-sm flex flex-col justify-between transition-all ${
                                                        isCover ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
                                                    }`}
                                                >
                                                    <div className="relative aspect-video bg-muted overflow-hidden">
                                                        <img
                                                            src={img.src}
                                                            alt={img.alt}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {isCover && (
                                                            <div className="absolute top-2 left-2">
                                                                <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                                                                    Cover Image
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-3 border-t bg-muted/10 flex items-center justify-between gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 text-[11px] px-2 text-muted-foreground hover:text-primary"
                                                            onClick={() => {
                                                                setFormData(prev => ({ ...prev, cover_image_url: img.src }));
                                                                toast.success("Set as article cover image!");
                                                            }}
                                                            disabled={isCover}
                                                        >
                                                            {isCover ? "Current Cover" : "Make Cover"}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-7 px-2 text-[11px] font-semibold gap-1"
                                                            onClick={() => handleDeleteImageFromContent(img.src)}
                                                        >
                                                            <Trash2 className="h-3 w-3" /> Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Tab 2: Google SEO & SERP */}
                        <TabsContent value="seo" className="space-y-6">
                            {/* Live SERP Preview Box */}
                            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Globe className="h-4 w-4 text-primary" /> Live Google Search Result
                                        Preview
                                    </span>
                                    <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice("desktop")}
                                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                                                previewDevice === "desktop"
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "text-muted-foreground"
                                            }`}
                                        >
                                            <Monitor className="h-3 w-3" /> Desktop
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice("mobile")}
                                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                                                previewDevice === "mobile"
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "text-muted-foreground"
                                            }`}
                                        >
                                            <Smartphone className="h-3 w-3" /> Mobile
                                        </button>
                                    </div>
                                </div>

                                {/* Mock Google Result */}
                                <div
                                    className={`p-4 bg-white dark:bg-zinc-950 rounded-lg border shadow-sm ${
                                        previewDevice === "mobile" ? "max-w-sm mx-auto" : "w-full"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                                            LW
                                        </div>
                                        <div className="text-xs leading-none">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                Liv Well Research Labs
                                            </span>
                                            <span className="text-zinc-400 dark:text-zinc-500 mx-1">›</span>
                                            <span className="text-zinc-500 text-[11px]">
                                                blog › {formData.slug || "protocol-slug"}
                                            </span>
                                        </div>
                                    </div>

                                    <h4 className="text-base md:text-lg text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer line-clamp-1 leading-snug">
                                        {formData.seo_title || formData.title || "Your Protocol Title Here"}{" "}
                                        | Liv Well Research Labs
                                    </h4>

                                    <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 mt-1 leading-relaxed">
                                        {formData.seo_description ||
                                            formData.excerpt ||
                                            "Enter a compelling meta description below to summarize the scientific findings and capture high-intent search clicks."}
                                    </p>
                                </div>
                            </div>

                            {/* Meta Title */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="seoTitle" className="text-xs font-bold">
                                        Google Meta Title (Max ~60 characters)
                                    </Label>
                                    <span
                                        className={`text-xs font-semibold ${
                                            seoTitleLength >= 40 && seoTitleLength <= 60
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : seoTitleLength > 60
                                                ? "text-destructive"
                                                : "text-amber-600"
                                        }`}
                                    >
                                        {seoTitleLength} / 60 chars
                                    </span>
                                </div>
                                <Input
                                    id="seoTitle"
                                    placeholder={formData.title || "Custom Google Title"}
                                    value={formData.seo_title || ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, seo_title: e.target.value }))
                                    }
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    If left empty, defaults automatically to the main article title.
                                </p>
                            </div>

                            {/* Meta Description */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="seoDescription" className="text-xs font-bold">
                                        Google Meta Description (Ideal: 140–160 characters)
                                    </Label>
                                    <span
                                        className={`text-xs font-semibold ${
                                            seoDescLength >= 140 && seoDescLength <= 160
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : seoDescLength > 160
                                                ? "text-destructive"
                                                : "text-amber-600"
                                        }`}
                                    >
                                        {seoDescLength} / 160 chars
                                    </span>
                                </div>
                                <Textarea
                                    id="seoDescription"
                                    rows={3}
                                    placeholder="Enter a 150-160 character description summarizing key reconstitution techniques..."
                                    value={formData.seo_description || ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            seo_description: e.target.value,
                                        }))
                                    }
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Appears beneath your title in Google search results and OpenGraph shares.
                                </p>
                            </div>

                            {/* Focus Keywords */}
                            <div className="space-y-1.5">
                                <Label htmlFor="keywords" className="text-xs font-bold">
                                    Target SEO Keywords (Comma separated)
                                </Label>
                                <Input
                                    id="keywords"
                                    placeholder="bacteriostatic water vs sterile water, reconstitution ratios, peptide shelf life"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Injected into HTML keywords meta tags and Schema.org JSON-LD Article
                                    schema.
                                </p>
                            </div>
                        </TabsContent>

                        {/* Tab 3: Featured Products Links */}
                        <TabsContent value="products" className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-foreground">
                                    Contextual Store Products
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Select products to showcase in the article's sidebar widget with 1-click
                                    Add to Cart buttons:
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-1">
                                {storeProducts.map((prod: any) => {
                                    const isSelected = formData.featured_product_ids?.includes(prod.id);
                                    return (
                                        <div
                                            key={prod.id}
                                            onClick={() => {
                                                const current = formData.featured_product_ids || [];
                                                if (isSelected) {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        featured_product_ids: current.filter(
                                                            (id) => id !== prod.id
                                                        ),
                                                    }));
                                                } else {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        featured_product_ids: [...current, prod.id],
                                                    }));
                                                }
                                            }}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                                                isSelected
                                                    ? "border-primary bg-primary/10 shadow-sm"
                                                    : "border-border hover:bg-muted/50"
                                            }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="text-xs font-bold text-foreground truncate">
                                                    {prod.name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    ${Number(prod.price || 0).toFixed(2)}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="publishToggle"
                                checked={formData.is_published}
                                onCheckedChange={(checked) =>
                                    setFormData((prev) => ({ ...prev, is_published: checked }))
                                }
                            />
                            <Label htmlFor="publishToggle" className="text-xs font-semibold cursor-pointer">
                                {formData.is_published ? "Publish Live" : "Save as Draft"}
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                disabled={saveMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => saveMutation.mutate(formData)}
                                disabled={!formData.title || !formData.slug || saveMutation.isPending}
                                className="font-semibold"
                            >
                                {saveMutation.isPending
                                    ? "Saving..."
                                    : editingPostId
                                    ? "Update Article"
                                    : "Create Article"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialog
                open={!!deletingPost}
                onOpenChange={(open) => !open && setDeletingPost(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the protocol article{" "}
                            <strong>"{deletingPost?.title}"</strong> and its associated URL slug.
                            Search engines linking to this URL will encounter 404s unless redirected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletingPost && deleteMutation.mutate(deletingPost.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Article
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default BlogManagement;
