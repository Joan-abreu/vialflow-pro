import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlogPost } from "@/types/blog";
import SEOHead from "@/components/seo/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import {
    Clock,
    Calendar,
    ArrowLeft,
    Share2,
    Copy,
    Check,
    BookOpen,
    ArrowRight,
    ShoppingCart,
    ShieldAlert,
    FlaskConical,
    ChevronRight,
    ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { RICH_TEXT_STYLES } from "@/lib/rich-text-styles";

interface HeadingItem {
    id: string;
    text: string;
    level: number;
}

const BlogPostPage = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [copied, setCopied] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [activeHeadingId, setActiveHeadingId] = useState<string>("");
    const contentRef = useRef<HTMLDivElement>(null);

    // Fetch post details
    const {
        data: post,
        isLoading,
        error,
    } = useQuery<BlogPost | null>({
        queryKey: ["blog-post", slug],
        queryFn: async () => {
            if (!slug) return null;
            const { data, error } = await supabase
                .from("blog_posts")
                .select("*")
                .eq("slug", slug)
                .eq("is_published", true)
                .maybeSingle();

            if (error) throw error;
            return data as BlogPost | null;
        },
    });

    // Increment view count
    useEffect(() => {
        if (post?.slug) {
            supabase
                .rpc("increment_blog_views", { post_slug: post.slug })
                .then(() => {
                    // Silently incremented
                })
                .catch((e) => {
                    console.warn("View increment failed:", e);
                });
        }
    }, [post?.slug]);

    // Reading progress tracker
    useEffect(() => {
        const handleScroll = () => {
            const totalHeight =
                document.documentElement.scrollHeight - window.innerHeight;
            if (totalHeight > 0) {
                const progress = (window.scrollY / totalHeight) * 100;
                setScrollProgress(Math.min(100, Math.max(0, progress)));
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Extract headings from post content for Table of Contents
    const headings: HeadingItem[] = useMemo(() => {
        if (!post?.content) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(post.content, "text/html");
        const found = doc.querySelectorAll("h2, h3");

        const items: HeadingItem[] = [];
        found.forEach((el, index) => {
            const text = el.textContent?.trim() || "";
            if (text) {
                const id =
                    el.getAttribute("id") ||
                    `section-${index}-${text
                        .toLowerCase()
                        .replace(/[^\w]+/g, "-")
                        .slice(0, 40)}`;
                items.push({
                    id,
                    text,
                    level: el.tagName === "H2" ? 2 : 3,
                });
            }
        });

        return items;
    }, [post?.content]);

    // Add IDs to rendered HTML content
    const processedHtml = useMemo(() => {
        if (!post?.content) return "";
        const parser = new DOMParser();
        const doc = parser.parseFromString(post.content, "text/html");
        const found = doc.querySelectorAll("h2, h3");

        found.forEach((el, index) => {
            const text = el.textContent?.trim() || "";
            if (text && !el.getAttribute("id")) {
                const id = `section-${index}-${text
                    .toLowerCase()
                    .replace(/[^\w]+/g, "-")
                    .slice(0, 40)}`;
                el.setAttribute("id", id);
            }
        });

        return doc.body.innerHTML;
    }, [post?.content]);

    // Track active heading on scroll
    useEffect(() => {
        if (headings.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveHeadingId(entry.target.id);
                    }
                });
            },
            { rootMargin: "-80px 0px -70% 0px", threshold: 0.1 }
        );

        headings.forEach((h) => {
            const el = document.getElementById(h.id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [headings, processedHtml]);

    // Fetch Contextual Recommended Products
    const { data: featuredProducts = [] } = useQuery({
        queryKey: ["blog-featured-products", post?.featured_product_ids],
        queryFn: async () => {
            if (post?.featured_product_ids && post.featured_product_ids.length > 0) {
                const { data } = await supabase
                    .from("products")
                    .select("id, name, slug, image_url, price, sale_price, product_variants(*)")
                    .in("id", post.featured_product_ids);
                if (data && data.length > 0) return data;
            }

            // Fallback: fetch top 2 water or peptide products
            const { data } = await supabase
                .from("products")
                .select("id, name, slug, image_url, price, sale_price, product_variants(*)")
                .eq("status", "active")
                .limit(2);

            return data || [];
        },
        enabled: !!post,
    });

    // Fetch Next / Related Articles
    const { data: relatedPosts = [] } = useQuery<BlogPost[]>({
        queryKey: ["blog-related-posts", post?.category, post?.id],
        queryFn: async () => {
            if (!post) return [];
            const { data } = await supabase
                .from("blog_posts")
                .select("*")
                .eq("is_published", true)
                .neq("id", post.id)
                .limit(3);

            return (data || []) as BlogPost[];
        },
        enabled: !!post,
    });

    const shareUrl = typeof window !== "undefined" ? window.location.href : "";

    const handleCopyLink = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("Article link copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleAddToCart = (product: any) => {
        const variant = product.product_variants?.[0];
        if (variant) {
            addToCart({
                id: variant.id,
                product_id: product.id,
                name: product.name,
                volume_ml: variant.volume_ml,
                pack_size: variant.pack_size || 1,
                price: Number(variant.price || product.sale_price || product.price),
                stock: variant.stock || 100,
                image_url: product.image_url,
                sku: variant.sku,
            });
            toast.success(`${product.name} added to cart!`);
        } else {
            navigate(`/products/${product.slug || product.id}`);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background py-16">
                <div className="container max-w-4xl mx-auto px-4 space-y-8 animate-pulse">
                    <div className="h-6 w-32 bg-muted rounded" />
                    <div className="h-12 w-3/4 bg-muted rounded" />
                    <div className="h-96 w-full bg-muted rounded-2xl" />
                    <div className="space-y-4">
                        <div className="h-4 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-5/6" />
                        <div className="h-4 bg-muted rounded w-4/6" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center py-20 px-4">
                <div className="text-center max-w-md space-y-4">
                    <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                    <h2 className="text-2xl font-bold">Research Article Not Found</h2>
                    <p className="text-sm text-muted-foreground">
                        The protocol you are looking for may have moved or been updated.
                    </p>
                    <Link to="/blog">
                        <Button className="mt-2">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Research Blog
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Reading Progress Indicator */}
            <div
                className="fixed top-16 left-0 right-0 h-1 bg-primary z-50 transition-all duration-100"
                style={{ width: `${scrollProgress}%` }}
            />

            <SEOHead
                title={post.seo_title || post.title}
                description={post.seo_description || post.excerpt || undefined}
                keywords={post.seo_keywords || []}
                type="article"
                publishedTime={post.published_at}
                modifiedTime={post.updated_at}
                author={post.author_name}
                category={post.category}
                tags={post.tags || []}
                image={post.cover_image_url || undefined}
                breadcrumbs={[
                    { name: "Home", item: "/" },
                    { name: "Research Blog", item: "/blog" },
                    { name: post.category, item: `/blog` },
                    { name: post.title, item: `/blog/${post.slug}` }
                ]}
            />

            {/* Breadcrumb & Navigation Header */}
            <div className="border-b bg-muted/20 py-4">
                <div className="container max-w-6xl mx-auto px-4 flex items-center justify-between">
                    <nav className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
                        <Link to="/" className="hover:text-primary transition-colors">
                            Home
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        <Link to="/blog" className="hover:text-primary transition-colors">
                            Research Blog
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-foreground font-medium truncate max-w-[200px] md:max-w-xs">
                            {post.title}
                        </span>
                    </nav>

                    <Link to="/blog">
                        <Button variant="ghost" size="sm" className="text-xs shrink-0">
                            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                            All Articles
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Article Hero Container */}
            <header className="container max-w-4xl mx-auto px-4 pt-10 pb-8 text-left">
                <div className="space-y-5">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <Link to={`/blog?category=${encodeURIComponent(post.category)}`}>
                            <Badge
                                variant="default"
                                className="font-semibold text-xs px-3 py-1 hover:bg-primary/85 transition-colors cursor-pointer"
                                title={`View all ${post.category} protocols`}
                            >
                                {post.category}
                            </Badge>
                        </Link>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {post.reading_time_minutes} min read
                        </span>
                        {post.published_at && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(post.published_at), "MMMM d, yyyy")}
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                        {post.title}
                    </h1>

                    {post.excerpt && (
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                            {post.excerpt}
                        </p>
                    )}

                    {/* Author & Share Bar */}
                    <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                {post.author_name.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {post.author_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {post.author_role}
                                </p>
                            </div>
                        </div>

                        {/* Social Share Buttons */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
                                <Share2 className="h-3.5 w-3.5" /> Share:
                            </span>

                            <a
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Share on X / Twitter"
                            >
                                <span className="font-bold text-xs">𝕏</span>
                            </a>

                            <a
                                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Share on LinkedIn"
                            >
                                <span className="font-bold text-xs">in</span>
                            </a>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyLink}
                                className="h-8 text-xs gap-1.5"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? "Copied" : "Copy Link"}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Full Width Hero Image */}
            {post.cover_image_url && (
                <div className="container max-w-5xl mx-auto px-4 mb-10">
                    <div className="relative aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border bg-muted">
                        <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            )}

            {/* Main Article Content + Sticky Sidebar */}
            <div className="container max-w-6xl mx-auto px-4 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Main Article Body */}
                    <article className="lg:col-span-8 min-w-0" ref={contentRef}>
                        {/* Render rich content */}
                        <div
                            className={`${RICH_TEXT_STYLES} max-w-none text-foreground leading-relaxed`}
                            dangerouslySetInnerHTML={{ __html: processedHtml }}
                        />

                        {/* Article Tags */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="mt-12 pt-6 border-t">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Related Research Topics
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {post.tags.map((tag) => (
                                        <Link
                                            key={tag}
                                            to={`/blog?search=${encodeURIComponent(tag)}`}
                                            className="inline-block group"
                                            title={`Explore articles related to ${tag}`}
                                        >
                                            <Badge
                                                variant="outline"
                                                className="text-xs font-medium px-3 py-1.5 bg-muted/60 text-foreground border-border/80 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 cursor-pointer shadow-xs group-hover:scale-105"
                                            >
                                                #{tag}
                                            </Badge>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* RUO Research Use Only Disclaimer */}
                        <div className="mt-10 p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed">
                            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-semibold block mb-1">
                                    RESEARCH PROTOCOL COMPLIANCE NOTICE
                                </strong>
                                The calculations, storage parameters, and protocols described in this publication are documented strictly for laboratory, chemical analysis, and in vitro experimentation. Reconstitution solutions and research peptides are not intended for human dosing, therapeutic treatment, or in vivo administration.
                            </div>
                        </div>

                        {/* Author Bio Box */}
                        <div className="mt-12 p-6 rounded-2xl bg-muted/30 border flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-primary/20 text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/30">
                                {post.author_name.charAt(0)}
                            </div>
                            <div className="space-y-1.5">
                                <h4 className="font-bold text-foreground text-base">
                                    {post.author_name}
                                </h4>
                                <p className="text-xs text-primary font-medium">
                                    {post.author_role}
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                    Specializing in high-purity laboratory solvent verification, analytical testing compliance (HPLC/MS), and sterile vial reconstitution standards for research facilities worldwide.
                                </p>
                            </div>
                        </div>
                    </article>

                    {/* Sticky Sidebar */}
                    <aside className="lg:col-span-4 space-y-8">
                        <div className="lg:sticky lg:top-24 space-y-6">
                            {/* Table of Contents */}
                            {headings.length > 0 && (
                                <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur">
                                    <CardContent className="p-5">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                            Table of Contents
                                        </h4>
                                        <nav className="space-y-1.5 max-h-[350px] overflow-y-auto pr-2 text-xs">
                                            {headings.map((h) => {
                                                const isActive = activeHeadingId === h.id;
                                                return (
                                                    <a
                                                        key={h.id}
                                                        href={`#${h.id}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const target = document.getElementById(h.id);
                                                            if (target) {
                                                                target.scrollIntoView({ behavior: "smooth" });
                                                                setActiveHeadingId(h.id);
                                                            }
                                                        }}
                                                        className={`block py-1.5 transition-colors leading-snug rounded px-2 ${
                                                            h.level === 3 ? "pl-5" : ""
                                                        } ${
                                                            isActive
                                                                ? "text-primary font-bold bg-primary/10 border-l-2 border-primary"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                        }`}
                                                    >
                                                        {h.text}
                                                    </a>
                                                );
                                            })}
                                        </nav>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recommended Laboratory Solutions / Products Widget */}
                            {featuredProducts.length > 0 && (
                                <Card className="border border-primary/20 shadow-md bg-gradient-to-b from-card to-primary/5">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FlaskConical className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                Verified Lab Solutions
                                            </h4>
                                        </div>

                                        <p className="text-xs text-muted-foreground mb-4">
                                            High-purity solvents & peptides referenced in this protocol:
                                        </p>

                                        <div className="space-y-3">
                                            {featuredProducts.map((product: any) => (
                                                <div
                                                    key={product.id}
                                                    className="p-3 rounded-lg border bg-background flex items-center gap-3 hover:border-primary/50 transition-colors"
                                                >
                                                    <img
                                                        src={
                                                            product.image_url ||
                                                            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=200&auto=format&fit=crop"
                                                        }
                                                        alt={product.name}
                                                        className="w-12 h-12 rounded object-cover border shrink-0"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <h5 className="text-xs font-bold text-foreground truncate">
                                                            {product.name}
                                                        </h5>
                                                        <p className="text-xs font-semibold text-primary">
                                                            ${Number(product.sale_price || product.price || 9.99).toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-8 w-8 p-0 shrink-0"
                                                        onClick={() => handleAddToCart(product)}
                                                        title="Add to cart"
                                                    >
                                                        <ShoppingCart className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        <Link to="/products" className="block mt-4">
                                            <Button variant="outline" size="sm" className="w-full text-xs font-semibold">
                                                Browse Catalog <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </aside>
                </div>

                {/* Related Articles Carousel / Grid */}
                {relatedPosts.length > 0 && (
                    <div className="mt-20 pt-10 border-t">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                                    Related Research Protocols
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Continue reading guides on laboratory reconstitution and storage stability.
                                </p>
                            </div>
                            <Link to="/blog">
                                <Button variant="ghost" size="sm" className="text-xs font-semibold">
                                    View All <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                </Button>
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {relatedPosts.map((rPost) => (
                                <Link
                                    key={rPost.id}
                                    to={`/blog/${rPost.slug}`}
                                    className="group"
                                >
                                    <Card className="h-full overflow-hidden border hover:border-primary/50 transition-all hover:shadow-md bg-card">
                                        <div className="aspect-video relative overflow-hidden bg-muted">
                                            <img
                                                src={
                                                    rPost.cover_image_url ||
                                                    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=600&auto=format&fit=crop"
                                                }
                                                alt={rPost.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                        <CardContent className="p-4 space-y-2">
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] py-0.5 px-2 font-semibold bg-primary/10 text-primary border-primary/20"
                                                >
                                                    {rPost.category}
                                                </Badge>
                                                <span>{rPost.reading_time_minutes} min read</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                                {rPost.title}
                                            </h4>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {rPost.excerpt}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlogPostPage;
