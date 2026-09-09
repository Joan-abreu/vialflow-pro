export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    cover_image_url: string | null;
    category: string;
    tags: string[];
    author_name: string;
    author_role: string;
    author_avatar_url: string | null;
    reading_time_minutes: number;
    is_published: boolean;
    published_at: string | null;
    seo_title: string | null;
    seo_description: string | null;
    seo_keywords: string[];
    featured_product_ids: string[];
    views_count: number;
    created_at: string;
    updated_at: string;
}

export type BlogPostInput = Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'views_count'>;

export const BLOG_CATEGORIES = [
    "Reconstitution Protocols",
    "Peptide Research",
    "Laboratory Storage",
    "Quality & COA",
    "General Science"
] as const;

export type BlogCategory = typeof BLOG_CATEGORIES[number];
