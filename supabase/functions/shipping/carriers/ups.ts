// UPS Carrier Implementation
export class UPSCarrier {
    private settings: any;
    private apiUrl: string;

    constructor(settings: any) {
        this.settings = settings;
        this.apiUrl = settings.api_url || "https://wwwcie.ups.com/api";
    }

    private async getToken(): Promise<string> {
        const credentials = btoa(`${this.settings.client_id}:${this.settings.client_secret}`);

        const response = await fetch(`${this.apiUrl}/security/v1/oauth/token`, {
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

        const response = await fetch(`${this.apiUrl}/rating/v1/rate`, {
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
                        TransactionReference: {
                            CustomerContext: "Rating Request",
                        },
                    },
                    Shipment: {
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
        const rates = data.RateResponse?.RatedShipment || [];

        return {
            success: true,
            rates: (Array.isArray(rates) ? rates : [rates]).map((rate: any) => ({
                serviceCode: rate.Service.Code,
                serviceName: this.getServiceName(rate.Service.Code),
                cost: parseFloat(rate.TotalCharges.MonetaryValue),
                currency: rate.TotalCharges.CurrencyCode,
                estimatedDays: rate.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit,
            })),
            rawResponse: data,
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

        const trackingNumber = results.PackageResults.TrackingNumber;

        return {
            success: true,
            trackingNumber,
            trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
            labelData: results.PackageResults.ShippingLabel.GraphicImage,
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

        return {
            success: true,
            status: this.mapTrackingStatus(shipment?.package?.[0]?.currentStatus?.description),
            deliveredAt: shipment?.package?.[0]?.deliveryDate?.date,
            events: shipment?.package?.[0]?.activity || [],
            rawResponse: data,
        };
    }

    async cancelShipment(shipmentId: string) {
        // UPS doesn't have a direct cancel API for created labels
        // You would need to void the shipment on the same day
        throw new Error("UPS shipment cancellation not implemented");
    }

    private formatAddress(address: any, accountNumber?: string) {
        const formatted: any = {
            Name: address.name,
            Address: {
                AddressLine: [address.address?.line1 || address.line1],
                City: address.address?.city || address.city,
                StateProvinceCode: address.address?.state || address.state,
                PostalCode: address.address?.zip || address.zip,
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

    private mapTrackingStatus(description: string): string {
        if (!description) return "unknown";

        const lower = description.toLowerCase();
        if (lower.includes("delivered")) return "delivered";
        if (lower.includes("out for delivery")) return "out_for_delivery";
        if (lower.includes("in transit")) return "in_transit";
        if (lower.includes("picked up")) return "picked_up";

        return "in_transit";
    }
}
