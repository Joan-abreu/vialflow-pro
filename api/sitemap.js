import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://gtmpqjbbcobjxwfeyqzz.supabase.co";
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_34oYhC35s3nbQXs3UQt4eA_Ijk1yGJf";
    const siteUrl = "https://www.livwellresearchlabs.com";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Static public pages
    const staticPages = [
        { url: "/", changefreq: "daily", priority: "1.0" },
        { url: "/products", changefreq: "daily", priority: "0.9" },
        { url: "/lab-reports", changefreq: "weekly", priority: "0.8" },
        { url: "/about", changefreq: "monthly", priority: "0.6" },
        { url: "/contact", changefreq: "monthly", priority: "0.6" }
    ];

    try {
        // Fetch non-private categories
        const { data: categories, error: catError } = await supabase
            .from("product_categories")
            .select("id, name, is_private");

        if (catError) {
            console.error("Error fetching categories for sitemap:", catError);
        }

        const privateCategoryIds = new Set(
            (categories || [])
                .filter(c => c.is_private || c.name?.toLowerCase().includes("peptide"))
                .map(c => c.id)
        );

        // Fetch active & published products
        const { data: products, error: prodError } = await supabase
            .from("products")
            .select("id, name, slug, is_published, is_private, category_id, updated_at")
            .eq("is_published", true);

        if (prodError) {
            console.error("Error fetching products for sitemap:", prodError);
            throw prodError;
        }

        // Strict security filter: exclude private items
        const publicProducts = (products || []).filter(p => {
            if (p.is_private) return false;
            if (p.category_id && privateCategoryIds.has(p.category_id)) return false;
            if (!p.slug) return false;
            return true;
        });

        // Build XML string
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        for (const page of staticPages) {
            xml += `  <url>\n`;
            xml += `    <loc>${siteUrl}${page.url}</loc>\n`;
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += `  </url>\n`;
        }

        for (const prod of publicProducts) {
            xml += `  <url>\n`;
            xml += `    <loc>${siteUrl}/products/${prod.slug}</loc>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            if (prod.updated_at) {
                xml += `    <lastmod>${new Date(prod.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
            }
            xml += `  </url>\n`;
        }

        xml += `</urlset>\n`;

        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.status(200).send(xml);
    } catch (err) {
        console.error("Error generating dynamic sitemap:", err);
        return res.status(500).send("Error generating sitemap");
    }
}
