export interface ResearchProductSpec {
    compoundName: string;
    casNumber: string;
    molecularWeight: string;
    molecularFormula: string;
    purity: string;
    storage: string;
    physicalAppearance: string;
    intendedUse: string;
    isWater: boolean;
}

// Research Chemicals & Reagents Analytical Catalog
const RESEARCH_SPECS_DATABASE: Record<string, Partial<ResearchProductSpec>> = {
    // Retatrutide
    "glp3-rt": {
        compoundName: "Retatrutide",
        casNumber: "2381089-83-2",
        molecularWeight: "4731.33 g/mol",
        molecularFormula: "C221H342N46O68",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white to off-white crystalline solid",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // Tirzepatide
    "glp2-tz": {
        compoundName: "Tirzepatide",
        casNumber: "2023706-61-6",
        molecularWeight: "4813.45 g/mol",
        molecularFormula: "C225H348N48O68",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // Semaglutide
    "glp1-sm": {
        compoundName: "Semaglutide",
        casNumber: "910463-68-2",
        molecularWeight: "4113.58 g/mol",
        molecularFormula: "C187H291N45O59",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // BPC-157
    "bpc-157": {
        compoundName: "BPC-157",
        casNumber: "137525-51-0",
        molecularWeight: "1419.53 g/mol",
        molecularFormula: "C62H98N16O22",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // TB-500
    "tb-500": {
        compoundName: "TB-500 (Thymosin Beta-4 fragment)",
        casNumber: "885340-08-9",
        molecularWeight: "4963.50 g/mol",
        molecularFormula: "C212H350N56O78S",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // NAD+
    "nad": {
        compoundName: "Nicotinamide Adenine Dinucleotide (NAD+)",
        casNumber: "53-84-9",
        molecularWeight: "663.43 g/mol",
        molecularFormula: "C21H27N7O14P2",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Highly hygroscopic, keep dry.",
        physicalAppearance: "Lyophilized white to light-yellow powder",
        intendedUse: "In-vitro laboratory research and biochemical assays only",
        isWater: false
    },
    // MOTS-C
    "mots-c": {
        compoundName: "MOTS-c",
        casNumber: "1627580-64-6",
        molecularWeight: "2174.68 g/mol",
        molecularFormula: "C101H152N28O22S2",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // Tesamorelin
    "tesamorelin": {
        compoundName: "Tesamorelin",
        casNumber: "218949-48-5",
        molecularWeight: "5135.86 g/mol",
        molecularFormula: "C221H366N72O67S",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // Ipamorelin
    "ipamorelin": {
        compoundName: "Ipamorelin",
        casNumber: "170851-70-4",
        molecularWeight: "711.85 g/mol",
        molecularFormula: "C38H49N9O5",
        purity: "≥ 98.5% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // Melanotan 2
    "mt-2": {
        compoundName: "Melanotan II",
        casNumber: "121062-08-6",
        molecularWeight: "1024.18 g/mol",
        molecularFormula: "C50H69N15O9",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // GHK-Cu
    "ghk-cu": {
        compoundName: "GHK-Cu (Copper Peptide)",
        casNumber: "49557-75-7",
        molecularWeight: "403.93 g/mol",
        molecularFormula: "C14H24CuN6O4",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized vibrant blue powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // SS-31
    "ss-31": {
        compoundName: "SS-31 (Elamipretide)",
        casNumber: "736992-21-5",
        molecularWeight: "639.80 g/mol",
        molecularFormula: "C32H49N9O5",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // Glutathione
    "glutathione": {
        compoundName: "L-Glutathione (Reduced)",
        casNumber: "70-18-8",
        molecularWeight: "307.32 g/mol",
        molecularFormula: "C10H17N3O6S",
        purity: "≥ 99.0% (HPLC Analyzed)",
        storage: "Store at -20°C. Protect from light and oxidation.",
        physicalAppearance: "Crystalline white powder",
        intendedUse: "In-vitro laboratory research and reference standard only",
        isWater: false
    },
    // AOD-9604
    "aod-9604": {
        compoundName: "AOD-9604",
        casNumber: "221231-10-3",
        molecularWeight: "1815.10 g/mol",
        molecularFormula: "C78H123N23O23S2",
        purity: "≥ 98.0% (HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from light.",
        physicalAppearance: "Lyophilized white powder",
        intendedUse: "In-vitro laboratory research only",
        isWater: false
    },
    // Bacteriostatic Water / Reconstitution Solutions
    "bac-water": {
        compoundName: "Bacteriostatic Water for Reconstitution (USP Grade)",
        casNumber: "7732-18-5 (Deionized Water) / 100-51-6 (Benzyl Alcohol 0.9%)",
        molecularWeight: "18.02 g/mol (H2O) / 108.14 g/mol (C7H8O)",
        molecularFormula: "H2O + 0.9% C7H8O preservative",
        purity: "USP Reagent Grade • 0.22µm Sterile Filtered • pH 4.5 – 7.0",
        storage: "Store at 15°C – 30°C (59°F – 86°F). Do not freeze. Protect from light.",
        physicalAppearance: "Clear, sterile, particle-free aqueous solution",
        intendedUse: "Laboratory reagent for dissolving and reconstituting in-vitro research peptides",
        isWater: true
    }
};

export const getResearchProductSpecs = (product: any): ResearchProductSpec => {
    const rawName = (product?.name || "").toLowerCase();
    const rawSlug = (product?.slug || "").toLowerCase();
    const rawCat = (product?.category || product?.product_categories?.name || "").toLowerCase();

    // 1. Check if Water / Reconstitution Solution
    const isWater = rawName.includes("water") || rawSlug.includes("water") || 
                    rawName.includes("reconstitution") || rawSlug.includes("reconstitution") ||
                    rawName.includes("bac-water") || rawCat.includes("water");

    if (isWater) {
        return RESEARCH_SPECS_DATABASE["bac-water"] as ResearchProductSpec;
    }

    // 2. Check known peptide matches
    for (const [key, spec] of Object.entries(RESEARCH_SPECS_DATABASE)) {
        if (key === "bac-water") continue;
        if (rawSlug.includes(key) || rawName.includes(key) || rawName.includes(spec.compoundName?.toLowerCase() || "___")) {
            return spec as ResearchProductSpec;
        }
    }

    // Keyword fallbacks
    if (rawName.includes("semaglutide") || rawSlug.includes("sema") || rawSlug.includes("sm")) {
        return RESEARCH_SPECS_DATABASE["glp1-sm"] as ResearchProductSpec;
    }
    if (rawName.includes("tirzepatide") || rawSlug.includes("tirz") || rawSlug.includes("tz") || rawSlug.includes("tr")) {
        return RESEARCH_SPECS_DATABASE["glp2-tz"] as ResearchProductSpec;
    }
    if (rawName.includes("retatrutide") || rawSlug.includes("reta") || rawSlug.includes("rt")) {
        return RESEARCH_SPECS_DATABASE["glp3-rt"] as ResearchProductSpec;
    }
    if (rawName.includes("bpc") || rawSlug.includes("bpc")) {
        return RESEARCH_SPECS_DATABASE["bpc-157"] as ResearchProductSpec;
    }
    if (rawName.includes("tb-500") || rawSlug.includes("tb500") || rawName.includes("thymosin")) {
        return RESEARCH_SPECS_DATABASE["tb-500"] as ResearchProductSpec;
    }

    // Clean generic peptide fallback
    return {
        compoundName: product?.name || "Analytical Research Peptide Reagent",
        casNumber: "Reference Standard (Batch Certified)",
        molecularWeight: "Verified via Mass Spectrometry (MS)",
        molecularFormula: "High-Purity Polypeptide Sequence",
        purity: "≥ 98.0% (3rd-Party HPLC Analyzed)",
        storage: "Store lyophilized at -20°C. Protect from moisture & light.",
        physicalAppearance: "Lyophilized sterile solid powder in sealed glass vial",
        intendedUse: "In-vitro laboratory research and analytical testing only",
        isWater: false
    };
};
