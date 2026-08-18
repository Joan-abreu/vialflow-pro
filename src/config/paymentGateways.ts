export type PaymentGatewayProvider = 
    | "square" 
    | "stripe" 
    | "authorizenet" 
    | "clover"
    | "nmi"
    | "paypal"
    | "manual";

export interface SquareGatewayConfig {
    appId: string;
    locationId: string;
    environment: "sandbox" | "production";
}

export interface StripeGatewayConfig {
    publishableKey: string;
}

export interface AuthorizeNetGatewayConfig {
    apiLoginId: string;
    clientKey: string;
    environment: "sandbox" | "production";
}

export interface CloverGatewayConfig {
    merchantId: string;
    apiToken: string;
    environment: "sandbox" | "production";
}

export interface NMIGatewayConfig {
    securityKey: string;
    tokenizationKey: string;
}

export interface PayPalGatewayConfig {
    clientId: string;
    environment: "sandbox" | "production";
}

export interface ManualPaymentConfig {
    zelleEmail?: string;
    zelleName?: string;
    cashAppTag?: string;
    venmoUser?: string;
    cryptoAddress?: string;
    instructions?: string;
}

export interface PaymentGatewaysSettings {
    activeProvider: PaymentGatewayProvider;
    backupProvider: PaymentGatewayProvider;
    autoFailoverEnabled: boolean;
    failThreshold: number;
    square: SquareGatewayConfig;
    stripe: StripeGatewayConfig;
    authorizenet: AuthorizeNetGatewayConfig;
    clover: CloverGatewayConfig;
    nmi: NMIGatewayConfig;
    paypal: PayPalGatewayConfig;
    manual: ManualPaymentConfig;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentGatewaysSettings = {
    activeProvider: "square",
    backupProvider: "stripe",
    autoFailoverEnabled: true,
    failThreshold: 3,
    square: {
        appId: import.meta.env.VITE_SQUARE_APP_ID || "",
        locationId: import.meta.env.VITE_SQUARE_LOCATION_ID || "",
        environment: "sandbox",
    },
    stripe: {
        publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
    },
    authorizenet: {
        apiLoginId: "",
        clientKey: "",
        environment: "sandbox",
    },
    clover: {
        merchantId: "",
        apiToken: "",
        environment: "sandbox",
    },
    nmi: {
        securityKey: "",
        tokenizationKey: "",
    },
    paypal: {
        clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "",
        environment: "sandbox",
    },
    manual: {
        zelleEmail: "payments@livwelllabs.com",
        zelleName: "Liv Well Labs LLC",
        cashAppTag: "$LivWellLabs",
        instructions: "Please include your Order ID in the payment memo. Your order will be processed immediately upon receipt.",
    },
};
