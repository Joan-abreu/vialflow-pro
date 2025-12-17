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

    private async getToken(purpose: 'ship' | 'track' = 'ship'): Promise<string> {
        // FedEx uses OAuth 2.0
        // Check if we have specific tracking credentials and if the purpose is tracking
        let clientId = this.settings.client_id?.trim();
        let clientSecret = this.settings.client_secret?.trim();

        if (purpose === 'track' && this.settings.tracking_client_id && this.settings.tracking_client_secret) {
            console.log("Using FedEx Tracking Credentials");
            clientId = this.settings.tracking_client_id?.trim();
            clientSecret = this.settings.tracking_client_secret?.trim();
        }

        console.log(`FedEx OAuth Request (${purpose}):`);
        console.log("- API URL:", this.apiUrl);
        // Show first 10 chars of client ID if present
        console.log("- Client ID:", clientId ? `${clientId.substring(0, 10)}...` : "MISSING");
        console.log("- Client Secret:", clientSecret ? "Present (hidden)" : "MISSING");

        const response = await fetch(`${this.apiUrl}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`FedEx OAuth error (${purpose}):`, errorText);
            console.error("Request details:", {
                url: `${this.apiUrl}/oauth/token`,
                client_id_length: clientId?.length,
                client_secret_length: clientSecret?.length,
            });
            throw new Error(`Failed to get FedEx OAuth token: ${errorText}`);
        }

        const data = await response.json();
        console.log(`FedEx OAuth success (${purpose}) - token received`);
        return data.access_token;
    }

    async getRates(shipment: any) {
        const token = await this.getToken("ship");

        const shipDate = new Date().toISOString().split("T")[0];

        const requestBody = {
            accountNumber: {
                value: this.settings.account_number,
            },
            rateRequestControlParameters: {
                returnTransitTimes: true,
            },
            requestedShipment: {
                shipDatestamp: shipDate,
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
                Authorization: `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Rating API error:", errorMessage);
            throw new Error(`FedEx Rating API error: ${errorMessage}`);
        }

        const data = await response.json();
        const rateReplyDetails = data.output?.rateReplyDetails || [];

        // Helpers
        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
        };

        const calculateDays = (start: string, end: string) => {
            const startDate = new Date(start.split('T')[0]);
            const endDate = new Date(end.split('T')[0]);
            const diff = endDate.getTime() - startDate.getTime();
            return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        };

        return {
            success: true,
            rates: rateReplyDetails.map((rate: any) => {
                // Try to find the best delivery estimate
                let estimate = "N/A";
                let targetDateStr = rate.deliveryTimestamp;

                // Fallback to dayFormat if deliveryTimestamp is missing
                if (!targetDateStr && rate.commit?.dateDetail?.dayFormat) {
                    // Check if dayFormat is an ISO string or date-like
                    if (rate.commit.dateDetail.dayFormat.includes("T") || rate.commit.dateDetail.dayFormat.includes("-")) {
                        targetDateStr = rate.commit.dateDetail.dayFormat;
                    } else {
                        // It might just be "Monday", use it directly if we can't parse it as a date later
                        estimate = rate.commit.dateDetail.dayFormat;
                    }
                }

                if (targetDateStr) {
                    try {
                        const days = calculateDays(shipDate, targetDateStr);
                        const dayLabel = days === 1 ? "day" : "days";
                        estimate = `${formatDate(targetDateStr)} (${days} ${dayLabel})`;
                    } catch (e) {
                        // Fallback if parsing fails
                        console.error("Date parsing error", e);
                        if (rate.commit?.dateDetail?.dayFormat) estimate = rate.commit.dateDetail.dayFormat;
                    }
                }
                // 3. Try Transit Time Enum (e.g. TWO_DAYS) -> Convert to human readable
                else if (estimate === "N/A" && rate.operationalDetail?.transitTime) {
                    const transit = rate.operationalDetail.transitTime;
                    switch (transit) {
                        case 'ONE_DAY': estimate = "1 Day"; break;
                        case 'TWO_DAYS': estimate = "2 Days"; break;
                        case 'THREE_DAYS': estimate = "3 Days"; break;
                        case 'FOUR_DAYS': estimate = "4 Days"; break;
                        case 'FIVE_DAYS': estimate = "5 Days"; break;
                        case 'SIX_DAYS': estimate = "6 Days"; break;
                        case 'SEVEN_DAYS': estimate = "7 Days"; break;
                        default: estimate = transit.replace('_', ' ').toLowerCase();
                    }
                }

                return {
                    serviceCode: rate.serviceType,
                    serviceName: this.getServiceName(rate.serviceType),
                    cost: parseFloat(rate.ratedShipmentDetails?.[0]?.totalNetCharge || "0"),
                    currency: rate.ratedShipmentDetails?.[0]?.currency || "USD",
                    estimatedDays: estimate,
                };
            }),
            rawResponse: data,
        };
    }


    async createShipment(shipment: any) {
        const token = await this.getToken('ship');

        const requestBody = {
            labelResponseOptions: "URL_ONLY",
            requestedShipment: {
                shipper: {
                    contact: {
                        personName: this.settings.shipper_name || shipment.shipper.name,
                        phoneNumber: this.settings.shipper_phone || "0000000000",
                        companyName: this.settings.shipper_name || shipment.shipper.name,
                    },
                    address: this.formatAddress(this.settings.shipper_address || shipment.shipper),
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
                serviceType: shipment.serviceCode || this.settings.default_service_code || "FDXG",
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
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Shipping API error:", errorMessage);
            throw new Error(`FedEx Shipping API error: ${errorMessage}`);
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
            shippingCost: parseFloat(output.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.[0]?.totalNetFreight) || "0",
            totalCost: parseFloat(output.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.[0]?.totalNetCharge || "0"),
            rawResponse: data,
        };
    }

    async schedulePickup(pickup: any) {
        const token = await this.getToken('ship');

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
                pickupDateType: this.isFutureDate(pickup.readyTime) ? "FUTURE_DAY" : "SAME_DAY",
                remarks: pickup.instructions,
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
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Pickup API error:", errorMessage);
            throw new Error(`FedEx Pickup API error: ${errorMessage}`);
        }

        const data = await response.json();

        return {
            success: true,
            confirmationNumber: data.output?.pickupConfirmationCode,
            rawResponse: data,
        };
    }

    async trackShipment(trackingNumber: string) {
        const token = await this.getToken('track');

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
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Tracking API error:", errorMessage);
            throw new Error(`FedEx Tracking API error: ${errorMessage}`);
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
        const token = await this.getToken('ship');

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
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Cancel Shipment error:", errorMessage);
            throw new Error(`FedEx Cancel Shipment error: ${errorMessage}`);
        }

        const data = await response.json();

        return {
            success: true,
            rawResponse: data,
        };
    }

    async cancelPickup(confirmationNumber: string, scheduledDate?: string, serviceCode?: string) {
        const token = await this.getToken('ship');

        // Formatted date YYYY-MM-DD
        let formattedDate = scheduledDate;
        if (scheduledDate && scheduledDate.length === 8 && !scheduledDate.includes("-")) {
            // Convert YYYYMMDD to YYYY-MM-DD
            formattedDate = `${scheduledDate.substring(0, 4)}-${scheduledDate.substring(4, 6)}-${scheduledDate.substring(6, 8)}`;
        }

        // Determine carrier code (FDXE vs FDXG)
        let carrierCode = "FDXG"; // Default to Ground
        const codeToCheck = serviceCode || this.settings.default_service_code;

        if (codeToCheck) {
            const upperCode = codeToCheck.toUpperCase();
            if (upperCode === "FEDEX_GROUND" ||
                upperCode === "FDXG" ||
                upperCode === "FEDEX_HOME_DELIVERY" ||
                upperCode.includes("GROUND")) {
                carrierCode = "FDXG";
            } else {
                // Assume Express for everything else (Overnight, 2Day, etc.)
                carrierCode = "FDXE";
            }
        }

        console.log(`Cancelling Pickup - Service: ${codeToCheck}, Inferred Carrier: ${carrierCode}`);

        const requestBody = {
            associatedAccountNumber: {
                value: this.settings.account_number
            },
            pickupConfirmationCode: confirmationNumber,
            scheduledDate: formattedDate,
            // location: "FRONT",
            // remarks: "Cancelled by user via VialFlow",
            carrierCode: carrierCode,
            // accountAddressOfRecord: {
            //     streetLines: [this.settings.shipper_address?.address_line1 || ""],
            //     city: this.settings.shipper_address?.city || "",
            //     stateOrProvinceCode: this.settings.shipper_address?.state_code || "",
            //     postalCode: this.settings.shipper_address?.postal_code || "",
            //     countryCode: this.settings.shipper_address?.country_code || "US"
            // }
        };

        console.log("Cancel Pickup Request:", requestBody);

        const response = await fetch(`${this.apiUrl}/pickup/v1/pickups/cancel`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "X-locale": "en_US",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorMessage = await response.text();
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.errors && Array.isArray(errorJson.errors)) {
                    errorMessage = errorJson.errors.map((e: any) => `${e.code}: ${e.message}`).join("; ");
                }
            } catch (e) {
                // Keep raw text if not JSON
            }
            console.error("FedEx Cancel Pickup error:", errorMessage);
            throw new Error(`FedEx Cancel Pickup error: ${errorMessage}`);
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
    private isFutureDate(readyTime: string): boolean {
        try {
            // readyTime is in YYYY-MM-DDTHH:mm:ss format
            const pickupDateStr = readyTime.split('T')[0];
            const now = new Date().toISOString().split('T')[0];
            return pickupDateStr > now;
        } catch (e) {
            return false;
        }
    }
}
