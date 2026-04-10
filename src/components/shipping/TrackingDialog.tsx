import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Truck, CheckCircle2, Clock, MapPin, Loader2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface TrackingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string; // Add this
    shipmentId?: string;
}

import { getTrackingUrl } from "@/utils/shipping";

export function TrackingDialog({
    open,
    onOpenChange,
    trackingNumber,
    carrier = "UPS",
    trackingUrl: passedTrackingUrl,
    shipmentId,
}: TrackingDialogProps) {
    const [loading, setLoading] = useState(false);
    const [trackingData, setTrackingData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const trackingUrl = passedTrackingUrl || 
                      trackingData?.rawResponse?.tracking_url_provider || 
                      getTrackingUrl(carrier, trackingNumber || "");

    useEffect(() => {
        if (open && trackingNumber) {
            fetchTrackingDetails();
        } else {
            // Reset state when closed
            setTrackingData(null);
            setError(null);
        }
    }, [open, trackingNumber]);

    const fetchTrackingDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: funcError } = await supabase.functions.invoke("shipping", {
                body: {
                    carrier: carrier || "UPS",
                    action: "track_shipment",
                    data: {
                        shipmentId: shipmentId || null,
                        trackingNumber: trackingNumber,
                    },
                },
            });

            if (funcError) throw funcError;

            if (!data?.data?.success) {
                throw new Error("Tracking data unavailable");
            }

            setTrackingData(data.data);
        } catch (err: any) {
            console.error("Error fetching tracking:", err);
            setError(err.message || "Failed to retrieve tracking details");
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        const lower = (status || "").toLowerCase();
        if (lower.includes("delivered")) return <CheckCircle2 className="h-6 w-6 text-green-500" />;
        if (lower.includes("transit") || lower.includes("delivery") || lower.includes("pre_transit") || lower.includes("shipped")) return <Truck className="h-6 w-6 text-blue-500" />;
        if (lower.includes("exception") || lower.includes("error") || lower.includes("failure")) return <AlertCircle className="h-6 w-6 text-red-500" />;
        return <Package className="h-6 w-6 text-gray-500" />;
    };

    const formatTime = (dateStr?: string, timeStr?: string) => {
        if (!dateStr) return "Unknown date";
        
        try {
            // Check if it's an ISO date string (common in Shippo/FedEx)
            if (dateStr.includes("-") || dateStr.includes("T")) {
                return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
            }

            // UPS specific formats: date usually "YYYYMMDD", time usually "HHMMSS"
            if (dateStr.length === 8 && !dateStr.includes("-")) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                
                if (timeStr && timeStr.length >= 6) {
                    const hour = timeStr.substring(0, 2);
                    const min = timeStr.substring(2, 4);
                    const sec = timeStr.substring(4, 6);
                    return format(new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`), "MMM d, yyyy h:mm a");
                }
                return format(new Date(`${year}-${month}-${day}`), "MMM d, yyyy");
            }
            
            return dateStr;
        } catch (e) {
            return `${dateStr} ${timeStr || ""}`;
        }
    };

    const formatLocation = (location?: any) => {
        if (!location) return null;
        
        // Handle Shippo location format
        if (location.city && location.state) {
            return `${location.city}, ${location.state} ${location.zip || ""}`;
        }
        
        // Handle UPS location format
        if (location.address) {
            const { city, stateProvince, countryCode } = location.address;
            const parts = [city, stateProvince, countryCode].filter(Boolean);
            return parts.length > 0 ? parts.join(", ") : null;
        }

        // Handle string location
        if (typeof location === "string") return location;

        return null;
    };


    const displayCarrier = 
        trackingUrl.includes("usps.com") ? "USPS" : 
        trackingUrl.includes("ups.com") ? "UPS" : 
        trackingUrl.includes("fedex.com") ? "FedEx" : 
        carrier === "SHIPPO" ? "USPS" : carrier;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <DialogTitle className="text-2xl flex items-center justify-between">
                        <div>
                            Tracking via {displayCarrier}
                            <span className="block text-sm text-muted-foreground mt-1 font-normal font-mono">
                                {trackingNumber || "No tracking number available"}
                            </span>
                        </div>
                        {trackingData && (
                            <Badge variant={trackingData.status === "delivered" ? "default" : "secondary"} className="text-sm px-3 py-1">
                                {trackingData.status === "delivered" ? "Delivered" : trackingData.status?.replace(/_/g, " ") || "In Transit"}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                            <p>Locating your package...</p>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Tracking Unavailable</h3>
                            <p className="text-muted-foreground mb-6">
                                We couldn't retrieve the live tracking info. The carrier might not have scanned it yet.
                            </p>
                            {trackingNumber && (
                                <a 
                                    href={trackingUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-primary hover:underline font-medium"
                                >
                                    Track directly on {
                                        trackingUrl.includes("usps.com") ? "USPS" : 
                                        trackingUrl.includes("ups.com") ? "UPS" : 
                                        trackingUrl.includes("fedex.com") ? "FedEx" : 
                                        carrier === "SHIPPO" ? "Shippo" : carrier
                                    } website
                                </a>
                            )}
                        </div>
                    ) : trackingData ? (
                        <div className="space-y-8">
                            {/* Summary Card */}
                            <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
                                <div className="bg-primary/10 p-4 rounded-full">
                                    {getStatusIcon(trackingData.status)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg capitalize">{trackingData.status?.replace(/_/g, " ") || "In Transit"}</h3>
                                    {(trackingData.status === "delivered" || trackingData.deliveredAt) && (
                                        <p className="text-muted-foreground text-sm">
                                            {trackingData.status === "delivered" ? "Delivered on " : "Last update on "} 
                                            {formatTime(trackingData.deliveredAt || trackingData.status_date)}
                                        </p>
                                    )}
                                    <a 
                                        href={trackingUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-xs text-primary hover:underline mt-1 inline-block font-medium"
                                    >
                                        View on {
                                            trackingUrl.includes("usps.com") ? "USPS" : 
                                            trackingUrl.includes("ups.com") ? "UPS" : 
                                            trackingUrl.includes("fedex.com") ? "FedEx" : 
                                            carrier === "SHIPPO" ? "Shippo" : carrier
                                        } website
                                    </a>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="relative border-l-2 border-primary/20 ml-6 space-y-8 pb-4">
                                {trackingData.events?.length > 0 ? [...trackingData.events].reverse().map((event: any, idx: number) => {
                                    const isFirst = idx === 0;
                                    
                                    // Handle different event formats
                                    const eventStatus = event.status?.description || event.description || event.status_details || "Status Update";
                                    const eventDate = event.date || event.status_date;
                                    const eventTime = event.time;
                                    const loc = formatLocation(event.location);
                                    
                                    return (
                                        <div key={idx} className="relative pl-8">
                                            {/* Timeline Node */}
                                            <div className={`absolute left-0 top-1 -translate-x-1/2 p-1 rounded-full border-2 bg-white ${isFirst ? 'border-primary text-primary' : 'border-gray-300 text-gray-400'}`}>
                                                {isFirst ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full bg-gray-300" />}
                                            </div>
                                            
                                            <div className="pl-6">
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-1">
                                                    <h4 className={`font-semibold ${isFirst ? 'text-foreground' : 'text-gray-600'}`}>
                                                        {eventStatus}
                                                    </h4>
                                                </div>
                                                
                                                <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTime(eventDate, eventTime)}
                                                    </div>
                                                    {loc && (
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            {loc}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-muted-foreground pl-6">No specific tracking events exist yet for this package. Check back later.</p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
