import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Truck, Package, ExternalLink, Printer, Edit2, Database, FileText } from "lucide-react";
import { DEFAULT_SHIPPER } from "@/lib/constants";

interface BulkOrder {
    id: string;
    customer_email: string;
    shipping_address: any;
    order_items?: any[];
    shipping_carrier?: string;
    shipping_service?: string;
    customer_profile?: {
        full_name: string;
    };
}

interface BulkItemState {
    order: BulkOrder;
    packages: Array<{ weight: number; length: number; width: number; height: number }>;
    isDbPreset: boolean;
    presetKey?: string;
    status: 'idle' | 'rating' | 'rated' | 'purchasing' | 'success' | 'error';
    rates: any[];
    selectedRate: any | null;
    createdShipment: any | null;
    errorMessage?: string;
}

interface BulkShippingDialogProps {
    orders: BulkOrder[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const BulkShippingDialog = ({ orders, open, onOpenChange, onSuccess }: BulkShippingDialogProps) => {
    const [availableCarriers, setAvailableCarriers] = useState<any[]>([]);
    const [selectedCarrier, setSelectedCarrier] = useState<string>("SHIPPO");
    const [itemsState, setItemsState] = useState<BulkItemState[]>([]);
    const [dbPackagePresets, setDbPackagePresets] = useState<Record<string, any>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [batchPdfUrl, setBatchPdfUrl] = useState<string>("");

    // Edit package modal state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editWeight, setEditWeight] = useState<string>("1.0");
    const [editLength, setEditLength] = useState<string>("12.0");
    const [editWidth, setEditWidth] = useState<string>("8.0");
    const [editHeight, setEditHeight] = useState<string>("6.0");
    const [saveDbPresetToggle, setSaveDbPresetToggle] = useState<boolean>(true);

    // Calculate packages for an order checking DB presets first
    const calculateOrderPackages = (order: BulkOrder, presets: Record<string, any>) => {
        const items = order.order_items || [];
        const primaryItem = items[0];
        let presetKey: string | undefined = undefined;

        if (primaryItem?.variant_id) {
            presetKey = `${primaryItem.variant_id}_qty_${primaryItem.quantity || 1}`;
        }

        if (presetKey && presets[presetKey]) {
            const dbPreset = presets[presetKey];
            return {
                packages: [{
                    weight: Number(dbPreset.weight) || 1.0,
                    length: Number(dbPreset.length) || 12.0,
                    width: Number(dbPreset.width) || 8.0,
                    height: Number(dbPreset.height) || 6.0,
                }],
                isDbPreset: true,
                presetKey,
            };
        }

        const packagesList: Array<{ weight: number; length: number; width: number; height: number }> = [];

        try {
            const packItems = items.filter((i: any) => i.variant?.sale_type === 'pack' || (i.variant?.pack_size && i.variant.pack_size > 1));
            const retailItems = items.filter((i: any) => i.variant?.sale_type !== 'pack' && (!i.variant?.pack_size || i.variant.pack_size <= 1));

            packItems.forEach((item: any) => {
                const config = item.variant?.box_configuration;
                const packsPerBox = Number(config?.packs_per_box) || 5;
                const boxL = Number(config?.box_length) || 12;
                const boxW = Number(config?.box_width) || 12;
                const boxH = Number(config?.box_height) || 12;
                const boxWgt = Number(config?.box_weight) || 0.5;
                const itemWgt = Number(item.variant?.weight) || 0.1;
                const qty = Number(item.quantity) || 1;

                const fullBoxes = Math.floor(qty / packsPerBox);
                const remainder = qty % packsPerBox;

                for (let i = 0; i < fullBoxes; i++) {
                    const boxWeight = parseFloat(((packsPerBox * itemWgt) + boxWgt).toFixed(2));
                    packagesList.push({
                        weight: Math.max(0.1, boxWeight),
                        length: boxL,
                        width: boxW,
                        height: boxH,
                    });
                }

                if (remainder > 0) {
                    const boxWeight = parseFloat(((remainder * itemWgt) + boxWgt).toFixed(2));
                    const scaledHeight = Math.max(2, Math.min(boxH, Math.ceil((remainder / packsPerBox) * boxH)));
                    packagesList.push({
                        weight: Math.max(0.1, boxWeight),
                        length: boxL,
                        width: boxW,
                        height: scaledHeight,
                    });
                }
            });

            if (retailItems.length > 0) {
                let maxL = 0;
                let maxW = 0;
                let totalH = 0;
                let totalWeight = 0;

                retailItems.forEach((item: any) => {
                    const qty = item.quantity;
                    const v = item.variant;
                    if (v) {
                        totalWeight += (v.weight || 0.1) * qty;
                        const l = Math.max(v.dimension_length || 0, 1.0);
                        const w = Math.max(v.dimension_width || 0, 1.0);
                        const h = Math.max(v.dimension_height || 0, 1.0);
                        if (l > maxL) maxL = l;
                        if (w > maxW) maxW = w;
                        totalH += h * qty;
                    }
                });

                const finalLength = Math.min(Math.ceil(maxL || 6), 27);
                const finalWidth = Math.min(Math.ceil(maxW || 4), 15);
                const finalHeight = Math.min(Math.ceil(totalH || 4), 17);
                const boxWeight = Math.max(0.3, totalWeight * 0.1);
                const calculatedWeight = parseFloat((totalWeight + boxWeight).toFixed(2));

                packagesList.push({
                    weight: Math.max(0.1, calculatedWeight),
                    length: finalLength,
                    width: finalWidth,
                    height: finalHeight,
                });
            }
        } catch (e) {
            console.error("Error calculating packages", e);
        }

        if (packagesList.length === 0) {
            packagesList.push({ weight: 1.0, length: 12.0, width: 8.0, height: 6.0 });
        }

        return {
            packages: packagesList,
            isDbPreset: false,
            presetKey,
        };
    };

    const fetchDbPresetsAndInitialize = async () => {
        try {
            const { data } = await supabase
                .from("carrier_settings")
                .select("carrier, shipper_name, default_service_code, config")
                .eq("is_active", true);

            setAvailableCarriers(data || []);
            const shippoSetting = (data || []).find(c => c.carrier === selectedCarrier.toUpperCase());
            const presets = (shippoSetting?.config as any)?.package_presets || {};
            setDbPackagePresets(presets);

            const initialState: BulkItemState[] = orders.map(order => {
                const calculated = calculateOrderPackages(order, presets);
                return {
                    order,
                    packages: calculated.packages,
                    isDbPreset: calculated.isDbPreset,
                    presetKey: calculated.presetKey,
                    status: 'idle',
                    rates: [],
                    selectedRate: null,
                    createdShipment: null,
                };
            });

            setItemsState(initialState);
            setBatchPdfUrl("");
        } catch (e) {
            console.error("Error initializing bulk dialog presets", e);
        }
    };

    useEffect(() => {
        if (open && orders.length > 0) {
            fetchDbPresetsAndInitialize();
            setIsProcessing(false);
            setProgress(0);
        }
    }, [open, orders, selectedCarrier]);

    const handleOpenEdit = (index: number) => {
        const item = itemsState[index];
        if (!item || item.packages.length === 0) return;

        const pkg = item.packages[0];
        setEditingIndex(index);
        setEditWeight(pkg.weight.toString());
        setEditLength(pkg.length.toString());
        setEditWidth(pkg.width.toString());
        setEditHeight(pkg.height.toString());
        setSaveDbPresetToggle(true);
    };

    const handleSaveEdit = async () => {
        if (editingIndex === null) return;

        const w = parseFloat(editWeight) || 1.0;
        const l = parseFloat(editLength) || 12.0;
        const widthVal = parseFloat(editWidth) || 8.0;
        const h = parseFloat(editHeight) || 6.0;

        const updatedState = [...itemsState];
        const currentItem = updatedState[editingIndex];

        const newPkg = { weight: w, length: l, width: widthVal, height: h };
        currentItem.packages = [newPkg];
        currentItem.status = 'idle';
        currentItem.rates = [];
        currentItem.selectedRate = null;

        if (saveDbPresetToggle && currentItem.presetKey) {
            try {
                const { data: currentCarrier } = await supabase
                    .from("carrier_settings")
                    .select("id, config")
                    .eq("carrier", selectedCarrier.toUpperCase())
                    .eq("is_active", true)
                    .maybeSingle();

                if (currentCarrier) {
                    const currentConfig = (currentCarrier.config as any) || {};
                    const updatedPresets = {
                        ...(currentConfig.package_presets || {}),
                        [currentItem.presetKey]: {
                            ...newPkg,
                            updatedAt: new Date().toISOString(),
                        }
                    };

                    const { error } = await supabase
                        .from("carrier_settings")
                        .update({
                            config: {
                                ...currentConfig,
                                package_presets: updatedPresets
                            }
                        })
                        .eq("id", currentCarrier.id);

                    if (error) throw error;

                    currentItem.isDbPreset = true;
                    setDbPackagePresets(updatedPresets);
                    toast.success("Packaging preset saved to Database for future bulk shipments!");
                }
            } catch (e: any) {
                console.error("Error saving DB preset:", e);
                toast.error("Package updated for this order (DB save error: " + e.message + ")");
            }
        } else {
            toast.success("Package dimensions updated for this order!");
        }

        setItemsState(updatedState);
        setEditingIndex(null);
    };

    // Step 1: Get shipping rates for all selected orders
    const handleFetchAllRates = async () => {
        setIsProcessing(true);
        setProgress(0);

        const updatedState = [...itemsState];

        for (let i = 0; i < updatedState.length; i++) {
            const item = updatedState[i];
            item.status = 'rating';
            setItemsState([...updatedState]);

            try {
                const { data, error } = await supabase.functions.invoke("shipping", {
                    body: {
                        carrier: selectedCarrier,
                        action: "get_rates",
                        data: {
                            shipper: {
                                name: DEFAULT_SHIPPER.name,
                                address: {
                                    line1: DEFAULT_SHIPPER.address.line1,
                                    city: DEFAULT_SHIPPER.address.city,
                                    state: DEFAULT_SHIPPER.address.state,
                                    zip: DEFAULT_SHIPPER.address.zip,
                                    country: "US",
                                },
                            },
                            recipient: {
                                name: item.order.customer_profile?.full_name || (item.order.shipping_address as any)?.full_name || (item.order.shipping_address as any)?.name || "Customer",
                                address: item.order.shipping_address || {},
                            },
                            orderId: item.order.id,
                            packages: item.packages,
                        },
                    },
                });

                if (error || !data?.data?.rates) {
                    throw new Error(data?.error || error?.message || "No rates returned");
                }

                let fetchedRates = data.data.rates || [];
                fetchedRates.sort((a: any, b: any) => a.cost - b.cost);

                item.rates = fetchedRates;
                item.selectedRate = fetchedRates[0] || null;
                item.status = 'rated';
            } catch (err: any) {
                console.error(`Rate error for order ${item.order.id}:`, err);
                item.status = 'error';
                item.errorMessage = err.message || "Failed to fetch rates";
            }

            setProgress(Math.round(((i + 1) / updatedState.length) * 100));
            setItemsState([...updatedState]);
        }

        setIsProcessing(false);
        toast.success("Rates calculation completed for batch!");
    };

    // Step 2: Single-request Bulk Label Purchase (Shippo Batches API)
    const handlePurchaseAllLabels = async () => {
        const ratedOrReadyItems = itemsState.filter(i => i.status === 'rated' || i.status === 'idle');
        if (ratedOrReadyItems.length === 0) {
            toast.error("No valid orders ready for label purchase");
            return;
        }

        if (ratedOrReadyItems.length > 50) {
            toast.error(`Shippo supports a maximum of 50 orders per batch. Currently ${ratedOrReadyItems.length} orders are selected.`);
            return;
        }

        setIsProcessing(true);
        setProgress(25);

        // Pre-open tab synchronously during user gesture so browser popup blocker does not block it
        const pdfTab = window.open('', '_blank');

        try {
            if (selectedCarrier === "SHIPPO") {
                // Call single-request Shippo Batches API (POST /v1/batches and /v1/batches/{id}/purchase)
                // This executes ONE single credit card transaction for the entire batch
                const { data, error } = await supabase.functions.invoke("shipping", {
                    body: {
                        carrier: "SHIPPO",
                        action: "create_bulk_shipment",
                        data: {
                            items: ratedOrReadyItems.map(item => ({
                                orderId: item.order.id,
                                serviceCode: item.selectedRate?.serviceCode,
                                shippingService: item.order.shipping_service,
                                shippingCarrier: item.order.shipping_carrier,
                                packages: item.packages,
                                recipient: {
                                    name: item.order.customer_profile?.full_name || (item.order.shipping_address as any)?.full_name || "Customer",
                                    address: item.order.shipping_address || {},
                                },
                                shipper: {
                                    name: DEFAULT_SHIPPER.name,
                                    address: DEFAULT_SHIPPER.address,
                                }
                            }))
                        }
                    }
                });

                if (error || !data?.success) {
                    if (pdfTab) pdfTab.close();
                    throw new Error(data?.error || error?.message || "Shippo Batch Purchase failed");
                }

                if (data.batchLabelUrl) {
                    setBatchPdfUrl(data.batchLabelUrl);
                    if (pdfTab) {
                        pdfTab.location.href = data.batchLabelUrl;
                    }
                } else if (pdfTab) {
                    pdfTab.close();
                }

                const updatedState = [...itemsState];
                const resList = data.results || [];

                updatedState.forEach(item => {
                    const match = resList.find((r: any) => r.orderId === item.order.id);
                    if (match) {
                        item.status = 'success';
                        item.createdShipment = {
                            trackingNumber: match.trackingNumber,
                            trackingUrl: match.trackingUrl,
                            labelUrl: match.labelUrl || data.batchLabelUrl,
                        };
                    }
                });

                setItemsState(updatedState);
                setProgress(100);
                toast.success(`Successfully purchased ${ratedOrReadyItems.length} shipping labels!`);

                if (onSuccess) onSuccess();
            } else {
                if (pdfTab) pdfTab.close();
                // Direct carrier sequential fallback
                const updatedState = [...itemsState];
                let count = 0;

                for (let i = 0; i < updatedState.length; i++) {
                    const item = updatedState[i];
                    if (!item.selectedRate) continue;

                    item.status = 'purchasing';
                    setItemsState([...updatedState]);

                    const { data, error } = await supabase.functions.invoke("shipping", {
                        body: {
                            carrier: selectedCarrier,
                            action: "create_shipment",
                            data: {
                                serviceCode: item.selectedRate.serviceCode,
                                serviceName: item.selectedRate.serviceName,
                                orderId: item.order.id,
                                packages: item.packages,
                                recipient: {
                                    name: item.order.customer_profile?.full_name || (item.order.shipping_address as any)?.full_name || "Customer",
                                    address: item.order.shipping_address || {},
                                },
                            },
                        },
                    });

                    if (!error && data?.success) {
                        await supabase
                            .from("orders")
                            .update({ status: "label_created", tracking_number: data.trackingNumber })
                            .eq("id", item.order.id);

                        item.createdShipment = data;
                        item.status = 'success';
                        count++;
                    } else {
                        item.status = 'error';
                        item.errorMessage = error?.message || "Purchase failed";
                    }

                    setProgress(Math.round(((i + 1) / updatedState.length) * 100));
                    setItemsState([...updatedState]);
                }

                if (count > 0 && onSuccess) onSuccess();
            }
        } catch (err: any) {
            if (pdfTab) pdfTab.close();
            console.error("Bulk purchase error:", err);
            toast.error(err.message || "Failed to purchase bulk labels");
        } finally {
            setIsProcessing(false);
        }
    };

    const totalBatchCost = useMemo(() => {
        return itemsState.reduce((sum, item) => sum + (item.selectedRate?.cost || 0), 0);
    }, [itemsState]);

    const successLabels = useMemo(() => {
        return itemsState.filter(i => i.status === 'success' && i.createdShipment?.labelUrl);
    }, [itemsState]);

    const handlePrintAllLabels = () => {
        if (batchPdfUrl) {
            window.open(batchPdfUrl, '_blank');
            return;
        }

        if (successLabels.length === 0) return;

        const firstUrl = successLabels[0]?.createdShipment?.labelUrl;
        if (firstUrl) {
            window.open(firstUrl, '_blank');
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="h-5 w-5 text-primary" />
                        Bulk Shipping Labels ({orders.length} Orders)
                    </DialogTitle>
                    <DialogDescription>
                        Generate and purchase shipping labels in bulk via Shippo Batch API (Single Credit Card Charge & Combined PDF).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-4 py-2 border-b">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Carrier Account:</span>
                        <Select value={selectedCarrier} onValueChange={setSelectedCarrier} disabled={isProcessing}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="Select Carrier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SHIPPO">Shippo (Multi-carrier Batch)</SelectItem>
                                <SelectItem value="UPS">UPS Direct</SelectItem>
                                <SelectItem value="FEDEX">FedEx Direct</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="text-right">
                        <span className="text-xs text-muted-foreground block">Total Batch Estimate</span>
                        <span className="text-lg font-bold text-green-600">${totalBatchCost.toFixed(2)}</span>
                    </div>
                </div>

                {isProcessing && (
                    <div className="space-y-1.5 py-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Processing batch transaction...</span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}

                {batchPdfUrl && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-600" />
                            <div>
                                <h4 className="text-sm font-semibold text-emerald-900">Combined Batch Labels PDF Generated!</h4>
                                <p className="text-xs text-emerald-700">All labels for this batch have been merged into 1 PDF for quick printing.</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold"
                            onClick={() => window.open(batchPdfUrl, '_blank')}
                        >
                            <Printer className="h-4 w-4" />
                            Open / Print Combined PDF
                        </Button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 text-xs">
                                <TableHead>Order</TableHead>
                                <TableHead>Recipient</TableHead>
                                <TableHead>Parcels & Presets</TableHead>
                                <TableHead>Selected Rate</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Rate Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {itemsState.map((item, idx) => (
                                <TableRow key={item.order.id} className="text-xs">
                                    <TableCell className="font-mono">
                                        #{item.order.id.slice(0, 8)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">
                                            {item.order.customer_profile?.full_name || (item.order.shipping_address as any)?.full_name || "Customer"}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {(item.order.shipping_address as any)?.city}, {(item.order.shipping_address as any)?.state}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div className="space-y-0.5">
                                                {item.packages.map((pkg, pIdx) => (
                                                    <Badge key={pIdx} variant="outline" className="text-[10px] font-mono px-1 py-0 mr-1 bg-slate-50">
                                                        {pkg.weight}lb ({pkg.length}x{pkg.width}x{pkg.height}in)
                                                    </Badge>
                                                ))}
                                            </div>

                                            {item.isDbPreset ? (
                                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 px-1.5 py-0 h-5">
                                                    <Database className="h-3 w-3" /> DB Preset
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 cursor-pointer hover:bg-amber-100 flex items-center gap-1 px-1.5 py-0 h-5"
                                                    onClick={() => handleOpenEdit(idx)}
                                                    title="Click to edit and save default box preset for this product/quantity combo"
                                                >
                                                    Set Default Preset
                                                </Badge>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleOpenEdit(idx)}
                                                disabled={isProcessing || item.status === 'success'}
                                                title="Edit box dimensions & weight"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {item.rates.length > 0 ? (
                                            <Select
                                                value={item.selectedRate?.serviceCode || ""}
                                                onValueChange={(val) => {
                                                    const matched = item.rates.find(r => r.serviceCode === val);
                                                    if (matched) {
                                                        item.selectedRate = matched;
                                                        setItemsState([...itemsState]);
                                                    }
                                                }}
                                                disabled={isProcessing || item.status === 'success'}
                                            >
                                                <SelectTrigger className="w-[180px] h-7 text-[11px]">
                                                    <SelectValue placeholder="Select Service" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {item.rates.map((rate, rIdx) => (
                                                        <SelectItem key={rIdx} value={rate.serviceCode} className="text-xs">
                                                            {rate.serviceName} (${rate.cost.toFixed(2)})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-muted-foreground italic">USPS Ground Advantage (Default)</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.status === 'idle' && <Badge variant="secondary">Ready</Badge>}
                                        {item.status === 'rating' && (
                                            <Badge variant="outline" className="animate-pulse bg-blue-50 text-blue-700">
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Rating...
                                            </Badge>
                                        )}
                                        {item.status === 'rated' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Rated</Badge>}
                                        {item.status === 'purchasing' && (
                                            <Badge variant="outline" className="animate-pulse bg-purple-50 text-purple-700">
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Purchasing...
                                            </Badge>
                                        )}
                                        {item.status === 'success' && (
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                                    ✓ Label Created
                                                </Badge>
                                                {item.createdShipment?.labelUrl && (
                                                    <a href={item.createdShipment.labelUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {item.status === 'error' && (
                                            <Badge variant="destructive" title={item.errorMessage} className="cursor-help">
                                                Error
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {item.selectedRate ? `$${item.selectedRate.cost.toFixed(2)}` : "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        {(batchPdfUrl || successLabels.length > 0) && (
                            <Button variant="outline" size="sm" onClick={handlePrintAllLabels} className="flex items-center gap-1.5 text-xs font-medium">
                                <Printer className="h-4 w-4 text-primary" />
                                Print Combined Labels PDF ({successLabels.length})
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleFetchAllRates}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                            1. Calculate All Rates
                        </Button>
                        <Button
                            variant="default"
                            onClick={handlePurchaseAllLabels}
                            disabled={isProcessing || itemsState.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                            2. Purchase All Labels (Single Batch Charge)
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Edit Package Modal */}
        <Dialog open={editingIndex !== null} onOpenChange={(val) => !val && setEditingIndex(null)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Edit Package Box & Weight
                    </DialogTitle>
                    <DialogDescription>
                        Set parcel dimensions for Order #{editingIndex !== null ? itemsState[editingIndex]?.order.id.slice(0, 8) : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Weight (lb)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            placeholder="e.g. 0.5"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Length (in)</Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={editLength}
                                onChange={(e) => setEditLength(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Width (in)</Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={editWidth}
                                onChange={(e) => setEditWidth(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Height (in)</Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={editHeight}
                                onChange={(e) => setEditHeight(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Checkbox
                            id="saveDbPreset"
                            checked={saveDbPresetToggle}
                            onCheckedChange={(checked) => setSaveDbPresetToggle(!!checked)}
                        />
                        <Label htmlFor="saveDbPreset" className="text-xs cursor-pointer leading-tight">
                            Save as default preset in Database for this Product + Quantity
                        </Label>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingIndex(null)}>
                        Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSaveEdit}>
                        Save Package
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
};
