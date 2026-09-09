-- ==============================================================================
-- Migration: Create Blog Posts System for High-Authority SEO & Content Marketing
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    category TEXT NOT NULL DEFAULT 'Reconstitution Protocols',
    tags TEXT[] DEFAULT '{}'::text[],
    author_name TEXT NOT NULL DEFAULT 'Liv Well Scientific Communications',
    author_role TEXT NOT NULL DEFAULT 'Laboratory Research Team',
    author_avatar_url TEXT DEFAULT '/placeholder.svg',
    reading_time_minutes INTEGER NOT NULL DEFAULT 5,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    seo_title TEXT,
    seo_description TEXT,
    seo_keywords TEXT[] DEFAULT '{}'::text[],
    featured_product_ids UUID[] DEFAULT '{}'::uuid[],
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance & SEO indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 1. Public can read published blog posts
DROP POLICY IF EXISTS "Public can view published blog posts" ON public.blog_posts;
CREATE POLICY "Public can view published blog posts" ON public.blog_posts
    FOR SELECT
    USING (is_published = true);

-- 2. Admins & Managers have full access (CRUD)
DROP POLICY IF EXISTS "Admins full access on blog_posts" ON public.blog_posts;
CREATE POLICY "Admins full access on blog_posts" ON public.blog_posts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    );

-- 3. Stored procedure to safely increment view count without write permissions
CREATE OR REPLACE FUNCTION public.increment_blog_views(post_slug TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.blog_posts
    SET views_count = views_count + 1
    WHERE slug = post_slug AND is_published = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to increment_blog_views to public/anon
GRANT EXECUTE ON FUNCTION public.increment_blog_views(TEXT) TO anon, authenticated, service_role;
