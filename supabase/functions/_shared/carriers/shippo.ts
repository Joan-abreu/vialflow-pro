
import { ICarrier } from "./types.ts";

export class ShippoCarrier implements ICarrier {
    private settings: any;
    private apiUrl: string;

    constructor(settings: any) {
        this.settings = settings;
        this.apiUrl = settings.api_url || "https://api.goshippo.com/";
    }

    private getHeaders() {
        return {
            "Content-Type": "application/json",
            "Authorization": `ShippoToken ${this.settings.api_key}`,
        };
    }

    async getRates(shipment: any) {
        if (!this.settings.api_key) {
            throw new Error("Shippo API Token is missing in carrier settings.");
        }
        // Shippo requires creating a shipment object first to get rates
        const response = await fetch(`${this.apiUrl}shipments/`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                address_from: {
                    name: shipment.shipper.name || shipment.shipper.company || "Shipper",
                    company: shipment.shipper.company || shipment.shipper.name || "Shipper",
                    street1: shipment.shipper.address?.line1 || shipment.shipper.line1,
                    street2: shipment.shipper.address?.line2 || shipment.shipper.line2,
                    city: shipment.shipper.address?.city || shipment.shipper.city,
                    state: shipment.shipper.address?.state || shipment.shipper.state,
                    zip: shipment.shipper.address?.postal_code || shipment.shipper.address?.zip || shipment.shipper.zip || shipment.shipper.postal_code,
                    country: shipment.shipper.address?.country || shipment.shipper.country || "US",
                },
                address_to: {
                    name: shipment.recipient.name || shipment.recipient.company || "Recipient",
                    company: shipment.recipient.company || shipment.recipient.name || "Recipient",
                    street1: shipment.recipient.address?.line1 || shipment.recipient.line1,
                    street2: shipment.recipient.address?.line2 || shipment.recipient.line2,
                    city: shipment.recipient.address?.city || shipment.recipient.city,
                    state: shipment.recipient.address?.state || shipment.recipient.state,
                    zip: shipment.recipient.address?.postal_code || shipment.recipient.address?.zip || shipment.recipient.zip || shipment.recipient.postal_code,
                    country: shipment.recipient.address?.country || shipment.recipient.country || "US",
                },
                parcels: shipment.packages.map((pkg: any) => ({
                    length: Math.max(parseFloat(pkg.length || "1"), 1.0).toString(),
                    width: Math.max(parseFloat(pkg.width || "1"), 1.0).toString(),
                    height: Math.max(parseFloat(pkg.height || "1"), 1.0).toString(),
                    distance_unit: "in",
                    weight: Math.max(parseFloat(pkg.weight || "0.1"), 0.1).toString(),
                    mass_unit: "lb",
                })),
                async: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Shippo API error: ${error}`);
        }

        const data = await response.json();
        const rates = data.rates || [];

        // If no rates are returned, check for validation/error messages in the response
        if (rates.length === 0 && data.messages && data.messages.length > 0) {
            const errorMsg = data.messages.map((m: any) => `${m.source}: ${m.text}`).join(" | ");
            console.error("Shippo returned no rates:", errorMsg);
            return {
                success: false,
                rates: [],
                error: `Shippo: No rates found. ${errorMsg}`,
                rawResponse: data,
            };
        }

        return {
            success: true,
            rates: rates.map((rate: any) => ({
                serviceCode: rate.object_id, // We use object_id as serviceCode to purchase later
                serviceName: `${rate.provider} ${rate.servicelevel.name}`,
                cost: parseFloat(rate.amount),
                currency: rate.currency,
                estimatedDays: rate.estimated_days ? `${rate.estimated_days} days` : "N/A",
            })),
            rawResponse: data,
        };
    }

    async createShipment(shipment: any) {
        // In Shippo, createShipment corresponds to purchasing a transaction from a rate
        // The serviceCode we passed in getRates is the Shippo Rate object_id
        const response = await fetch(`${this.apiUrl}transactions/`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                rate: shipment.serviceCode,
                label_file_type: "PDF",
                async: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Shippo Purchase error: ${error}`);
        }

        const data = await response.json();

        if (data.status !== "SUCCESS") {
            throw new Error(`Shippo Transaction failed: ${JSON.stringify(data.messages)}`);
        }

        return {
            success: true,
            trackingNumber: data.tracking_number,
            trackingUrl: data.tracking_url_provider,
            labelData: "", // Shippo provides a URL, generally we don't need to return base64 if labelUrl exists
            labelUrl: data.label_url,
            labelFormat: "PDF",
            serviceName: shipment.serviceName || "Shippo Shipment",
            cost: parseFloat(data.amount || "0"),
            totalCost: parseFloat(data.amount || "0"),
            rawResponse: data,
        };
    }

    async schedulePickup(pickup: any) {
        // Shippo pickup API implementation if needed
        return {
            success: false,
            confirmationNumber: "",
            rawResponse: { error: "Pickup scheduling not implemented for Shippo carrier yet" },
        };
    }

    async trackShipment(trackingNumber: string) {
        // Shippo tracking requires carrier name. We might need to store it or guess it.
        // For now, return a generic success as tracking is usually done via URL.
        return {
            success: false,
            status: "tracking_via_url",
            events: [],
            rawResponse: { message: "Use trackingUrl for real-time updates" },
        };
    }

    async cancelShipment(trackingNumber: string) {
        // Shippo uses refunds/ endpoint
        return {
            success: false,
            rawResponse: { error: "Cancellation not implemented for Shippo carrier yet" },
        };
    }

    async cancelPickup(confirmationNumber: string) {
        return {
            success: false,
            rawResponse: { error: "Pickup cancellation not implemented for Shippo carrier yet" },
        };
    }

    async validateAddress(address: any) {
        try {
            const response = await fetch(`${this.apiUrl}addresses/`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    name: address.name || "Recipient",
                    street1: address.line1 || address.street1,
                    city: address.city,
                    state: address.state,
                    zip: address.postal_code || address.zip,
                    country: address.country || "US",
                    validate: true,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Shippo validation error: ${error}`);
            }

            const data = await response.json();
            
            // Shippo returns validation results in the 'validation_results' field
            const isValid = data.validation_results?.is_valid;
            const messages = data.validation_results?.messages || [];

            return {
                valid: isValid,
                suggestions: [], // Shippo usually provides messages rather than a list of suggested objects like UPS
                note: messages.map((m: any) => m.text).join(", ")
            };
        } catch (error: any) {
            console.error("Shippo address validation error:", error);
            return {
                valid: true, // Fallback to avoid blocking
                suggestions: [],
                note: `Validation error: ${error.message}`
            };
        }
    }
}
