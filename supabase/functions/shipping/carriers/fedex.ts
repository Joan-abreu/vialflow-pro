// FedEx Carrier Implementation
// Documentation: https://developer.fedex.com/api/en-us/home.html
// Note: Meter Number is optional in modern FedEx REST API (not required for most operations)

export class FedExCarrier {
    private settings: any;
    private apiUrl: string;

    constructor(settings: any) {
        this.settings = settings;
        this.apiUrl = settings.api_url || "https://apis-sandbox.fedex.com";
    }


    private async getToken(): Promise<string> {
        // FedEx uses OAuth 2.0
        console.log("FedEx OAuth Request:");
        console.log("- API URL:", this.apiUrl);
        console.log("- Client ID:", this.settings.client_id ? `${this.settings.client_id.substring(0, 10)}...` : "MISSING");
        console.log("- Client Secret:", this.settings.client_secret ? "Present (hidden)" : "MISSING");

        const response = await fetch(`${this.apiUrl}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: this.settings.client_id,
                client_secret: this.settings.client_secret,
            }).toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("FedEx OAuth error:", errorText);
            console.error("Request details:", {
                url: `${this.apiUrl}/oauth/token`,
                client_id_length: this.settings.client_id?.length,
                client_secret_length: this.settings.client_secret?.length,
            });
            throw new Error(`Failed to get FedEx OAuth token: ${errorText}`);
        }

        const data = await response.json();
        console.log("FedEx OAuth success - token received");
        return data.access_token;
    }

    async getRates(shipment: any) {
        const token = await this.getToken();

        const requestBody = {
            accountNumber: {
                value: this.settings.account_number,
            },
            requestedShipment: {
                shipper: {
                    address: this.formatAddress(shipment.shipper),
                },
                recipient: {
                    address: this.formatAddress(shipment.recipient),
                },
                pickupType: "USE_SCHEDULED_PICKUP",
                rateRequestType: ["LIST", "ACCOUNT"],
                requestedPackageLineItems: shipment.packages.map((pkg: any) => ({
                    weight: {
                        units: "LB",
                        value: pkg.weight,
                    },
                    dimensions: {
                        length: pkg.length,
                        width: pkg.width,
                        height: pkg.height,
                        units: "IN",
                    },
                })),
            },
        };
        console.log("FedEx Request Body:", requestBody);

        const response = await fetch(`${this.apiUrl}/rate/v1/rates/quotes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("FedEx Rating API error:", error);
            throw new Error(`FedEx Rating API error: ${error}`);
        }

        const data = await response.json();
        const rateReplyDetails = data.output?.rateReplyDetails || [];

        return {
            success: true,
            rates: rateReplyDetails.map((rate: any) => ({
                serviceCode: rate.serviceType,
                serviceName: this.getServiceName(rate.serviceType),
                cost: parseFloat(rate.ratedShipmentDetails?.[0]?.totalNetCharge || "0"),
                currency: rate.ratedShipmentDetails?.[0]?.currency || "USD",
                estimatedDays: rate.commit?.dateDetail?.dayFormat,
            })),
            rawResponse: data,
        };
    }

    async createShipment(shipment: any) {
        const token = await this.getToken();

        const requestBody = {
            labelResponseOptions: "URL_ONLY",
            requestedShipment: {
                shipper: {
                    contact: {
                        personName: shipment.shipper.name,
                        phoneNumber: this.settings.shipper_phone || "0000000000",
                        companyName: this.settings.shipper_name || shipment.shipper.name,
                    },
                    address: this.formatAddress(shipment.shipper),
                },
                recipients: [
                    {
                        contact: {
                            personName: shipment.recipient.name,
                            phoneNumber: shipment.recipient.phone || "0000000000",
                        },
                        address: this.formatAddress(shipment.recipient),
                    },
                ],
                shipDatestamp: new Date().toISOString().split("T")[0],
                serviceType: shipment.serviceCode || this.settings.default_service_code || "FEDEX_GROUND",
                packagingType: "YOUR_PACKAGING",
                pickupType: "USE_SCHEDULED_PICKUP",
                blockInsightVisibility: false,
                shippingChargesPayment: {
                    paymentType: "SENDER",
                },
                labelSpecification: {
                    imageType: "PDF",
                    labelStockType: "PAPER_4X6",
                },
                requestedPackageLineItems: shipment.packages.map((pkg: any) => ({
                    weight: {
                        units: "LB",
                        value: pkg.weight,
                    },
                    dimensions: {
                        length: pkg.length,
                        width: pkg.width,
                        height: pkg.height,
                        units: "IN",
                    },
                })),
            },
            accountNumber: {
                value: this.settings.account_number,
            },
        };

        const response = await fetch(`${this.apiUrl}/ship/v1/shipments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("FedEx Shipping API error:", error);
            throw new Error(`FedEx Shipping API error: ${error}`);
        }

        const data = await response.json();
        const output = data.output?.transactionShipments?.[0];

        if (!output) {
            throw new Error("No shipment results returned from FedEx");
        }

        const trackingNumber = output.pieceResponses?.[0]?.trackingNumber;
        const labelUrl = output.pieceResponses?.[0]?.packageDocuments?.[0]?.url;

        // Download the label PDF from URL and convert to base64
        let labelData = "";
        if (labelUrl) {
            try {
                const labelResponse = await fetch(labelUrl);
                const labelBlob = await labelResponse.arrayBuffer();
                labelData = btoa(String.fromCharCode(...new Uint8Array(labelBlob)));
            } catch (error) {
                console.error("Error downloading FedEx label:", error);
            }
        }

        return {
            success: true,
            trackingNumber,
            trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
            labelData,
            labelUrl,
            labelFormat: "PDF",
            serviceName: this.getServiceName(shipment.serviceCode || this.settings.default_service_code),
            cost: parseFloat(output.shipmentDocuments?.[0]?.shippingDocumentDisposition || "0"),
            totalCost: parseFloat(output.completedShipmentDetail?.shipmentRating?.totalNetCharge || "0"),
            rawResponse: data,
        };
    }

    async schedulePickup(pickup: any) {
        const token = await this.getToken();

        const requestBody = {
            associatedAccountNumber: {
                value: this.settings.account_number,
            },
            carrierCode: pickup.serviceCode || this.settings.default_service_code,
            originDetail: {
                pickupLocation: {
                    contact: {
                        personName: pickup.contactName || "Shipping Department",
                        phoneNumber: pickup.phone || this.settings.shipper_phone,
                        companyName: pickup.companyName || this.settings.shipper_name,
                    },
                    address: this.formatAddress(pickup.address || this.settings.shipper_address),
                },
                readyDateTimestamp: pickup.readyTime,
                customerCloseTime: pickup.closeTime,
                pickupDateType: "SAME_DAY",
            },
            packageDetails: {
                count: pickup.packageCount || 1,
                weight: {
                    units: "LB",
                    value: pickup.totalWeight || 1,
                },
            },
        };

        console.log("FedEx Pickup Request:", requestBody);

        const response = await fetch(`${this.apiUrl}/pickup/v1/pickups`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("FedEx Pickup API error:", error);
            throw new Error(`FedEx Pickup API error: ${error}`);
        }

        const data = await response.json();

        return {
            success: true,
            confirmationNumber: data.output?.pickupConfirmationCode,
            rawResponse: data,
        };
    }

    async trackShipment(trackingNumber: string) {
        const token = await this.getToken();

        const requestBody = {
            includeDetailedScans: true,
            trackingInfo: [
                {
                    trackingNumberInfo: {
                        trackingNumber,
                    },
                },
            ],
        };

        const response = await fetch(`${this.apiUrl}/track/v1/trackingnumbers`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("FedEx Tracking API error:", error);
            throw new Error(`FedEx Tracking API error: ${error}`);
        }

        const data = await response.json();
        const trackingInfo = data.output?.completeTrackResults?.[0]?.trackResults?.[0];

        return {
            success: true,
            status: this.mapTrackingStatus(trackingInfo?.latestStatusDetail?.statusByLocale),
            deliveredAt: trackingInfo?.dateAndTimes?.find((d: any) => d.type === "ACTUAL_DELIVERY")?.dateTime,
            events: trackingInfo?.scanEvents || [],
            rawResponse: data,
        };
    }

    async cancelShipment(trackingNumber: string) {
        const token = await this.getToken();

        const requestBody = {
            accountNumber: {
                value: this.settings.account_number,
            },
            trackingNumber,
            deletionControl: "DELETE_ALL_PACKAGES",
        };

        const response = await fetch(`${this.apiUrl}/ship/v1/shipments/cancel`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("FedEx Cancel Shipment error:", error);
            throw new Error(`FedEx Cancel Shipment error: ${error}`);
        }

        const data = await response.json();

        return {
            success: true,
            rawResponse: data,
        };
    }

    private formatAddress(address: any) {
        return {
            streetLines: [address.address?.line1 || address.line1],
            city: address.address?.city || address.city,
            stateOrProvinceCode: address.address?.state || address.state,
            postalCode: address.address?.postal_code || address.postal_code || address.address?.zip || address.zip,
            countryCode: address.address?.country || address.country || "US",
            residential: false,
        };
    }

    private mapTrackingStatus(statusDescription: string): string {
        if (!statusDescription) return "unknown";

        const lower = statusDescription.toLowerCase();
        if (lower.includes("delivered")) return "delivered";
        if (lower.includes("out for delivery")) return "out_for_delivery";
        if (lower.includes("in transit")) return "in_transit";
        if (lower.includes("picked up")) return "picked_up";
        if (lower.includes("exception")) return "exception";

        return "in_transit";
    }

    private getServiceName(code: string): string {
        const services: Record<string, string> = {
            "FEDEX_GROUND": "FedEx Ground",
            "FEDEX_2_DAY": "FedEx 2Day",
            "FEDEX_2_DAY_AM": "FedEx 2Day A.M.",
            "FEDEX_EXPRESS_SAVER": "FedEx Express Saver",
            "STANDARD_OVERNIGHT": "FedEx Standard Overnight",
            "PRIORITY_OVERNIGHT": "FedEx Priority Overnight",
            "FIRST_OVERNIGHT": "FedEx First Overnight",
            "FEDEX_1_DAY_FREIGHT": "FedEx 1Day Freight",
            "FEDEX_2_DAY_FREIGHT": "FedEx 2Day Freight",
            "FEDEX_3_DAY_FREIGHT": "FedEx 3Day Freight",
            "INTERNATIONAL_ECONOMY": "FedEx International Economy",
            "INTERNATIONAL_PRIORITY": "FedEx International Priority",
        };
        return services[code] || code;
    }
}
