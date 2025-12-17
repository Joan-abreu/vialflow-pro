import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Package, Truck, Calendar, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_SHIPPER } from "@/lib/constants";

interface ShippingDialogProps {
    orderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const MultiCarrierShippingDialog = ({ orderId, open, onOpenChange, onSuccess }: ShippingDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'carrier' | 'rates' | 'label' | 'pickup'>('carrier');

    // Carrier selection
    const [availableCarriers, setAvailableCarriers] = useState<any[]>([]);
    const [selectedCarrier, setSelectedCarrier] = useState<string>("");

    // Rates
    const [rates, setRates] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<string>("");

    // Label
    const [labelUrl, setLabelUrl] = useState<string>("");
    const [trackingNumber, setTrackingNumber] = useState<string>("");
    const [shipmentId, setShipmentId] = useState<string>("");

    // Package dimensions
    const [weight, setWeight] = useState<string>("5");
    const [length, setLength] = useState<string>("12");
    const [width, setWidth] = useState<string>("8");
    const [height, setHeight] = useState<string>("6");

    // Pickup details
    const [pickupDate, setPickupDate] = useState<string>("");
    const [pickupReadyTime, setPickupReadyTime] = useState<string>("09:00");
    const [pickupCloseTime, setPickupCloseTime] = useState<string>("17:00");
    const [pickupInstructions, setPickupInstructions] = useState<string>("");
    const [pickupConfirmation, setPickupConfirmation] = useState<string>("");

    useEffect(() => {
        if (open) {
            checkExistingShipment();
            fetchAvailableCarriers();
        }
    }, [open, orderId]);

    const [carrierSettings, setCarrierSettings] = useState<any>(null);

    useEffect(() => {
        const fetchCarrierSettings = async () => {
            if (!selectedCarrier) return;

            try {
                const { data, error } = await supabase
                    .from('carrier_settings')
                    .select('*')
                    .eq('carrier', selectedCarrier)
                    .single();

                if (error) {
                    console.error('Error fetching carrier settings:', error);
                    return;
                }

                if (data) {
                    setCarrierSettings(data);
                }
            } catch (error) {
                console.error('Error fetching carrier settings:', error);
            }
        };

        fetchCarrierSettings();
    }, [selectedCarrier]);

    useEffect(() => {
        if (open) {
            calculateTotalWeight();
        }
    }, [open, orderId]);

    const calculateTotalWeight = async () => {
        try {
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .select(`
                    order_items(
                        quantity,
                        variant:product_variants(weight)
                    )
                `)
                .eq("id", orderId)
                .single();

            if (orderError) throw orderError;

            // Calculate total weight
            const totalWeight = order.order_items.reduce((sum: number, item: any) => {
                return sum + ((item.variant?.weight || 0) * item.quantity);
            }, 0);

            if (totalWeight > 0) {
                setWeight(totalWeight.toFixed(2));
            }
        } catch (error) {
            console.error("Error calculating weight:", error);
        }
    };

    const checkExistingShipment = async () => {
        try {
            const { data, error } = await supabase
                .from("order_shipments")
                .select("*")
                .eq("order_id", orderId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setShipmentId(data.id);
                setTrackingNumber(data.tracking_number);
                setLabelUrl(data.label_url);
                setSelectedCarrier(data.carrier);

                if (data.pickup_confirmation) {
                    setPickupConfirmation(data.pickup_confirmation);
                    setPickupDate(data.pickup_date || "");
                    setPickupReadyTime(data.pickup_ready_time || "");
                    setPickupCloseTime(data.pickup_close_time || "");
                }

                setStep('pickup'); // Go directly to details/pickup view
            } else {
                // Reset if no shipment found (already handled by the other useEffect, but good to ensure)
                // actually the other useEffect clears state when !open.
            }
        } catch (error) {
            console.error("Error checking existing shipment:", error);
        }
    };

    useEffect(() => {
        if (!open) {
            // ... (keep existing reset logic)
            setStep("carrier");
            setAvailableCarriers([]);
            setSelectedCarrier("");
            setRates([]);
            setSelectedService("");
            setLabelUrl("");
            setTrackingNumber("");
            setShipmentId("");

            setWeight("5");
            setLength("12");
            setWidth("8");
            setHeight("6");

            setPickupDate("");
            setPickupReadyTime("09:00");
            setPickupCloseTime("17:00");
            setPickupInstructions("");
            setPickupConfirmation("");
        }
    }, [open]);

    const fetchAvailableCarriers = async () => {
        try {
            const { data, error } = await supabase
                .from("carrier_settings")
                .select("carrier, shipper_name, default_service_code")
                .eq("is_active", true);

            if (error) throw error;
            setAvailableCarriers(data || []);

            if (data && data.length === 1) {
                setSelectedCarrier(data[0].carrier);
            }
        } catch (error: any) {
            console.error("Error fetching carriers:", error);
            toast.error("Failed to load carriers");
        }
    };

    const getShippingRates = async () => {
        if (!selectedCarrier) {
            toast.error("Please select a carrier");
            return;
        }

        setLoading(true);
        try {
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items(
                        quantity,
                        variant:product_variants(weight)
                    )
                `)
                .eq("id", orderId)
                .single();

            if (orderError) throw orderError;

            // Weight is already calculated and set in state by calculateTotalWeight
            // But we keep this logic as a fallback or in case it wasn't set yet for some reason, 
            // though calculateTotalWeight is better as it runs on open.
            // actually, we can remove the weight calculation here to avoid overwriting user manual input 
            // if they changed it before clicking "Get Rates", 
            // BUT the original code was overwriting it every time. 
            // Let's REMOVE it from here so we don't overwrite user changes.
            // User asked: "que cargue el peso por defecto... Actualmente se actualiza... cuando le doy Get Shipping Rates solamente"
            // So we moved it to initial load (above) and remove it from here.

            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "get_rates",
                    data: {
                        shipper: {
                            name: carrierSettings?.shipper_name || DEFAULT_SHIPPER.name,
                            address: {
                                line1: carrierSettings?.shipper_address?.line1 || DEFAULT_SHIPPER.address.line1,
                                city: carrierSettings?.shipper_address?.city || DEFAULT_SHIPPER.address.city,
                                state: carrierSettings?.shipper_address?.state_code || DEFAULT_SHIPPER.address.state,
                                zip: carrierSettings?.shipper_address?.postal_code || DEFAULT_SHIPPER.address.zip,
                                country: carrierSettings?.shipper_address?.country_code || "US",
                            },
                        },
                        recipient: {
                            name: (order.shipping_address as any)?.name || "Customer",
                            address: order.shipping_address || {},
                        },
                        packages: [{
                            weight: parseFloat(weight),
                            length: parseFloat(length),
                            width: parseFloat(width),
                            height: parseFloat(height),
                        }],
                    },
                },
            });

            if (error) throw error;

            let fetchedRates = data.data?.rates || [];

            // FILTER FEDEX RATES (Ground & Express only)
            if (selectedCarrier === 'FEDEX') {
                fetchedRates = fetchedRates.filter((rate: any) => {
                    const serviceName = (rate.serviceName || rate.service || "").toUpperCase();
                    return serviceName.includes('GROUND') || serviceName.includes('EXPRESS');
                });
            }

            setRates(fetchedRates);
            setStep('rates');
            toast.success("Rates retrieved successfully");
        } catch (error: any) {
            console.error("Error getting rates:", error);
            toast.error(error.message || "Failed to get shipping rates");
        } finally {
            setLoading(false);
        }
    };

    const createShippingLabel = async () => {
        if (!selectedService) {
            toast.error("Please select a shipping service");
            return;
        }

        setLoading(true);
        try {
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .select("*")
                .eq("id", orderId)
                .single();

            if (orderError) throw orderError;

            let customerName = "Customer";

            if (order.user_id) {
                const { data: profile, error: profileError } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("user_id", order.user_id)
                    .single();

                if (!profileError && profile?.full_name) {
                    customerName = profile.full_name;
                }
            }

            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "create_shipment",
                    data: {
                        orderId: orderId,
                        serviceCode: selectedService,
                        description: `Order #${order.id.slice(0, 8)}`,
                        shipper: {
                            name: carrierSettings?.shipper_name || DEFAULT_SHIPPER.name,
                            address: {
                                line1: carrierSettings?.shipper_address?.line1 || DEFAULT_SHIPPER.address.line1,
                                city: carrierSettings?.shipper_address?.city || DEFAULT_SHIPPER.address.city,
                                state: carrierSettings?.shipper_address?.state_code || DEFAULT_SHIPPER.address.state,
                                zip: carrierSettings?.shipper_address?.postal_code || DEFAULT_SHIPPER.address.zip,
                                country: carrierSettings?.shipper_address?.country_code || DEFAULT_SHIPPER.address.country,
                            },
                        },
                        recipient: {
                            name: customerName,
                            address: order.shipping_address || {},
                        },
                        packages: [{
                            weight: parseFloat(weight),
                            length: parseFloat(length),
                            width: parseFloat(width),
                            height: parseFloat(height),
                        }],
                    },
                },
            });

            if (error) throw error;

            if (data.data?.success) {
                setTrackingNumber(data.data.trackingNumber);
                setLabelUrl(`data:application/pdf;base64,${data.data.labelData}`);
                setShipmentId(data.data.shipmentId);

                toast.success("Shipping label created successfully!");
                onSuccess?.();
                setStep('pickup');

                // Update order status
                await supabase
                    .from("orders")
                    .update({ status: "label_created" })
                    .eq("id", orderId);
            }
        } catch (error: any) {
            console.error("Error creating label:", error);
            toast.error(error.message || "Failed to create shipping label");
        } finally {
            setLoading(false);
        }
    };

    const schedulePickup = async () => {
        if (!pickupDate) {
            toast.error("Please select a pickup date");
            return;
        }

        setLoading(true);
        try {
            // FedEx prefers YYYY-MM-DDTHH:mm:ss format, implied local time of pickup address
            const readyISO = `${pickupDate}T${pickupReadyTime}:00`;
            const closeISO = `${pickupCloseTime}:00`;

            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "schedule_pickup",
                    data: {
                        shipmentId: shipmentId,
                        date: pickupDate.replace(/-/g, ""),
                        readyTime: readyISO,
                        closeTime: closeISO,
                        packageCount: 1,
                        totalWeight: parseFloat(weight),
                        instructions: pickupInstructions,
                    },
                },
            });

            if (error) throw error;

            toast.success("Pickup scheduled successfully!");

            // Update order status
            await supabase
                .from("orders")
                .update({ status: "pickup_scheduled" })
                .eq("id", orderId);

            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error scheduling pickup:", error);
            toast.error(error.message || "Failed to schedule pickup");
        } finally {
            setLoading(false);
        }
    };

    const cancelPickup = async () => {
        if (!pickupConfirmation || !shipmentId) return;

        if (!confirm("Are you sure you want to cancel this pickup?")) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "cancel_pickup",
                    data: {
                        shipmentId: shipmentId,
                        confirmationNumber: pickupConfirmation,
                        date: pickupDate,
                    },
                },
            });

            if (error) throw error;

            if (data.data?.success) {
                setPickupConfirmation("");
                setPickupDate("");
                setPickupReadyTime("09:00");
                setPickupCloseTime("17:00");
                toast.success("Pickup cancelled successfully");
            }
        } catch (error: any) {
            console.error("Error cancelling pickup:", error);
            toast.error(error.message || "Failed to cancel pickup");
        } finally {
            setLoading(false);
        }
    };

    const cancelShipment = async () => {
        if (!shipmentId) return;

        if (!confirm("Are you sure you want to cancel this shipment? This will void the label.")) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "cancel_shipment",
                    data: {
                        shipmentId: shipmentId,
                    },
                },
            });

            if (error) throw error;

            if (data.data?.success) {
                toast.success("Shipment cancelled successfully");
                onSuccess?.();
                onOpenChange(false);
            }
        } catch (error: any) {
            console.error("Error cancelling shipment:", error);
            toast.error(error.message || "Failed to cancel shipment");
        } finally {
            setLoading(false);
        }
    };

    const trackShipment = async () => {
        if (!trackingNumber || !shipmentId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: selectedCarrier,
                    action: "track_shipment",
                    data: {
                        shipmentId: shipmentId,
                        trackingNumber: trackingNumber,
                    },
                },
            });

            if (error) throw error;

            if (data.data?.success) {
                const events = data.data.events || [];
                const latestStatus = data.data.status;

                // Simple alert for now, can be improved with a custom dialog
                alert(`Status: ${latestStatus}\nLatest Event: ${events[0]?.eventDescription || events[0]?.description || "No details available"}`);
            }
        } catch (error: any) {
            console.error("Error tracking shipment:", error);
            toast.error(error.message || "Failed to track shipment");
        } finally {
            setLoading(false);
        }
    };

    const downloadLabel = () => {
        if (!labelUrl) return;

        const link = document.createElement('a');
        link.href = labelUrl;
        link.download = `${selectedCarrier}-label-${trackingNumber}.pdf`;
        link.click();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Shipping Label</DialogTitle>
                    <DialogDescription>
                        Multi-carrier shipping support
                    </DialogDescription>
                </DialogHeader>

                {step === 'carrier' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Select Carrier</CardTitle>
                                <CardDescription>Choose your shipping carrier</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {availableCarriers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No carriers configured. Please configure carriers in settings.
                                    </p>
                                ) : (
                                    <>
                                        <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select carrier" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCarriers.map((carrier) => (
                                                    <SelectItem key={carrier.carrier} value={carrier.carrier}>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">{carrier.carrier}</Badge>
                                                            <span className="text-sm text-muted-foreground">
                                                                {carrier.shipper_name}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Weight (lbs) <span className="text-destructive">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={weight}
                                                    onChange={(e) => setWeight(e.target.value)}
                                                    step="0.01"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Length (in) <span className="text-destructive">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={length}
                                                    onChange={(e) => setLength(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Width (in) <span className="text-destructive">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={width}
                                                    onChange={(e) => setWidth(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Height (in) <span className="text-destructive">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={height}
                                                    onChange={(e) => setHeight(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            onClick={getShippingRates}
                                            disabled={loading || !selectedCarrier}
                                            className="w-full"
                                        >
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Get Shipping Rates
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {step === 'rates' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Badge>{selectedCarrier}</Badge>
                                    Select Service
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {rates.length > 0 ? (
                                    <>
                                        <div className="space-y-2">
                                            {rates.map((rate, index) => (
                                                <div
                                                    key={index}
                                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedService === rate.serviceCode
                                                        ? 'border-primary bg-primary/5'
                                                        : 'hover:border-primary/50'
                                                        }`}
                                                    onClick={() => setSelectedService(rate.serviceCode)}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium">{rate.serviceName}</p>
                                                            {rate.estimatedDays && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    Est: {rate.estimatedDays}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-lg font-bold">
                                                            ${rate.cost.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            onClick={createShippingLabel}
                                            disabled={loading || !selectedService}
                                            className="w-full"
                                        >
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Shipping Label
                                        </Button>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No rates available. Please try again.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {step === 'pickup' && (
                    <div className="space-y-4">
                        {labelUrl && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="h-5 w-5" />
                                        Label Created
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="font-semibold flex items-center gap-2">
                                            <Badge>{selectedCarrier}</Badge>
                                            Tracking: {trackingNumber}
                                        </div>
                                    </div>
                                    <Button onClick={downloadLabel} variant="outline" className="w-full">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Label
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5" />
                                    {pickupConfirmation ? "Pickup Scheduled" : "Schedule Pickup (Optional)"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {pickupConfirmation ? (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                                        <div className="font-semibold text-green-800 flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Pickup Confirmed
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                                            <div><span className="font-semibold">Confirmation:</span> {pickupConfirmation}</div>
                                            <div><span className="font-semibold">Date:</span> {pickupDate}</div>
                                            <div><span className="font-semibold">Ready Time:</span> {pickupReadyTime}</div>
                                            <div><span className="font-semibold">Close Time:</span> {pickupCloseTime}</div>
                                        </div>
                                        <div className="pt-2 flex flex-col gap-2">
                                            <Button
                                                onClick={cancelPickup}
                                                variant="destructive"
                                                disabled={loading}
                                                className="w-full"
                                            >
                                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Cancel Pickup
                                            </Button>
                                            <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full bg-white hover:bg-green-50 border-green-200">
                                                Close
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <Label>Pickup Date</Label>
                                            <Input
                                                type="date"
                                                value={pickupDate}
                                                onChange={(e) => setPickupDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Ready Time</Label>
                                                <Input
                                                    type="time"
                                                    value={pickupReadyTime}
                                                    onChange={(e) => setPickupReadyTime(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label>Close Time</Label>
                                                <Input
                                                    type="time"
                                                    value={pickupCloseTime}
                                                    onChange={(e) => setPickupCloseTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Additional Instructions (e.g., Gate Code)</Label>
                                            <Input
                                                value={pickupInstructions}
                                                onChange={(e) => setPickupInstructions(e.target.value)}
                                                placeholder="Enter instructions for the driver..."
                                            />
                                        </div>
                                        <Button onClick={schedulePickup} disabled={loading} className="w-full">
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Schedule Pickup
                                        </Button>
                                        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
                                            Skip & Close
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional Actions for existing shipments */}
                        {shipmentId && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Shipment Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button
                                        onClick={trackShipment}
                                        variant="secondary"
                                        className="w-full"
                                        disabled={loading}
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Track Shipment
                                    </Button>

                                    <Button
                                        onClick={cancelShipment}
                                        variant="destructive"
                                        className="w-full"
                                        disabled={loading}
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Cancel Shipment
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
