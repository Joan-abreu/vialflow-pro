
import { ICarrier } from "./types.ts";

export class UPSCarrier implements ICarrier {
    private settings: any;
    private apiUrl: string;

    constructor(settings: any) {
        this.settings = settings;
        this.apiUrl = settings.api_url || "https://wwwcie.ups.com/api";
    }

    private async getToken(): Promise<string> {
        const credentials = btoa(`${this.settings.client_id}:${this.settings.client_secret}`);
        
        // OAuth endpoint does not include /api in the path
        const baseUrl = this.apiUrl.endsWith('/api') ? this.apiUrl.slice(0, -4) : this.apiUrl;

        const response = await fetch(`${baseUrl}/security/v1/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${credentials}`,
            },
            body: "grant_type=client_credentials",
        });

        if (!response.ok) {
            throw new Error("Failed to get UPS OAuth token");
        }

        const data = await response.json();
        return data.access_token;
    }

    async getRates(shipment: any) {
        const token = await this.getToken();

        // Use 'Shop' endpoint to get all available rates for the route
        const baseUrl = this. apiUrl.endsWith('/api') ? this.apiUrl.slice(0, -4) : this.apiUrl;
        const response = await fetch(`${baseUrl}/api/rating/v1/Shop?additionalinfo=timeintransit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "transId": crypto.randomUUID(),
                "transactionSrc": "VialFlow",
            },
            body: JSON.stringify({
                RateRequest: {
                    Request: {
                        RequestOption: "Shop",
                        TransactionReference: {
                            CustomerContext: "Rating Request",
                        },
                    },
                    Shipment: {
                        DeliveryTimeInformation: {
                            PackageBillType: "03",
                            Pickup: {
                                Date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
                                Time: "090000"
                            }
                        },
                        Shipper: this.formatAddress(shipment.shipper, this.settings.account_number),
                        ShipTo: this.formatAddress(shipment.recipient),
                        ShipFrom: this.formatAddress(shipment.shipper),
                        Package: shipment.packages.map((pkg: any) => ({
                            PackagingType: {
                                Code: "02",
                                Description: "Package",
                            },
                            Dimensions: {
                                UnitOfMeasurement: { Code: "IN" },
                                Length: pkg.length.toString(),
                                Width: pkg.width.toString(),
                                Height: pkg.height.toString(),
                            },
                            PackageWeight: {
                                UnitOfMeasurement: { Code: "LBS" },
                                Weight: pkg.weight.toString(),
                            },
                        })),
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`UPS Rating API error: ${error}`);
        }

        const data = await response.json();
        
        if (data.response?.errors || data.Fault) {
            const errorMsg = JSON.stringify(data.response?.errors || data.Fault);
            throw new Error(`UPS Rating API returned error: ${errorMsg}`);
        }

        const rates = data.RateResponse?.RatedShipment;
        if (!rates) {
             throw new Error(`UPS Rating API returned no rates. Response: ${JSON.stringify(data)}`);
        }

        return {
            success: true,
            rates: (Array.isArray(rates) ? rates : [rates]).map((rate: any) => ({
                serviceCode: rate.Service.Code,
                serviceName: this.getServiceName(rate.Service.Code),
                cost: parseFloat(rate.TotalCharges.MonetaryValue),
                currency: rate.TotalCharges.CurrencyCode,
                estimatedDays: (() => {
                    const arrivalDateStr = rate.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date;
                    if (arrivalDateStr && arrivalDateStr.length === 8) {
                        try {
                            const year = parseInt(arrivalDateStr.substring(0, 4));
                            const month = parseInt(arrivalDateStr.substring(4, 6)) - 1;
                            const day = parseInt(arrivalDateStr.substring(6, 8));
                            // Add 12 hours to avoid timezone issues when displaying the month/date
                            const arrivalDate = new Date(year, month, day, 12, 0, 0);
                            return arrivalDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        } catch (e) {
                             // Fallback if parsing fails
                        }
                    }
                    
                    const days = rate.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit || 
                                 rate.GuaranteedDelivery?.BusinessDaysInTransit;
                                 
                    if (days) return `${days} Business Days`;
                    return "N/A";
                })(),
            })),
            rawResponse: data,
        };
    }

    async validateAddress(address: any) {
        const token = await this.getToken();
        const baseUrl = this.apiUrl.endsWith('/api') ? this.apiUrl.slice(0, -4) : this.apiUrl;
        
        const response = await fetch(`${baseUrl}/api/addressvalidation/v2/1`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "transId": crypto.randomUUID(),
                "transactionSrc": "VialFlow"
            },
            body: JSON.stringify({
                XAVRequest: {
                    AddressKeyFormat: {
                        ConsigneeName: address.name || "Customer",
                        AddressLine: [address.address?.line1 || address.line1, address.address?.line2 || address.line2].filter(Boolean),
                        PoliticalDivision2: address.address?.city || address.city,
                        PoliticalDivision1: address.address?.state || address.state,
                        PostcodePrimaryLow: address.address?.postal_code || address.postal_code,
                        CountryCode: address.address?.country || address.country || "US"
                    }
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`UPS Address Validation API error: ${err}`);
        }

        const data = await response.json();
        
        // UPS XAV typically returns Validation response
        // It has ValidAddressIndicator if perfect, or Candidate[s] if suggestions exist
        const isMatch = !!data.XAVResponse?.ValidAddressIndicator;
        const candidates = data.XAVResponse?.Candidate || [];
        
        return {
            valid: isMatch,
            suggestions: Array.isArray(candidates) ? candidates : [candidates],
            rawResponse: data
        };
    }

    async createShipment(shipment: any) {
        const token = await this.getToken();

        const response = await fetch(`${this.apiUrl}/shipments/v1/ship`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "transId": crypto.randomUUID(),
                "transactionSrc": "VialFlow",
            },
            body: JSON.stringify({
                ShipmentRequest: {
                    Request: {
                        TransactionReference: {
                            CustomerContext: shipment.description || "Shipment Request",
                        },
                    },
                    Shipment: {
                        Description: shipment.description || "Package",
                        Shipper: this.formatAddress(shipment.shipper, this.settings.account_number),
                        ShipTo: this.formatAddress(shipment.recipient),
                        ShipFrom: this.formatAddress(shipment.shipper),
                        PaymentInformation: {
                            ShipmentCharge: {
                                Type: "01",
                                BillShipper: {
                                    AccountNumber: this.settings.account_number,
                                },
                            },
                        },
                        Service: {
                            Code: shipment.serviceCode || "03",
                            Description: this.getServiceName(shipment.serviceCode || "03"),
                        },
                        Package: shipment.packages.map((pkg: any) => ({
                            Packaging: {
                                Code: "02",
                                Description: "Package",
                            },
                            Dimensions: {
                                UnitOfMeasurement: { Code: "IN" },
                                Length: pkg.length.toString(),
                                Width: pkg.width.toString(),
                                Height: pkg.height.toString(),
                            },
                            PackageWeight: {
                                UnitOfMeasurement: { Code: "LBS" },
                                Weight: pkg.weight.toString(),
                            },
                        })),
                    },
                    LabelSpecification: {
                        LabelImageFormat: {
                            Code: "PDF",
                            Description: "PDF",
                        },
                        HTTPUserAgent: "Mozilla/4.5",
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`UPS Shipping API error: ${error}`);
        }

        const data = await response.json();
        const results = data.ShipmentResponse?.ShipmentResults;

        if (!results) {
            throw new Error("No shipment results returned");
        }

        const packageResult = Array.isArray(results.PackageResults) 
            ? results.PackageResults[0] 
            : results.PackageResults;

        const trackingNumber = packageResult.TrackingNumber;
        const labelData = packageResult.ShippingLabel?.GraphicImage || packageResult.LabelImage?.GraphicImage;

        return {
            success: true,
            trackingNumber,
            trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
            labelData: labelData,
            labelFormat: "PDF",
            serviceName: this.getServiceName(shipment.serviceCode || "03"),
            cost: parseFloat(results.ShipmentCharges?.TotalCharges?.MonetaryValue || "0"),
            totalCost: parseFloat(results.ShipmentCharges?.TotalCharges?.MonetaryValue || "0"),
            rawResponse: data,
        };
    }

    async schedulePickup(pickup: any) {
        const token = await this.getToken();

        const response = await fetch(`${this.apiUrl}/pickup/v1/pickup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "transId": crypto.randomUUID(),
                "transactionSrc": "VialFlow",
            },
            body: JSON.stringify({
                PickupCreationRequest: {
                    RatePickupIndicator: "Y",
                    Shipper: {
                        Account: {
                            AccountNumber: this.settings.account_number,
                            AccountCountryCode: "US",
                        },
                    },
                    PickupDateInfo: {
                        CloseTime: pickup.closeTime || "1700",
                        ReadyTime: pickup.readyTime || "0900",
                        PickupDate: pickup.date,
                    },
                    PickupAddress: {
                        CompanyName: pickup.companyName || this.settings.shipper_name,
                        ContactName: pickup.contactName || "Shipping Department",
                        AddressLine: pickup.address?.line1 || this.settings.shipper_address?.line1,
                        City: pickup.address?.city || this.settings.shipper_address?.city,
                        StateProvince: pickup.address?.state || this.settings.shipper_address?.state,
                        PostalCode: pickup.address?.zip || this.settings.shipper_address?.zip,
                        CountryCode: "US",
                        Phone: {
                            Number: pickup.phone || this.settings.shipper_phone,
                        },
                    },
                    PickupPiece: [{
                        ServiceCode: "001",
                        Quantity: pickup.packageCount?.toString() || "1",
                        DestinationCountryCode: "US",
                        ContainerCode: "01",
                    }],
                    TotalWeight: {
                        Weight: pickup.totalWeight?.toString() || "1",
                        UnitOfMeasurement: "LBS",
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`UPS Pickup API error: ${error}`);
        }

        const data = await response.json();

        return {
            success: true,
            confirmationNumber: data.PickupCreationResponse?.PRN,
            rawResponse: data,
        };
    }

    async trackShipment(trackingNumber: string) {
        const token = await this.getToken();

        const response = await fetch(
            `${this.apiUrl}/track/v1/details/${trackingNumber}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "transId": crypto.randomUUID(),
                    "transactionSrc": "VialFlow",
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`UPS Tracking API error: ${error}`);
        }

        const data = await response.json();
        const shipment = data.trackResponse?.shipment?.[0];
        const pkg = shipment?.package?.[0];
        
        // Try to get status from currentStatus first, then fallback to latest activity
        const currentStatus = pkg?.currentStatus;
        const latestActivity = pkg?.activity?.[0];
        
        const statusCode = currentStatus?.code || latestActivity?.status?.code;
        const statusDescription = currentStatus?.description || latestActivity?.status?.description || latestActivity?.description;

        return {
            success: true,
            status: this.mapTrackingStatus(statusDescription, statusCode),
            deliveredAt: pkg?.deliveryDate?.date || (statusCode === 'D' ? latestActivity?.date : undefined),
            events: pkg?.activity || [],
            rawResponse: data,
        };
    }

    async cancelShipment(trackingNumber: string) {
        const token = await this.getToken();

        // UPS Void Shipment API
        const response = await fetch(
            `${this.apiUrl}/void/v1/voiding/shipments/${trackingNumber}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "transId": crypto.randomUUID(),
                    "transactionSrc": "VialFlow",
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("UPS Void Shipment error:", error);
            throw new Error(`UPS Void Shipment error: ${error}`);
        }

        const data = await response.json();

        return {
            success: true,
            rawResponse: data,
        };
    }

    async cancelPickup(confirmationNumber: string, scheduledDate?: string) {
        const token = await this.getToken();

        const response = await fetch(
            `${this.apiUrl}/pickup/v1/pickups/${confirmationNumber}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "transId": crypto.randomUUID(),
                    "transactionSrc": "VialFlow",
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("UPS Cancel Pickup error:", error);
            throw new Error(`UPS Cancel Pickup error: ${error}`);
        }

        const data = await response.json();

        return {
            success: true,
            rawResponse: data,
        };
    }

    private formatAddress(address: any, accountNumber?: string) {
        const formatted: any = {
            Name: address.name,
            Address: {
                AddressLine: [address.address?.line1 || address.line1],
                City: address.address?.city || address.city,
                StateProvinceCode: address.address?.state || address.state,
                PostalCode: address.address?.postal_code || address.postal_code || address.address?.zip || address.zip,
                CountryCode: address.address?.country || address.country || "US",
            },
        };

        if (accountNumber) {
            formatted.ShipperNumber = accountNumber;
        }

        return formatted;
    }

    private getServiceName(code: string): string {
        const services: Record<string, string> = {
            "01": "Next Day Air",
            "02": "2nd Day Air",
            "03": "Ground",
            "12": "3 Day Select",
            "13": "Next Day Air Saver",
            "14": "Next Day Air Early",
            "59": "2nd Day Air A.M.",
        };
        return services[code] || `Service ${code}`;
    }

    private mapTrackingStatus(description: string, code?: string): string {
        // First check codes which are more reliable
        if (code) {
            switch (code) {
                case 'D': return "delivered";
                case 'I': return "in_transit";
                case 'P': return "picked_up";
                case 'M': return "label_created";
                case 'X': return "exception";
                case 'RS': return "returned";
                case 'DO': return "delivered"; // Delivered to Access Point
            }
        }

        if (!description) return "in_transit";

        const lower = description.toLowerCase();
        if (lower.includes("delivered")) return "delivered";
        if (lower.includes("out for delivery")) return "out_for_delivery";
        if (lower.includes("in transit")) return "in_transit";
        if (lower.includes("picked up")) return "picked_up";
        if (lower.includes("manifest") || lower.includes("label created")) return "label_created";

        return "in_transit";
    }
}
