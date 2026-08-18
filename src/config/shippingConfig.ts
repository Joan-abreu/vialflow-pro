export interface StoreShippingConfig {
    /** Cutoff hour in 24h format in the designated timezone (e.g. 15 = 3:00 PM) */
    cutoffHour: number;
    /** Cutoff minute (e.g. 0) */
    cutoffMinute: number;
    /** Timezone for shipping fulfillment (IANA format) */
    timeZone: string;
    /** Friendly text for the cutoff time shown to customers */
    cutoffDisplayLabel: string;
    /** Free shipping minimum order threshold in USD */
    freeShippingThreshold: number;
    /** Estimated business days for standard delivery (min and max) */
    estimatedDeliveryDays: {
        min: number;
        max: number;
    };
    /** Whether shipping fulfillment happens on Saturdays */
    shipsOnSaturday: boolean;
}

export const DEFAULT_SHIPPING_CONFIG: StoreShippingConfig = {
    cutoffHour: 15, // 3:00 PM
    cutoffMinute: 0,
    timeZone: "America/New_York", // Eastern Time
    cutoffDisplayLabel: "3:00 PM ET (12:00 PM PT)",
    freeShippingThreshold: 100,
    estimatedDeliveryDays: {
        min: 2,
        max: 4,
    },
    shipsOnSaturday: false,
};
