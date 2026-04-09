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

/**
 * Detect carrier based on tracking number pattern
 */
export const detectCarrier = (trackingNumber: string): string => {
    if (!trackingNumber) return "UPS";
    
    const cleanNumber = trackingNumber.trim().toUpperCase();
    
    // UPS: Usually starts with 1Z
    if (cleanNumber.startsWith("1Z") || cleanNumber.length === 11) return "UPS";
    
    // FedEx: Usually 12, 15, or 20 digits
    if (/^\d{12}$/.test(cleanNumber) || /^\d{15}$/.test(cleanNumber) || /^\d{20}$/.test(cleanNumber)) return "FEDEX";
    
    // USPS: Usually 20-22 digits starting with 9 - Map to SHIPPO carrier as that's our provider
    if (/^9\d{15,21}$/.test(cleanNumber) || /^\d{20,22}$/.test(cleanNumber)) return "SHIPPO";
    
    return "UPS"; // Default fallback
};

/**
 * Get tracking URL based on carrier and tracking number
 */
export const getTrackingUrl = (carrier: string, trackingNumber: string): string => {
    if (!trackingNumber) return "#";
    
    const upperCarrier = (carrier || "UPS").toUpperCase();
    
    switch (upperCarrier) {
        case "UPS":
            return `https://www.ups.com/track?tracknum=${trackingNumber}`;
        case "FEDEX":
            return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
        case "USPS":
            return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
        case "SHIPPO":
            // Fallback to USPS if the pattern matches, as goshippo.com/tracking/ requires account hashes
            if (/^9\d{15,21}$/.test(trackingNumber) || /^\d{20,22}$/.test(trackingNumber)) {
                return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
            }
            // For other Shippo shipments, use the generic goshippo.com tracking which might still need hashes
            return `https://goshippo.com/tracking/${trackingNumber}`;
        default:
            return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    }
};
