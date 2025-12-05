/**
 * Calculate shipping cost based on total weight in lbs.
 * 
 * Rates:
 * 0 - 5 lbs: $10.00
 * 5.01 - 10 lbs: $15.00
 * 10.01+ lbs: $20.00 + $1.00 per lb over 10 lbs
 */
export const calculateShipping = (weight: number): number => {
    if (weight <= 5) {
        return 10.00;
    } else if (weight <= 10) {
        return 15.00;
    } else {
        const extraWeight = Math.ceil(weight - 10);
        return 20.00 + (extraWeight * 1.00);
    }
};

export const getShippingLabel = (weight: number): string => {
    if (weight <= 5) return "Standard Shipping (0-5 lbs)";
    if (weight <= 10) return "Heavy Goods Shipping (5-10 lbs)";
    return `Freight Shipping (${weight.toFixed(1)} lbs)`;
};
