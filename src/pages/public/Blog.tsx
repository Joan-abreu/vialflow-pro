import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlogPost, BLOG_CATEGORIES } from "@/types/blog";
import SEOHead from "@/components/seo/SEOHead";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    BookOpen,
    Clock,
    Calendar,
    ArrowRight,
    Sparkles,
    Eye,
    FlaskConical,
    CheckCircle2,
    ShieldCheck,
    X
} from "lucide-react";
import { format } from "date-fns";

const Blog = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const paramSearch = searchParams.get("search") || searchParams.get("tag") || "";
    const paramCategory = searchParams.get("category") || "All";

    const [searchQuery, setSearchQuery] = useState(paramSearch);
    const [selectedCategory, setSelectedCategory] = useState<string>(paramCategory);

    // Synchronize state when URL query params change
    useEffect(() => {
        const q = searchParams.get("search") || searchParams.get("tag") || "";
        const cat = searchParams.get("category") || "All";
        setSearchQuery(q);
        setSelectedCategory(cat);
    }, [searchParams]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        const newParams = new URLSearchParams(searchParams);
        if (value.trim()) {
            newParams.set("search", value.trim());
            newParams.delete("tag");
        } else {
            newParams.delete("search");
            newParams.delete("tag");
        }
        setSearchParams(newParams, { replace: true });
    };

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
        const newParams = new URLSearchParams(searchParams);
        if (category && category !== "All") {
            newParams.set("category", category);
        } else {
            newParams.delete("category");
        }
        setSearchParams(newParams, { replace: true });
    };

    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedCategory("All");
        setSearchParams({}, { replace: true });
    };

    // Fetch published blog posts
    const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
        queryKey: ["public-blog-posts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("blog_posts")
                .select("*")
                .eq("is_published", true)
                .order("published_at", { ascending: false });

            if (error) throw error;
            return (data || []) as BlogPost[];
        },
    });

    // Filter posts by search query and category
    const filteredPosts = useMemo(() => {
        return posts.filter((post) => {
            const matchesCategory =
                selectedCategory === "All" || post.category === selectedCategory;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                post.title.toLowerCase().includes(q) ||
                (post.excerpt && post.excerpt.toLowerCase().includes(q)) ||
                post.category.toLowerCase().includes(q) ||
                (post.tags && post.tags.some((tag) => tag.toLowerCase().includes(q)));

            return matchesCategory && matchesSearch;
        });
    }, [posts, selectedCategory, searchQuery]);

    // Top featured article (if on "All" and no search query)
    const featuredPost = useMemo(() => {
        if (selectedCategory === "All" && !searchQuery && filteredPosts.length > 0) {
            return filteredPosts[0];
        }
        return null;
    }, [selectedCategory, searchQuery, filteredPosts]);

    // Remaining articles for the grid
    const gridPosts = useMemo(() => {
        if (featuredPost) {
            return filteredPosts.slice(1);
        }
        return filteredPosts;
    }, [featuredPost, filteredPosts]);

    const categories = ["All", ...BLOG_CATEGORIES];

    return (
        <div className="min-h-screen bg-background">
            <SEOHead
                title="Research Protocols & Reconstitution Science Blog"
                description="Authoritative laboratory guides on reconstitution chemistry, peptide stability, sterile filtering protocols, and Certificate of Analysis (COA) interpretation."
                keywords={[
                    "bacteriostatic water guide",
                    "peptide reconstitution protocols",
                    "sterile water vs bac water",
                    "peptide storage temperature",
                    "how to read peptide coa",
                    "reconstitution math calculator",
                    "benzyl alcohol safety"
                ]}
                breadcrumbs={[
                    { name: "Home", item: "/" },
                    { name: "Research Blog", item: "/blog" }
                ]}
            />

            {/* Hero Section */}
            <section className="relative overflow-hidden border-b bg-gradient-to-b from-muted/50 via-background to-background py-16 md:py-24">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
                <div className="container relative max-w-6xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-6 animate-fade-in">
                        <FlaskConical className="h-3.5 w-3.5" />
                        <span>Educational Protocols & Lab Research</span>
                    </div>

                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-tight mb-6">
                        Reconstitution Science &{" "}
                        <span className="bg-gradient-to-r from-primary via-emerald-600 to-teal-500 bg-clip-text text-transparent">
                            Laboratory Protocols
                        </span>
                    </h1>

                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                        Peer-reviewed guides on solvent preservation, peptide reconstitution math, storage stability, and analytical testing standards.
                    </p>

                    {/* Search & Filter Bar */}
                    <div className="max-w-2xl mx-auto relative mb-8">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search protocols (e.g. sterile water, dilution math, storage, COA)..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-12 pr-10 py-6 text-base rounded-full shadow-sm border-muted-foreground/20 focus-visible:ring-primary"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => handleSearchChange("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
                        {categories.map((cat) => {
                            const isSelected = selectedCategory === cat;
                            const count =
                                cat === "All"
                                    ? posts.length
                                    : posts.filter((p) => p.category === cat).length;

                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(cat)}
                                    className={`px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                                        isSelected
                                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                                    }`}
                                >
                                    <span>{cat}</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                            isSelected
                                                ? "bg-primary-foreground/20 text-primary-foreground"
                                                : "bg-muted-foreground/15 text-muted-foreground"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Main Content Area */}
            <main className="container max-w-6xl mx-auto px-4 py-12 md:py-16">
                {isLoading ? (
                    <div className="space-y-8">
                        <div className="h-96 rounded-2xl bg-muted/60 animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="h-80 rounded-xl bg-muted/60 animate-pulse" />
                            ))}
                        </div>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 border border-dashed rounded-2xl">
                        <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No research articles found</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Try adjusting your search keywords or switching category filters.
                        </p>
                        <Button
                            variant="outline"
                            onClick={handleResetFilters}
                        >
                            Reset Filters
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Featured Article Hero Card */}
                        {featuredPost && (
                            <div className="relative group">
                                <Link to={`/blog/${featuredPost.slug}`}>
                                    <Card className="overflow-hidden border border-border/70 hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-xl bg-card">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                                            {/* Cover Image */}
                                            <div className="lg:col-span-7 relative aspect-video lg:aspect-auto overflow-hidden bg-muted">
                                                <img
                                                    src={
                                                        featuredPost.cover_image_url ||
                                                        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop"
                                                    }
                                                    alt={featuredPost.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 min-h-[260px] lg:min-h-[380px]"
                                                    loading="eager"
                                                />
                                                <div className="absolute top-4 left-4">
                                                    <Badge className="bg-primary/95 text-primary-foreground font-semibold px-3 py-1 shadow-md uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                        <Sparkles className="h-3 w-3" />
                                                        Featured Protocol
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between">
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                        <Badge
                                                            variant="outline"
                                                            className="font-semibold text-xs bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5"
                                                        >
                                                            {featuredPost.category}
                                                        </Badge>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {featuredPost.reading_time_minutes} min read
                                                        </span>
                                                        {featuredPost.published_at && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                {format(new Date(featuredPost.published_at), "MMM d, yyyy")}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-3">
                                                        {featuredPost.title}
                                                    </h2>

                                                    <p className="text-muted-foreground text-sm md:text-base leading-relaxed line-clamp-3">
                                                        {featuredPost.excerpt}
                                                    </p>
                                                </div>

                                                <div className="pt-6 border-t mt-6 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                            {featuredPost.author_name.charAt(0)}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-xs font-semibold text-foreground">
                                                                {featuredPost.author_name}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {featuredPost.author_role}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                                                        Read Guide <ArrowRight className="h-4 w-4" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            </div>
                        )}

                        {/* Standard Grid of Articles */}
                        {gridPosts.length > 0 && (
                            <div>
                                {featuredPost && (
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-primary" />
                                            Latest Research Guides
                                        </h3>
                                        <span className="text-xs text-muted-foreground">
                                            Showing {gridPosts.length} {gridPosts.length === 1 ? "article" : "articles"}
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                    {gridPosts.map((post) => (
                                        <Link
                                            key={post.id}
                                            to={`/blog/${post.slug}`}
                                            className="group flex flex-col h-full"
                                        >
                                            <Card className="flex flex-col h-full overflow-hidden border border-border/60 hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-card">
                                                {/* Card Thumbnail */}
                                                <div className="relative aspect-video overflow-hidden bg-muted">
                                                    <img
                                                        src={
                                                            post.cover_image_url ||
                                                            "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=800&auto=format&fit=crop"
                                                        }
                                                        alt={post.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute top-3 left-3">
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-background/95 dark:bg-card/95 backdrop-blur-md text-foreground font-bold text-xs border border-border/80 shadow-sm flex items-center gap-1.5 px-2.5 py-0.5"
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                                                            {post.category}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <CardContent className="p-5 flex flex-col flex-1 justify-between">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {post.reading_time_minutes} min read
                                                            </span>
                                                            {post.published_at && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {format(new Date(post.published_at), "MMM d, yyyy")}
                                                                </span>
                                                            )}
                                                            {post.views_count > 0 && (
                                                                <span className="inline-flex items-center gap-1 ml-auto text-muted-foreground/80">
                                                                    <Eye className="h-3 w-3" />
                                                                    {post.views_count}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                                                            {post.title}
                                                        </h3>

                                                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                                            {post.excerpt}
                                                        </p>
                                                    </div>

                                                    {/* Card Footer */}
                                                    <div className="pt-4 border-t mt-4 flex items-center justify-between text-xs">
                                                        <span className="font-medium text-muted-foreground">
                                                            {post.author_name}
                                                        </span>
                                                        <span className="font-bold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                            Read Protocol <ArrowRight className="h-3.5 w-3.5" />
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Laboratory Assurance & Newsletter Callout */}
                <div className="mt-16 bg-gradient-to-r from-primary/10 via-primary/5 to-teal-500/10 border border-primary/20 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
                    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
                        <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-2">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-foreground">
                            Laboratory-Verified Reconstitution Solutions
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Need certified 0.9% benzyl alcohol bacteriostatic water or sterile reconstitution vials for your laboratory experiments? All batches are verified with third-party analytical testing.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-4 flex-wrap">
                            <Link to="/products?category=water">
                                <Button className="font-semibold shadow-md">
                                    Shop BAC Water Vials <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>
                            <Link to="/lab-reports">
                                <Button variant="outline" className="font-semibold">
                                    View Batch COAs
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Blog;
