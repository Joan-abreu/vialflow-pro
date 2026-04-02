export const getBaseSalesCount = (productId: string) => {
    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
        hash = ((hash << 5) - hash) + productId.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 700 + 100; // Returns a number between 100 and 800
};
