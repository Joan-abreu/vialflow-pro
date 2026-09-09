import { supabase } from "@/integrations/supabase/client";

export interface SitemapURL {
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}

export const generateSitemapXML = async (baseUrl: string = "https://vialflow-pro.vercel.app"): Promise<string> => {
    const today = new Date().toISOString().split('T')[0];

    // Static priority pages
    const urls: SitemapURL[] = [
        { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: 1.0 },
        { loc: `${baseUrl}/products`, lastmod: today, changefreq: 'daily', priority: 0.9 },
        { loc: `${baseUrl}/products?category=water`, lastmod: today, changefreq: 'weekly', priority: 0.9 },
        { loc: `${baseUrl}/products?category=peptides`, lastmod: today, changefreq: 'weekly', priority: 0.9 },
        { loc: `${baseUrl}/blog`, lastmod: today, changefreq: 'daily', priority: 0.9 },
        { loc: `${baseUrl}/lab-reports`, lastmod: today, changefreq: 'weekly', priority: 0.8 },
        { loc: `${baseUrl}/about`, lastmod: today, changefreq: 'monthly', priority: 0.7 },
        { loc: `${baseUrl}/contact`, lastmod: today, changefreq: 'monthly', priority: 0.7 },
        { loc: `${baseUrl}/sds`, lastmod: today, changefreq: 'monthly', priority: 0.6 },
        { loc: `${baseUrl}/terms`, lastmod: today, changefreq: 'monthly', priority: 0.4 },
        { loc: `${baseUrl}/privacy`, lastmod: today, changefreq: 'monthly', priority: 0.4 },
        { loc: `${baseUrl}/returns`, lastmod: today, changefreq: 'monthly', priority: 0.4 },
    ];

    try {
        // Fetch published blog posts
        const { data: posts } = await supabase
            .from("blog_posts")
            .select("slug, updated_at, published_at")
            .eq("is_published", true)
            .order("published_at", { ascending: false });

        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const date = (post.updated_at || post.published_at || today).split('T')[0];
                urls.push({
                    loc: `${baseUrl}/blog/${post.slug}`,
                    lastmod: date,
                    changefreq: 'weekly',
                    priority: 0.85
                });
            });
        }
    } catch (e) {
        console.error("Error fetching blog posts for sitemap:", e);
    }

    try {
        // Fetch public products
        const { data: products } = await supabase
            .from("products")
            .select("slug, id, updated_at")
            .eq("status", "active");

        if (products && products.length > 0) {
            products.forEach(p => {
                const date = (p.updated_at || today).split('T')[0];
                urls.push({
                    loc: `${baseUrl}/products/${p.slug || p.id}`,
                    lastmod: date,
                    changefreq: 'weekly',
                    priority: 0.8
                });
            });
        }
    } catch (e) {
        console.error("Error fetching products for sitemap:", e);
    }

    // Build XML string
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.map(u => `    <url>
        <loc>${u.loc}</loc>
        ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
        ${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}
        ${u.priority ? `<priority>${u.priority.toFixed(2)}</priority>` : ''}
    </url>`).join('\n')}
</urlset>`;

    return xml;
};

export const downloadSitemapXML = async () => {
    const xml = await generateSitemapXML();
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sitemap.xml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
