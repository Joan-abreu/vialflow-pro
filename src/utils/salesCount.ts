export const getBaseSalesCount = (productId: string, isPrivate: boolean = false, productName?: string) => {
    // Specialized services should have very low volume to remain professional/boutique
    if (productName?.toLowerCase().includes("consulting fee")) {
        let hash = 0;
        for (let i = 0; i < productId.length; i++) {
            hash = ((hash << 5) - hash) + productId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 5 + 4; // Returns a number between 4 and 8
    }

    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
        hash = ((hash << 5) - hash) + productId.charCodeAt(i);
        hash |= 0;
    }
    
    if (isPrivate) {
        return Math.abs(hash) % 80 + 10; // Returns a number between 10 and 89 for private products
    }
    
    return Math.abs(hash) % 700 + 100; // Returns a number between 100 and 800 for regular products
};
