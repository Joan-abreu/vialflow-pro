export const DEFAULT_COMPANY_INFO = {
    name: "Liv Well Research Labs",
    tagline: "Direct Manufacturer of Ultra-Pure Reconstitution Solutions & Research Peptides",
    addressLine1: "3839 N Andrews Ave",
    cityStateZip: "Oakland Park, FL 33309, USA",
    city: "Oakland Park",
    state: "FL",
    zip: "33309",
    country: "US",
    email: "sales@livwellresearchlabs.com",
    phone: "1-800-423-8002",
    website: "https://livwellresearchlabs.com",
    logoUrl: "/favicon.png",
};

export const DEFAULT_SHIPPER = {
    name: DEFAULT_COMPANY_INFO.name,
    phone: DEFAULT_COMPANY_INFO.phone,
    address: {
        line1: DEFAULT_COMPANY_INFO.addressLine1,
        city: DEFAULT_COMPANY_INFO.city,
        state: DEFAULT_COMPANY_INFO.state,
        zip: DEFAULT_COMPANY_INFO.zip,
        country: DEFAULT_COMPANY_INFO.country,
    }
};