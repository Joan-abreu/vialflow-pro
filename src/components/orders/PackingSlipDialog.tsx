import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { PackingSlipDocument, PackingSlipOrder } from "./PackingSlipDocument";
import { printPackingSlips } from "@/utils/printPackingSlip";

interface PackingSlipDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orders: PackingSlipOrder[] | null;
}

export const PackingSlipDialog: React.FC<PackingSlipDialogProps> = ({
    open,
    onOpenChange,
    orders,
}) => {
    const [showPrices, setShowPrices] = useState(false);
    const [viewMode, setViewMode] = useState<"all" | "single">("all");
    const [currentOrderIndex, setCurrentOrderIndex] = useState(0);

    const safeOrders = useMemo(() => orders || [], [orders]);

    const totalUnits = useMemo(() => {
        return safeOrders.reduce((total, order) => {
            return total + (order.order_items || []).reduce((subTotal, item) => subTotal + (item.quantity || 0), 0);
        }, 0);
    }, [safeOrders]);

    const ordersToDisplay = useMemo(() => {
        if (viewMode === "single" && safeOrders[currentOrderIndex]) {
            return [safeOrders[currentOrderIndex]];
        }
        return safeOrders;
    }, [safeOrders, viewMode, currentOrderIndex]);

    const handlePrint = () => {
        printPackingSlips(ordersToDisplay, showPrices);
    };

    if (!open || safeOrders.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:h-auto print:static print:bg-white print:overflow-visible">
                {/* Header (Hidden when printing) */}
                <DialogHeader className="p-4 border-b bg-muted/40 print:hidden shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                        <div>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" />
                                <span>Packing Slip Preview</span>
                                <Badge variant="secondary" className="font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {safeOrders.length} {safeOrders.length === 1 ? "Order" : "Orders"}
                                </Badge>
                                <Badge variant="outline" className="font-semibold text-xs">
                                    {totalUnits} Total Units
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                Standard Letter size (8.5" x 11") optimized for fulfillment and quality inspection with product images.
                            </DialogDescription>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
                            {/* Toggle Show Prices */}
                            <div className="flex items-center space-x-2 bg-background border px-2.5 py-1 rounded-md shadow-2xs">
                                <Switch
                                    id="show-prices-toggle"
                                    checked={showPrices}
                                    onCheckedChange={setShowPrices}
                                    className="scale-90"
                                />
                                <Label htmlFor="show-prices-toggle" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                                    Show Prices
                                </Label>
                            </div>

                            {/* View Switcher if multiple orders */}
                            {safeOrders.length > 1 && (
                                <div className="flex items-center bg-background border rounded-md p-0.5 text-xs shadow-2xs whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("all")}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                            viewMode === "all"
                                                ? "bg-indigo-600 text-white font-bold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        View All ({safeOrders.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("single")}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                            viewMode === "single"
                                                ? "bg-indigo-600 text-white font-bold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Single View
                                    </button>
                                </div>
                            )}

                            {/* Print Button */}
                            <Button
                                onClick={handlePrint}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold shadow-sm h-8 px-3 text-xs shrink-0 whitespace-nowrap"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print ({safeOrders.length})</span>
                            </Button>
                        </div>
                    </div>

                    {/* Pagination Bar for Single View mode */}
                    {safeOrders.length > 1 && viewMode === "single" && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Showing Order:</span>
                                <Badge variant="outline" className="font-mono font-bold">
                                    #{safeOrders[currentOrderIndex]?.id.slice(0, 8)}
                                </Badge>
                                <span className="text-muted-foreground">({currentOrderIndex + 1} of {safeOrders.length})</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => setCurrentOrderIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentOrderIndex === 0}
                                >
                                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => setCurrentOrderIndex(prev => Math.min(safeOrders.length - 1, prev + 1))}
                                    disabled={currentOrderIndex === safeOrders.length - 1}
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {/* Preview Scroll Area */}
                <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:h-auto print:max-h-none">
                    <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 print:max-w-none print:m-0 print:p-0">
                        <PackingSlipDocument
                            orders={viewMode === "all" ? safeOrders : ordersToDisplay}
                            showPrices={showPrices}
                        />
                    </div>
                </div>

                {/* Footer (Hidden when printing) */}
                <DialogFooter className="p-3 border-t bg-muted/40 print:hidden flex flex-row items-center justify-between sm:justify-between shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Ready to print in standard Letter paper (8.5" x 11")</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-semibold">
                            <Printer className="w-4 h-4" />
                            <span>Print Packing Slip{safeOrders.length > 1 ? "s" : ""}</span>
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PackingSlipDialog;
