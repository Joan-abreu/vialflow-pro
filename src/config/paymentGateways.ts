export type PaymentGatewayProvider = 
    | "square" 
    | "stripe" 
    | "authorizenet" 
    | "clover"
    | "nmi"
    | "paypal"
    | "manual"
    | "manual_terminal"
    | "offline_card";

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

export interface P2PMethodConfig {

    enabled: boolean;
    qrCodeUrl: string;
    handle: string; // Zelle email/phone, Venmo @username, CashApp $cashtag
    recipientName: string;
    instructions: string;
    deepLinkUrl?: string;
}

export interface P2PPaymentSettings {
    enabled: boolean;
    verificationSlaHours: number; // default 24
    maxProofResubmissions: number; // default 2
    maxP2POrderAmount: number; // default 2500
    zelle: P2PMethodConfig;
    venmo: P2PMethodConfig;
    cashapp: P2PMethodConfig;
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
    manual_terminal: ManualTerminalConfig;
    p2p: P2PPaymentSettings;
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
    manual_terminal: {
        enabled: true,
        title: "Manual Virtual Terminal / Phone Order",
        instructions: "Pay securely with Credit Card. Your card details will be vaulted and verified upon order processing.",
    },
    p2p: {
        enabled: true,
        verificationSlaHours: 24,
        maxProofResubmissions: 2,
        maxP2POrderAmount: 2500,
        zelle: {
            enabled: true,
            qrCodeUrl: "",
            handle: "payments@livwelllabs.com",
            recipientName: "Liv Well Research Labs Inc.",
            instructions: "Scan the Zelle QR code or send payment to our email handle. Put your ORDER # in the memo field."
        },


        venmo: {
            enabled: true,
            qrCodeUrl: "",
            handle: "@livholdinggroupinc",
            recipientName: "Liv Holding Group Inc",
            instructions: "Scan the Venmo QR code or send to @livholdinggroupinc. Put your ORDER # in the note.",
            deepLinkUrl: "https://venmo.com/livholdinggroupinc"
        },

        cashapp: {
            enabled: true,
            qrCodeUrl: "",
            handle: "$LivWellLabs",
            recipientName: "Liv Well Labs",
            instructions: "Scan Cash App QR or send to $LivWellLabs. Include your ORDER # in the payment note.",
            deepLinkUrl: "https://cash.app/$LivWellLabs"
        }
    }
};


