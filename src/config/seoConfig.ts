export interface PageSEO {
    title: string;
    description: string;
}

export const SEO_CONFIG: Record<string, PageSEO> = {
    // Static Pages
    "home": {
        title: "Laboratory-Grade Bacteriostatic Water | Liv Well Research Labs",
        description: "Shop ultra-pure bacteriostatic water and laboratory-grade reconstitution solutions. Third-party lab tested, sterile-filtered, and fast shipping for research use."
    },
    "lab-reports": {
        title: "Lab Reports & COAs | Liv Well Research Labs",
        description: "Access third-party lab reports and Certificates of Analysis (COAs) verifying sterility, pH, and benzyl alcohol concentration for our research solutions."
    },
    "about": {
        title: "About Liv Well Research Labs | Laboratory Solutions",
        description: "Learn about Liv Well Research Labs and our commitment to producing high-purity laboratory-grade bacteriostatic water and reconstitution solutions."
    },
    "contact": {
        title: "Contact Liv Well Research Labs",
        description: "Contact Liv Well Research Labs for product questions, wholesale inquiries, laboratory support, or general assistance with your research solution orders."
    },
    "products-catalog": {
        title: "Laboratory Reconstitution Solutions & Bac Water",
        description: "Browse laboratory-grade bacteriostatic water and sterile reconstitution solutions available in multiple vial sizes for scientific research applications."
    },

    // Individual Product Pages (mapped by product slug)
    "reconstitution-solution-bacteriostatic-water-bac-water-2-pack-of-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "2 Pack 10ml Bacteriostatic Water | Lab Grade",
        description: "Shop 2-pack 10ml bacteriostatic water with 0.9% benzyl alcohol. Sterile-filtered, third-party lab tested, and intended for laboratory research use only."
    },
    "reconstitution-solution-bacteriostatic-water-bac-water-2-pack-of-30ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "2 Pack 30ml Bacteriostatic Water | Lab Grade",
        description: "Order 2-pack 30ml laboratory-grade bacteriostatic water with 0.9% benzyl alcohol. Third-party tested and manufactured for research applications."
    },
    "reconstitution-solution-bacteriostatic-water-bac-water-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "10ml Bacteriostatic Water | Laboratory Grade",
        description: "Purchase 10ml laboratory-grade bacteriostatic water with 0.9% benzyl alcohol. Sterile-filtered and independently lab tested for research use."
    },
    "reconstitution-solution-bacteriostatic-water-bac-water-30ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "30ml Bacteriostatic Water | Laboratory Grade",
        description: "Premium 30ml bacteriostatic water with 0.9% benzyl alcohol. Third-party lab verified, sterile-filtered, and designed for laboratory research use."
    },
    "bulk-order-reconstitution-solution-bacteriostatic-water-3ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "Bulk 3ml Bacteriostatic Water for Laboratories",
        description: "Order bulk 3ml laboratory-grade bacteriostatic water with wholesale pricing, custom labeling, and third-party lab-tested quality for research facilities."
    },
    "bulk-order-reconstitution-solution-bacteriostatic-water-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "Bulk 10ml Bacteriostatic Water | Wholesale",
        description: "Bulk 10ml bacteriostatic water for laboratories and research organizations. Wholesale pricing, custom labeling, and verified laboratory quality."
    },
    "bulk-order-reconstitution-solution-bacteriostatic-water-30ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": {
        title: "Bulk 30ml Bacteriostatic Water | Wholesale",
        description: "Purchase wholesale 30ml bacteriostatic water for laboratories. Third-party tested, sterile-filtered, and available with custom bulk fulfillment options."
    },
    "consulting-fee-services": {
        title: "Laboratory Consulting Services | Liv Well Research Labs",
        description: "Professional laboratory consulting services for product sourcing, wholesale solutions, labeling, and research support tailored to your business needs."
    }
};

/**
 * Get SEO metadata for any page or product key
 */
export const getSEOConfig = (key: string, defaultTitle?: string, defaultDesc?: string): PageSEO => {
    if (SEO_CONFIG[key]) {
        return SEO_CONFIG[key];
    }
    return {
        title: defaultTitle || "Liv Well Research Labs",
        description: defaultDesc || "Ultra-Pure Reconstitution Solutions and Bacteriostatic Water for Laboratory Research."
    };
};
