import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Loader2 } from "lucide-react";
import { deductBatchMaterials } from "@/services/inventory";

interface StartProductionDialogProps {
    batch: {
        id: string;
        batch_number: string;
        quantity: number;
        sale_type: string;
        pack_quantity: number | null;
        product_id: string;
        product_variant_details: {
            vial_type_id: {
                name: string;
                size_ml: number;
            };
            product_id: {
                name: string;
            };
        };
    };
    onSuccess: () => void;
}

const StartProductionDialog = ({ batch, onSuccess }: StartProductionDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleStartProduction = async () => {
        setLoading(true);

        try {
            // Deduct materials from inventory
            await deductBatchMaterials(batch.id);

            // Update batch status
            const { error } = await supabase
                .from("production_batches")
                .update({
                    status: "in_progress",
                    started_at: new Date().toISOString(),
                })
                .eq("id", batch.id);

            if (error) throw error;

            toast.success(`Production started for batch ${batch.batch_number}`);
            setOpen(false);
            onSuccess();
        } catch (error: any) {
            console.error("Error starting production:", error);
            toast.error(error.message || "Failed to start production");
        } finally {
            setLoading(false);
        }
    };

    const displayQuantity = batch.sale_type === "pack" && batch.pack_quantity
        ? `${(batch.quantity / batch.pack_quantity).toFixed(0)} packs (${batch.quantity} units)`
        : `${batch.quantity} units`;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Start Production">
                    <Play className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Start Production</DialogTitle>
                    <DialogDescription>
                        This will deduct the required materials from inventory and mark the batch as in progress.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <h4 className="font-semibold">Batch Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-muted-foreground">Batch Number:</div>
                            <div className="font-medium">{batch.batch_number}</div>

                            <div className="text-muted-foreground">Product:</div>
                            <div className="font-medium">{batch.product_variant_details?.product_id?.name || "-"}</div>

                            <div className="text-muted-foreground">Vial Type:</div>
                            <div className="font-medium">
                                {batch.product_variant_details?.vial_type_id?.name} ({batch.product_variant_details?.vial_type_id?.size_ml}ml)
                            </div>

                            <div className="text-muted-foreground">Quantity:</div>
                            <div className="font-medium">{displayQuantity}</div>
                        </div>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                            <strong>Note:</strong> Starting production will check material availability and deduct the required quantities from your inventory. This action cannot be undone.
                        </p>
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleStartProduction}
                        disabled={loading}
                        className="w-full sm:w-auto"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start Production
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StartProductionDialog;
