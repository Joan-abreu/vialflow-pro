import { Helmet } from 'react-helmet-async';

export interface BreadcrumbItem {
    name: string;
    item: string;
}

export interface SEOHeadProps {
    title: string;
    description?: string;
    keywords?: string[];
    image?: string;
    url?: string;
    type?: 'website' | 'article';
    publishedTime?: string | null;
    modifiedTime?: string | null;
    author?: string;
    category?: string;
    tags?: string[];
    breadcrumbs?: BreadcrumbItem[];
    noindex?: boolean;
}

const DEFAULT_DESCRIPTION = "Direct laboratory manufacturer of ultra-pure reconstitution solutions and bacteriostatic water, and premier supplier of research peptides. Third-party lab tested.";
const SITE_NAME = "Liv Well Research Labs";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=1200&auto=format&fit=crop";

export const SEOHead = ({
    title,
    description = DEFAULT_DESCRIPTION,
    keywords = [],
    image,
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author = "Liv Well Scientific Communications",
    category,
    tags = [],
    breadcrumbs,
    noindex = false,
}: SEOHeadProps) => {
    // Current URL calculation
    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vialflow-pro.vercel.app';
    const canonicalUrl = url || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

    // Title formatting
    const formattedTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const ogImage = image || DEFAULT_IMAGE;

    // Structured Data: Breadcrumbs Schema
    const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "name": crumb.name,
            "item": crumb.item.startsWith('http') ? crumb.item : `${siteUrl}${crumb.item}`
        }))
    } : null;

    // Structured Data: BlogPosting Schema
    const articleSchema = type === 'article' ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": canonicalUrl
        },
        "headline": title,
        "description": description,
        "image": [ogImage],
        "datePublished": publishedTime || new Date().toISOString(),
        "dateModified": modifiedTime || publishedTime || new Date().toISOString(),
        "author": {
            "@type": "Person",
            "name": author,
            "jobTitle": "Laboratory Research Specialist",
            "worksFor": {
                "@type": "Organization",
                "name": SITE_NAME
            }
        },
        "publisher": {
            "@type": "Organization",
            "name": SITE_NAME,
            "url": siteUrl,
            "logo": {
                "@type": "ImageObject",
                "url": `${siteUrl}/favicon.ico`
            }
        },
        ...(category ? { "articleSection": category } : {}),
        ...(keywords.length > 0 ? { "keywords": keywords.join(', ') } : {}),
        ...(tags.length > 0 ? { "about": tags.map(t => ({ "@type": "Thing", "name": t })) } : {})
    } : null;

    return (
        <Helmet>
            {/* Standard HTML Meta */}
            <title>{formattedTitle}</title>
            <meta name="description" content={description} />
            {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
            {author && <meta name="author" content={author} />}
            <link rel="canonical" href={canonicalUrl} />
            {noindex ? (
                <meta name="robots" content="noindex, nofollow" />
            ) : (
                <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
            )}

            {/* Open Graph / Facebook */}
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:title" content={formattedTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:alt" content={title} />

            {/* Article Specific Open Graph */}
            {type === 'article' && publishedTime && (
                <meta property="article:published_time" content={publishedTime} />
            )}
            {type === 'article' && modifiedTime && (
                <meta property="article:modified_time" content={modifiedTime} />
            )}
            {type === 'article' && category && (
                <meta property="article:section" content={category} />
            )}
            {type === 'article' && tags.map((tag) => (
                <meta property="article:tag" content={tag} key={tag} />
            ))}

            {/* Twitter Cards */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@LivWellLabs" />
            <meta name="twitter:title" content={formattedTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
            <meta name="twitter:image:alt" content={title} />

            {/* Schema.org JSON-LD Structured Data */}
            {breadcrumbSchema && (
                <script type="application/ld+json">
                    {JSON.stringify(breadcrumbSchema)}
                </script>
            )}
            {articleSchema && (
                <script type="application/ld+json">
                    {JSON.stringify(articleSchema)}
                </script>
            )}
        </Helmet>
    );
};

export default SEOHead;
