
export interface ICarrier {
    getRates(shipment: any): Promise<{
        success: boolean;
        rates: Array<{
            serviceCode: string;
            serviceName: string;
            cost: number;
            currency: string;
            estimatedDays?: string | number;
        }>;
        rawResponse: any;
    }>;

    createShipment(shipment: any): Promise<{
        success: boolean;
        trackingNumber: string;
        trackingUrl: string;
        labelData: string;
        labelFormat: string;
        serviceName: string;
        cost: number;
        totalCost: number;
        rawResponse: any;
    }>;

    schedulePickup(pickup: any): Promise<{
        success: boolean;
        confirmationNumber: string;
        rawResponse: any;
    }>;

    trackShipment(trackingNumber: string): Promise<{
        success: boolean;
        status: string;
        deliveredAt?: string;
        events: any[];
        rawResponse: any;
    }>;

    cancelShipment(trackingNumber: string): Promise<{
        success: boolean;
        rawResponse: any;
    }>;

    cancelPickup(confirmationNumber: string, scheduledDate?: string, serviceCode?: string): Promise<{
        success: boolean;
        rawResponse: any;
    }>;
}
