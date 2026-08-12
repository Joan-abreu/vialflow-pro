export const getBaseSalesCount = (productId: string, isPrivate: boolean = false, productName?: string, categoryName?: string) => {
    const nameLower = productName?.toLowerCase() || "";
    const catLower = categoryName?.toLowerCase() || "";

    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
        hash = ((hash << 5) - hash) + productId.charCodeAt(i);
        hash |= 0;
    }
    const absHash = Math.abs(hash);

    // Specialized consulting/services: 4 to 8
    if (nameLower.includes("consulting fee") || catLower.includes("service")) {
        return (absHash % 5) + 4;
    }

    // Peptides (Boutique/research volume for small/medium business): 15 to 59 bought in past month
    if (
        catLower.includes("peptide") ||
        nameLower.includes("glp") ||
        nameLower.includes("bpc") ||
        nameLower.includes("tb-500") ||
        nameLower.includes("mots") ||
        nameLower.includes("semag") ||
        nameLower.includes("tirz") ||
        nameLower.includes("reta") ||
        nameLower.includes("tesa") ||
        nameLower.includes("ghk") ||
        nameLower.includes("nad") ||
        nameLower.includes("wolverine") ||
        nameLower.includes("klow") ||
        nameLower.includes("aod") ||
        nameLower.includes("ipam") ||
        nameLower.includes("glut") ||
        nameLower.includes("sela") ||
        nameLower.includes("sema")
    ) {
        return (absHash % 45) + 15;
    }

    if (isPrivate) {
        return (absHash % 40) + 10;
    }

    // Regular BAC Water / Solutions products: 150 to 499
    return (absHash % 350) + 150;
};
