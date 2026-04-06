
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
                    phone: shipment.shipper.phone || "5555555555",
                    email: shipment.shipper.email || "shipper@example.com",
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
                    phone: shipment.recipient.phone || "5555555555",
                    email: shipment.recipient.email || "recipient@example.com",
                },
                parcels: shipment.packages.map((pkg: any) => ({
                    length: Math.max(parseFloat(pkg.length || "1"), 1.0).toString(),
                    width: Math.max(parseFloat(pkg.width || "1"), 1.0).toString(),
                    height: Math.max(parseFloat(pkg.height || "1"), 1.0).toString(),
                    distance_unit: "in",
                    weight: Math.max(parseFloat(pkg.weight || "0.1"), 0.1).toString(),
                    mass_unit: "lb",
                })),
                metadata: shipment.orderId ? `Order #${shipment.orderId.slice(0, 8)}` : "",
                extra: shipment.orderId ? {
                    reference_1: shipment.orderId.slice(0, 8)
                } : {},
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
                metadata: shipment.orderId ? `Order #${shipment.orderId.slice(0, 8)}` : shipment.description || "",
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
        if (!this.settings.api_key) {
            return { success: false, confirmationNumber: "", rawResponse: { error: "Shippo API Token is missing." } };
        }

        try {
            const rawResponse = pickup.shipmentData?.carrier_response;
            if (!rawResponse || !rawResponse.object_id) {
                return { success: false, confirmationNumber: "", rawResponse: { error: "Missing Shippo transaction details from the original shipment." } };
            }

            const transactionId = rawResponse.object_id;
            let carrierAccountId = rawResponse.carrier_account;

            // If not directly in base response, attempt to get it from the rate
            if (!carrierAccountId) {
                const rateId = typeof rawResponse.rate === "string" ? rawResponse.rate : rawResponse.rate?.object_id;
                if (rateId) {
                    const rateRes = await fetch(`${this.apiUrl}rates/${rateId}/`, { headers: this.getHeaders() });
                    if (rateRes.ok) {
                        const rateData = await rateRes.json();
                        carrierAccountId = rateData.carrier_account;
                    }
                }
            }

            // Still no account? Fallback to searching by provider
            if (!carrierAccountId) {
                const accRes = await fetch(`${this.apiUrl}carrier_accounts/`, { headers: this.getHeaders() });
                if (accRes.ok) {
                    const accData = await accRes.json();
                    const provider = rawResponse.provider?.toLowerCase();
                    // Match by provider if we know it, otherwise fallback to USPS or DHL
                    const account = accData.results?.find((a: any) => 
                        (provider && a.carrier === provider) || 
                        (!provider && (a.carrier === "usps" || a.carrier === "dhl_express"))
                    );
                    if (account) carrierAccountId = account.object_id;
                }
            }

            if (!carrierAccountId) {
                return { success: false, confirmationNumber: "", rawResponse: { error: "Could not determine Shippo carrier account for pickup. Make sure the carrier used for the label is enabled in Shippo." } };
            }

            const address = pickup.shipmentData?.ship_from || {};

            const mapState = (s: string) => {
                const map: Record<string, string> = {
                    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
                    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
                    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
                    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
                    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
                    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
                    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
                    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
                    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
                    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"
                };
                if (!s) return "FL";
                if (s.length === 2) return s.toUpperCase();
                return map[s.toLowerCase()] || s.substring(0, 2).toUpperCase();
            };

            const payload = {
                carrier_account: carrierAccountId,
                location: {
                    building_location_type: "Front door", // Shippo is case sensitive: lowercase 'd'
                    building_type: "building",
                    instructions: pickup.instructions || "Please pick up from the main entrance.",
                    address: {
                        name: address.name || "Shipper",
                        company: address.company || address.name || "Company",
                        street1: address.line1 || address.street1 || "Street",
                        city: address.city || "City",
                        state: mapState(address.state_code || address.state),
                        zip: address.postal_code || address.zip || "00000",
                        country: address.country_code || address.country || "US",
                        phone: address.phone || this.settings.shipper_phone || "5555555555",
                        email: address.email || this.settings.shipper_email || "shipper@example.com"
                    }
                },
                transactions: [transactionId],
                requested_start_time: pickup.readyTime.endsWith("Z") ? pickup.readyTime : pickup.readyTime + "Z",
                requested_end_time: pickup.closeTime.endsWith("Z") ? pickup.closeTime : pickup.closeTime + "Z",
                is_batch: false
            };

            const response = await fetch(`${this.apiUrl}pickups/`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            
            if (!response.ok) {
                return { success: false, confirmationNumber: "", rawResponse: { ...data, error: `Shippo HTTP Error: ${response.status} ${response.statusText}` } };
            }

            // Shippo responds with "SUCCESS", "PENDING", or "ERROR" on the status prop
            if (data.status === "ERROR") {
                const msgs = Array.isArray(data.messages) ? data.messages.map((m: any) => m.text).join(", ") : 
                             (typeof data.messages === 'string' ? data.messages : "No detailed error messages provided by Shippo.");
                
                return { 
                    success: false, 
                    confirmationNumber: "", 
                    rawResponse: { 
                        ...data, 
                        error: `Shippo Pickup Failed: ${msgs}. Check if the ready time is too close or if the carrier supports pickups at this time.` 
                    } 
                };
            }

            return {
                success: true,
                confirmationNumber: data.object_id || data.confirmation_code,
                rawResponse: data,
            };
        } catch (e: any) {
            return {
                success: false,
                confirmationNumber: "",
                rawResponse: { error: e.message || "Unknown error creating Shippo pickup." }
            };
        }
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
        if (!this.settings.api_key) return { valid: true, suggestions: [], note: "Shippo API key not set" };
        
        try {
            const response = await fetch(`${this.apiUrl}addresses/`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    name: address.name || "Recipient",
                    street1: address.line1 || address.street1 || (address.address?.line1),
                    street2: address.line2 || address.street2 || (address.address?.line2),
                    city: address.city || address.address?.city,
                    state: address.state || address.address?.state,
                    zip: address.postal_code || address.zip || address.address?.postal_code || address.address?.zip,
                    country: address.country || address.address?.country || "US",
                    validate: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // If it's a 4xx error, it might be Shippo's way of saying it's VERY invalid, but usually Shippo returns 201 with validation_results
                throw new Error(`Shippo validation request failed: ${errorText}`);
            }

            const data = await response.json();
            const isValid = data.validation_results?.is_valid;
            const messages = data.validation_results?.messages || [];
            const resultMsg = messages.map((m: any) => m.text).join(", ");
            
            const suggestions = [];
            // If the address was corrected, add the corrected one as a suggestion
            const inputL1 = (address.line1 || "").toLowerCase().trim();
            const inputL2 = (address.line2 || "").toLowerCase().trim();
            const outL1 = (data.street1 || "").toLowerCase().trim();
            const outL2 = (data.street2 || "").toLowerCase().trim();

            const isMismatch = outL1 !== inputL1 || outL2 !== inputL2 || 
                             data.city?.toLowerCase() !== address.city?.toLowerCase() ||
                             data.state?.toLowerCase() !== address.state?.toLowerCase() ||
                             data.zip?.toLowerCase() !== address.postal_code?.toLowerCase();

            if (isValid && isMismatch) {
                let s1 = data.street1;
                let s2 = data.street2 || "";

                // If street2 is empty but street1 seems to contain a suite/apt/unit, 
                // try to split it to keep the form clean if the user originally had a 2-line format.
                if (!s2 && inputL2) {
                    const suiteRegex = /(?:\s+)(APT|STE|SUITE|UNIT|#|FL|ROOM|RM|BLDG|BUILDING|LOT|PO BOX)(\s+.*)$/i;
                    const match = s1.match(suiteRegex);
                    if (match) {
                        s2 = match[0].trim();
                        s1 = s1.replace(match[0], "").trim();
                    }
                }

                suggestions.push({
                    line1: s1,
                    line2: s2,
                    city: data.city,
                    state: data.state,
                    postal_code: data.zip,
                    country: data.country || "US",
                    source: "Shippo"
                });
            }

            return {
                valid: !!isValid && suggestions.length === 0,
                suggestions: suggestions, 
                note: resultMsg || (isValid ? "Address is valid according to Shippo/USPS" : "Address not found or invalid.")
            };
        } catch (error: any) {
            console.error("Shippo address validation error:", error);
            return {
                valid: true, // Fallback to avoid blocking entire checkout if API is down, but with a warning note
                suggestions: [],
                note: `Validation skipped due to error: ${error.message}`
            };
        }
    }
}
