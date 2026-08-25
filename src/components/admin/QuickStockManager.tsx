import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, Package, Save, Plus, Minus, AlertTriangle, CheckCircle2, XCircle, Bell, Loader2, RefreshCw, ArrowDownCircle, Trash2, ClipboardList, FilePlus, ChevronsUpDown, History, Eye, Calendar, FileText, Edit3, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

interface VariantStockRow {
    id: string;
    product_id: string;
    product_name: string;
    category_name: string;
    vial_type_name: string;
    sku: string;
    stock_quantity: number;
    image_url: string | null;
    pack_size: number;
    pending_restock_count: number;
}

export default function QuickStockManager() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [editedStock, setEditedStock] = useState<Record<string, number>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [notifyingId, setNotifyingId] = useState<string | null>(null);

    // Inbound Receiving Stock Orders State
    const [isInboundOrderOpen, setIsInboundOrderOpen] = useState(false);
    const [inboundRefNumber, setInboundRefNumber] = useState("");
    const [inboundSupplier, setInboundSupplier] = useState("");
    const [inboundNotes, setInboundNotes] = useState("");
    const [inboundLineItems, setInboundLineItems] = useState<Array<{ variantId: string; quantityToAdd: number }>>([]);
    const [isSubmittingInbound, setIsSubmittingInbound] = useState(false);
    const [isProductComboboxOpen, setIsProductComboboxOpen] = useState(false);

    // Inbound History State
    const [isInboundHistoryOpen, setIsInboundHistoryOpen] = useState(false);
    const [inboundHistoryLogs, setInboundHistoryLogs] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [selectedHistoryLog, setSelectedHistoryLog] = useState<any | null>(null);
    const [editingInboundLogId, setEditingInboundLogId] = useState<string | null>(null);
    const [deletingInboundLogId, setDeletingInboundLogId] = useState<string | null>(null);
    const [logToRevert, setLogToRevert] = useState<any | null>(null);

    // Fetch variants & restock waitlist counts
    const { data: stockItems = [], isLoading, refetch } = useQuery({
        queryKey: ["admin-quick-stock-manager"],
        queryFn: async () => {
            const { data: products, error: pErr } = await supabase
                .from("products")
                .select(`
                    id, name, image_url,
                    product_categories(name),
                    variants:product_variants(
                        id, product_id, sku, stock_quantity, pack_size, image_url, images,
                        vial_type:vial_types(name)
                    )
                `)
                .order("name", { ascending: true });

            if (pErr) throw pErr;

            // Fetch pending restock notification counts per variant
            const { data: restockCounts } = await supabase
                .from("restock_notifications" as any)
                .select("variant_id")
                .eq("status", "pending");

            const countMap: Record<string, number> = {};
            if (restockCounts && Array.isArray(restockCounts)) {
                restockCounts.forEach((r: any) => {
                    if (r.variant_id) {
                        countMap[r.variant_id] = (countMap[r.variant_id] || 0) + 1;
                    }
                });
            }

            const rows: VariantStockRow[] = [];
            products?.forEach((p: any) => {
                const categoryName = p.product_categories?.name || "Uncategorized";
                p.variants?.forEach((v: any) => {
                    const displayImage = v.image_url ||
                        (v.images && v.images.length > 0 ? v.images[0] : null) ||
                        p.image_url;

                    rows.push({
                        id: v.id,
                        product_id: p.id,
                        product_name: p.name,
                        category_name: categoryName,
                        vial_type_name: v.vial_type?.name || "Standard",
                        sku: v.sku || p.name.slice(0, 6).toUpperCase(),
                        stock_quantity: v.stock_quantity ?? 0,
                        image_url: displayImage,
                        pack_size: v.pack_size || 1,
                        pending_restock_count: countMap[v.id] || 0
                    });
                });
            });

            return rows;
        }
    });

    // Update Stock Mutation
    const updateStockMutation = useMutation({
        mutationFn: async ({ variantId, newStock }: { variantId: string; newStock: number }) => {
            const { error } = await supabase
                .from("product_variants")
                .update({ stock_quantity: newStock })
                .eq("id", variantId);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            toast.success("Stock quantity updated successfully!");
            setEditedStock((prev) => {
                const updated = { ...prev };
                delete updated[variables.variantId];
                return updated;
            });
            queryClient.invalidateQueries({ queryKey: ["admin-quick-stock-manager"] });
            queryClient.invalidateQueries({ queryKey: ["public-product-variants"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update stock quantity.");
        }
    });

    // Trigger Restock Notification Emails
    const handleTriggerRestockEmails = async (item: VariantStockRow) => {
        setNotifyingId(item.id);
        try {
            const { data, error } = await supabase.functions.invoke("send-restock-notification", {
                body: { variant_id: item.id }
            });
            if (error) throw error;
            toast.success(`Notified ${item.pending_restock_count} customer(s) that ${item.product_name} is back in stock!`);
            refetch();
        } catch (err: any) {
            console.error("Restock notify error:", err);
            toast.error(err.message || "Failed to send restock emails.");
        } finally {
            setNotifyingId(null);
        }
    };

    const handleStockChange = (variantId: string, value: number) => {
        setEditedStock((prev) => ({
            ...prev,
            [variantId]: Math.max(0, value)
        }));
    };

    const handleQuickIncrement = (variantId: string, currentVal: number, amount: number) => {
        const activeVal = editedStock[variantId] !== undefined ? editedStock[variantId] : currentVal;
        handleStockChange(variantId, activeVal + amount);
    };

    const handleSaveRow = async (variantId: string, originalStock: number) => {
        const newStock = editedStock[variantId];
        if (newStock === undefined || newStock === originalStock) return;
        setSavingId(variantId);
        await updateStockMutation.mutateAsync({ variantId, newStock });
        setSavingId(null);
    };

    const handleOpenInboundModal = (initialVariantId?: string) => {
        const autoRef = `IN-${Date.now().toString().slice(-6)}`;
        setEditingInboundLogId(null);
        setInboundRefNumber(autoRef);
        setInboundSupplier("");
        setInboundNotes("");
        if (initialVariantId) {
            setInboundLineItems([{ variantId: initialVariantId, quantityToAdd: 50 }]);
        } else {
            setInboundLineItems([]);
        }
        setIsInboundOrderOpen(true);
    };

    const handleEditInboundOrder = (log: any) => {
        const details = log.new_values || log.changes || {};
        setEditingInboundLogId(log.id);
        setInboundRefNumber(details.reference_number || `IN-${Date.now().toString().slice(-6)}`);
        setInboundSupplier(details.supplier || "");
        setInboundNotes(details.notes || "");

        const items = (details.items || []).map((i: any) => ({
            variantId: i.variant_id,
            quantityToAdd: i.qty_added || 0
        })).filter((i: any) => !!i.variantId);

        setInboundLineItems(items);
        setSelectedHistoryLog(null);
        setIsInboundHistoryOpen(false);
        setIsInboundOrderOpen(true);
    };

    const handleRevertInboundOrder = (log: any) => {
        setLogToRevert(log);
    };

    const confirmRevertInboundOrder = async () => {
        if (!logToRevert) return;
        const log = logToRevert;
        setLogToRevert(null);

        const details = log.new_values || log.changes || {};
        const refNum = details.reference_number || log.record_id || "IN-N/A";
        const items = details.items || [];

        setDeletingInboundLogId(log.id);
        try {
            let totalUnitsReverted = 0;
            for (const item of items) {
                if (!item.variant_id) continue;
                const { data: vData } = await supabase
                    .from("product_variants")
                    .select("stock_quantity")
                    .eq("id", item.variant_id)
                    .single();

                if (vData) {
                    const currentStock = vData.stock_quantity || 0;
                    const qtyAdded = item.qty_added || 0;
                    const revertedStock = Math.max(0, currentStock - qtyAdded);
                    totalUnitsReverted += qtyAdded;

                    await supabase
                        .from("product_variants")
                        .update({ stock_quantity: revertedStock })
                        .eq("id", item.variant_id);
                }
            }

            // Delete from audit_logs
            const { error: delErr } = await supabase
                .from("audit_logs" as any)
                .delete()
                .eq("id", log.id);

            if (delErr) throw delErr;

            toast.success(`Inbound Order ${refNum} reverted and deleted! Subtracted ${totalUnitsReverted} units from inventory.`);
            setSelectedHistoryLog(null);
            handleOpenInboundHistory();
            refetch();
            queryClient.invalidateQueries({ queryKey: ["public-product-variants"] });
        } catch (err: any) {
            console.error("Revert inbound order error:", err);
            toast.error(err.message || "Failed to revert inbound order.");
        } finally {
            setDeletingInboundLogId(null);
        }
    };

    const handleAddVariantToInbound = (variantId: string) => {
        if (!variantId) return;
        setInboundLineItems((prev) => {
            if (prev.some(i => i.variantId === variantId)) return prev;
            return [...prev, { variantId, quantityToAdd: 50 }];
        });
    };

    const handleAddAllProductsToInbound = () => {
        const allLines = stockItems.map(item => ({ variantId: item.id, quantityToAdd: 0 }));
        setInboundLineItems(allLines);
        toast.info(`Loaded all ${allLines.length} catalog products into the receiving list.`);
    };

    const handleInboundQtyChange = (variantId: string, quantityToAdd: number) => {
        setInboundLineItems((prev) =>
            prev.map(item => item.variantId === variantId ? { ...item, quantityToAdd: Math.max(0, quantityToAdd) } : item)
        );
    };

    const handleRemoveInboundLine = (variantId: string) => {
        setInboundLineItems((prev) => prev.filter(i => i.variantId !== variantId));
    };

    const handleProcessInboundOrder = async () => {
        if (inboundLineItems.length === 0) {
            toast.error("Please select at least one product to receive stock.");
            return;
        }

        const validItems = inboundLineItems.filter(i => i.quantityToAdd > 0);
        if (validItems.length === 0) {
            toast.error("Please enter a quantity greater than 0 for selected products.");
            return;
        }

        setIsSubmittingInbound(true);
        try {
            let totalUnitsAdded = 0;

            // If editing an existing log, revert old quantities first
            if (editingInboundLogId) {
                const oldLog = inboundHistoryLogs.find(l => l.id === editingInboundLogId);
                if (oldLog) {
                    const oldDetails = oldLog.new_values || oldLog.changes || {};
                    const oldItems = oldDetails.items || [];
                    for (const oldItem of oldItems) {
                        if (!oldItem.variant_id) continue;
                        const { data: vData } = await supabase
                            .from("product_variants")
                            .select("stock_quantity")
                            .eq("id", oldItem.variant_id)
                            .single();
                        if (vData) {
                            const revertedStock = Math.max(0, (vData.stock_quantity || 0) - (oldItem.qty_added || 0));
                            await supabase
                                .from("product_variants")
                                .update({ stock_quantity: revertedStock })
                                .eq("id", oldItem.variant_id);
                        }
                    }
                }
            }

            // Apply new quantities
            for (const item of validItems) {
                const { data: vData } = await supabase
                    .from("product_variants")
                    .select("stock_quantity")
                    .eq("id", item.variantId)
                    .single();

                const currentStock = vData ? vData.stock_quantity : (stockItems.find(s => s.id === item.variantId)?.stock_quantity || 0);
                const newStock = currentStock + item.quantityToAdd;
                totalUnitsAdded += item.quantityToAdd;

                const { error } = await supabase
                    .from("product_variants")
                    .update({ stock_quantity: newStock })
                    .eq("id", item.variantId);

                if (error) throw error;

                // Auto-trigger restock notification if variant was out of stock (currentStock === 0) and has waitlisted customers
                const matchedStockItem = stockItems.find(s => s.id === item.variantId);
                if (currentStock === 0 && matchedStockItem && matchedStockItem.pending_restock_count > 0) {
                    supabase.functions.invoke("send-restock-notification", {
                        body: { variant_id: item.variantId }
                    }).catch(e => console.warn("Auto restock notification error:", e));
                }
            }

            const { data: { session } } = await supabase.auth.getSession();

            const payload = {
                table_name: "inbound_stock_orders",
                operation: editingInboundLogId ? "UPDATE_INBOUND_RECEIVING" : "INBOUND_RECEIVING",
                changed_by: session?.user?.id || null,
                new_values: {
                    reference_number: inboundRefNumber,
                    supplier: inboundSupplier,
                    notes: inboundNotes,
                    total_units_added: totalUnitsAdded,
                    items: validItems.map(i => {
                        const s = stockItems.find(x => x.id === i.variantId);
                        return {
                            variant_id: i.variantId,
                            sku: s?.sku,
                            product_name: s?.product_name,
                            qty_added: i.quantityToAdd,
                            new_stock: (s?.stock_quantity || 0) + i.quantityToAdd
                        };
                    })
                }
            };

            if (editingInboundLogId) {
                await supabase
                    .from("audit_logs" as any)
                    .update(payload)
                    .eq("id", editingInboundLogId);
                toast.success(`Inbound Receiving Order ${inboundRefNumber} updated successfully!`);
            } else {
                const logRecordId = crypto.randomUUID();
                await supabase.from("audit_logs" as any).insert({
                    ...payload,
                    record_id: logRecordId
                });
                toast.success(`Inbound Receiving Order ${inboundRefNumber} processed successfully! Added ${totalUnitsAdded} units to inventory.`);
            }

            setIsInboundOrderOpen(false);
            setEditingInboundLogId(null);
            setInboundLineItems([]);
            refetch();
            queryClient.invalidateQueries({ queryKey: ["public-product-variants"] });
        } catch (err: any) {
            console.error("Inbound process error:", err);
            toast.error(err.message || "Failed to process inbound receiving order.");
        } finally {
            setIsSubmittingInbound(false);
        }
    };

    const handleOpenInboundHistory = async () => {
        setIsInboundHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from("audit_logs" as any)
                .select("*")
                .eq("table_name", "inbound_stock_orders")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setInboundHistoryLogs(data || []);
        } catch (err: any) {
            console.error("Inbound history fetch error:", err);
            toast.error("Failed to load receiving history.");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Filter Logic
    const categories = Array.from(new Set(stockItems.map((i) => i.category_name)));
    const filteredItems = stockItems.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch = !q || item.product_name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.category_name.toLowerCase().includes(q);
        const matchesCategory = categoryFilter === "all" || item.category_name === categoryFilter;

        let matchesStatus = true;
        const currentStock = editedStock[item.id] !== undefined ? editedStock[item.id] : item.stock_quantity;
        if (statusFilter === "in_stock") matchesStatus = currentStock >= 10;
        else if (statusFilter === "low_stock") matchesStatus = currentStock > 0 && currentStock < 10;
        else if (statusFilter === "out_of_stock") matchesStatus = currentStock <= 0;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1 w-full sm:w-auto max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search product, SKU, or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-40 text-xs">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                        <SelectTrigger className="w-36 text-xs">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="in_stock">In Stock (&ge;10)</SelectItem>
                            <SelectItem value="low_stock">Low Stock (&lt;10)</SelectItem>
                            <SelectItem value="out_of_stock">Out of Stock (0)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button 
                        onClick={() => handleOpenInboundModal()} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs shadow-sm"
                    >
                        <ArrowDownCircle className="h-4 w-4" />
                        Register Inbound Order (+Stock)
                    </Button>

                    <Button 
                        variant="outline"
                        onClick={handleOpenInboundHistory} 
                        className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 font-semibold gap-1.5 text-xs shadow-sm"
                    >
                        <History className="h-4 w-4 text-emerald-600" />
                        Inbound History
                    </Button>

                    <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh stock table">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Main Stock Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
                <Table className="min-w-[850px] w-full">
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="w-[180px] max-w-[200px]">Product & Variant</TableHead>
                            <TableHead className="w-[120px]">Category</TableHead>
                            <TableHead className="w-[85px]">SKU</TableHead>
                            <TableHead className="w-[95px]">Status</TableHead>
                            <TableHead className="w-[200px]">Stock Quantity</TableHead>
                            <TableHead className="w-[90px] text-center">Waitlist</TableHead>
                            <TableHead className="text-right w-[150px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                    Loading inventory stock levels...
                                </TableCell>
                            </TableRow>
                        ) : filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    No products found matching filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredItems.map((item) => {
                                const currentStock = editedStock[item.id] !== undefined ? editedStock[item.id] : item.stock_quantity;
                                const isModified = editedStock[item.id] !== undefined && editedStock[item.id] !== item.stock_quantity;

                                return (
                                    <TableRow key={item.id} className={isModified ? "bg-amber-500/5" : "hover:bg-muted/30 transition-colors"}>
                                        {/* Product Info */}
                                        <TableCell className="max-w-[200px] pr-1 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Package className="h-4 w-4 opacity-40" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-semibold text-foreground text-xs block truncate" title={item.product_name}>
                                                        {item.product_name}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground block truncate">
                                                        {item.vial_type_name} {item.pack_size > 1 ? `(Pack ${item.pack_size})` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Category */}
                                        <TableCell className="max-w-[120px] py-2">
                                            <Badge variant="outline" className="text-[10px] font-medium max-w-[110px] truncate block" title={item.category_name}>
                                                {item.category_name}
                                            </Badge>
                                        </TableCell>

                                        {/* SKU */}
                                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground max-w-[85px] truncate py-2" title={item.sku}>
                                            {item.sku}
                                        </TableCell>

                                        {/* Status Badge */}
                                        <TableCell className="py-2 whitespace-nowrap">
                                            {currentStock >= 10 ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold text-[10px] gap-1 px-1.5 py-0.5">
                                                    <CheckCircle2 className="h-3 w-3" /> In Stock
                                                </Badge>
                                            ) : currentStock > 0 ? (
                                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold text-[10px] gap-1 px-1.5 py-0.5">
                                                    <AlertTriangle className="h-3 w-3" /> Low ({currentStock})
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-semibold text-[10px] gap-1 px-1.5 py-0.5">
                                                    <XCircle className="h-3 w-3" /> Out of Stock
                                                </Badge>
                                            )}
                                        </TableCell>

                                        {/* Stock Editor */}
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7 p-0 shrink-0"
                                                    onClick={() => handleQuickIncrement(item.id, item.stock_quantity, -1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={currentStock}
                                                    onChange={(e) => handleStockChange(item.id, parseInt(e.target.value) || 0)}
                                                    className={`h-7 w-16 px-1 text-center font-bold text-xs ${isModified ? "border-amber-500 ring-2 ring-amber-500/20" : ""}`}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7 p-0 shrink-0"
                                                    onClick={() => handleQuickIncrement(item.id, item.stock_quantity, 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                                <div className="flex gap-0.5 ml-0.5">
                                                    <button
                                                        onClick={() => handleQuickIncrement(item.id, item.stock_quantity, 10)}
                                                        className="text-[9px] font-bold px-1 py-0.5 bg-muted hover:bg-primary/20 hover:text-primary rounded transition-colors"
                                                    >
                                                        +10
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickIncrement(item.id, item.stock_quantity, 50)}
                                                        className="text-[9px] font-bold px-1 py-0.5 bg-muted hover:bg-primary/20 hover:text-primary rounded transition-colors"
                                                    >
                                                        +50
                                                    </button>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Restock Waitlist Count */}
                                        <TableCell className="py-2 text-center">
                                            {item.pending_restock_count > 0 ? (
                                                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold text-[10px] gap-1 px-1.5 py-0.5">
                                                    <Bell className="h-3 w-3 animate-bounce" />
                                                    {item.pending_restock_count}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right py-2 whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                {item.pending_restock_count > 0 && currentStock > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={notifyingId === item.id}
                                                        onClick={() => handleTriggerRestockEmails(item)}
                                                        className="h-7 px-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                                                    >
                                                        {notifyingId === item.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Bell className="h-3 w-3 mr-0.5" /> Notify ({item.pending_restock_count})
                                                            </>
                                                        )}
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenInboundModal(item.id)}
                                                    className="h-7 px-2 text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 font-semibold"
                                                    title="Receive stock for this product"
                                                >
                                                    <Plus className="h-3 w-3 mr-0.5 text-emerald-600" /> + Receive
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    disabled={!isModified || savingId === item.id}
                                                    onClick={() => handleSaveRow(item.id, item.stock_quantity)}
                                                    className="h-7 px-2 text-xs font-semibold"
                                                >
                                                    {savingId === item.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Save className="h-3 w-3 mr-0.5" /> Save
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal for Inbound Receiving Stock Orders */}
            <Dialog open={isInboundOrderOpen} onOpenChange={setIsInboundOrderOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <ArrowDownCircle className="h-6 w-6" />
                            Register Inbound Receiving Order (Stock Replenishment)
                        </DialogTitle>
                        <DialogDescription>
                            Enter receiving details to automatically add incoming quantities to existing product stock.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Header info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Inbound Order / Reference #</Label>
                                <Input 
                                    value={inboundRefNumber}
                                    onChange={(e) => setInboundRefNumber(e.target.value)}
                                    placeholder="e.g. IN-2026-001"
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Supplier / Origin (Optional)</Label>
                                <Input 
                                    value={inboundSupplier}
                                    onChange={(e) => setInboundSupplier(e.target.value)}
                                    placeholder="e.g. Production Batch #42"
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Notes / Comments</Label>
                                <Input 
                                    value={inboundNotes}
                                    onChange={(e) => setInboundNotes(e.target.value)}
                                    placeholder="e.g. Monthly stock replenishment"
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        {/* Add product select & bulk options */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                            <h4 className="text-sm font-bold flex items-center gap-1.5">
                                <Package className="h-4 w-4 text-primary" />
                                Products to Receive ({inboundLineItems.length})
                            </h4>

                            <div className="flex flex-wrap items-center gap-2">
                                <Popover open={isProductComboboxOpen} onOpenChange={setIsProductComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-72 justify-between text-xs h-9 font-normal">
                                            <span className="truncate text-muted-foreground">+ Select product to add...</span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                        className="w-[360px] p-0 pointer-events-auto z-[100]" 
                                        align="start"
                                        onWheel={(e) => e.stopPropagation()}
                                    >
                                        <Command className="w-full">
                                            <CommandInput placeholder="Search product name, SKU, or category..." className="text-xs h-9" />
                                            <CommandList 
                                                className="max-h-60 overflow-y-auto overflow-x-hidden touch-pan-y"
                                                onWheel={(e) => e.stopPropagation()}
                                            >
                                                <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                                                    No matching products found.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {stockItems.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={`${item.product_name} ${item.sku} ${item.vial_type_name} ${item.category_name}`}
                                                            onSelect={() => {
                                                                handleAddVariantToInbound(item.id);
                                                                setIsProductComboboxOpen(false);
                                                            }}
                                                            className="text-xs py-2 cursor-pointer flex items-center justify-between gap-2"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-semibold text-xs truncate">{item.product_name}</div>
                                                                <div className="text-[10px] text-muted-foreground truncate">{item.vial_type_name} • SKU: {item.sku}</div>
                                                            </div>
                                                            <Badge variant="outline" className="text-[9px] shrink-0 font-mono">
                                                                Stock: {item.stock_quantity}
                                                            </Badge>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleAddAllProductsToInbound}
                                    className="text-xs h-9 font-medium"
                                >
                                    + Load All Products
                                </Button>
                            </div>
                        </div>

                        {/* Receiving Table */}
                        <div className="border rounded-lg overflow-hidden bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-xs">Product / Variant</TableHead>
                                        <TableHead className="text-xs">SKU</TableHead>
                                        <TableHead className="text-xs text-center">Current Stock</TableHead>
                                        <TableHead className="text-xs text-center font-bold text-emerald-700 w-36">+ Quantity Received</TableHead>
                                        <TableHead className="text-xs text-center">New Expected Stock</TableHead>
                                        <TableHead className="text-xs text-right w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inboundLineItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                                                No products added to this receiving order yet. Select a product from the dropdown above or click "+ Load All Products".
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        inboundLineItems.map((line) => {
                                            const stockItem = stockItems.find(s => s.id === line.variantId);
                                            if (!stockItem) return null;

                                            const currentStock = stockItem.stock_quantity;
                                            const addedQty = line.quantityToAdd || 0;
                                            const newStock = currentStock + addedQty;

                                            return (
                                                <TableRow key={line.variantId}>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-2">
                                                            {stockItem.image_url && (
                                                                <img src={stockItem.image_url} alt="" className="w-8 h-8 rounded object-cover border" />
                                                            )}
                                                            <div>
                                                                <div className="font-semibold text-xs">{stockItem.product_name}</div>
                                                                <div className="text-[10px] text-muted-foreground">{stockItem.vial_type_name} ({stockItem.category_name})</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono">{stockItem.sku}</TableCell>
                                                    <TableCell className="text-center font-bold text-xs">{currentStock}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={line.quantityToAdd}
                                                            onChange={(e) => handleInboundQtyChange(line.variantId, parseInt(e.target.value) || 0)}
                                                            className="w-28 text-center font-bold text-sm h-8 mx-auto border-emerald-500 ring-1 ring-emerald-500/30"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                                            {newStock} units
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveInboundLine(line.variantId)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsInboundOrderOpen(false)} disabled={isSubmittingInbound}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleProcessInboundOrder}
                            disabled={isSubmittingInbound || inboundLineItems.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {isSubmittingInbound ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing Inbound...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Receive Stock (+{inboundLineItems.reduce((acc, i) => acc + (i.quantityToAdd || 0), 0)} Units)
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal for Inbound Receiving Orders History */}
            <Dialog open={isInboundHistoryOpen} onOpenChange={setIsInboundHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <History className="h-6 w-6" />
                            Inbound Receiving Orders History
                        </DialogTitle>
                        <DialogDescription>
                            Review all historical stock receiving orders, items added, and supplier notes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Search History */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search history by reference #, supplier, or notes..."
                                value={historySearchQuery}
                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                className="pl-9 text-xs h-9"
                            />
                        </div>

                        {/* History Table */}
                        <div className="border rounded-lg overflow-hidden bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-xs">Reference #</TableHead>
                                        <TableHead className="text-xs">Date & Time</TableHead>
                                        <TableHead className="text-xs">Supplier / Origin</TableHead>
                                        <TableHead className="text-xs text-center font-bold text-emerald-700">Total Units Received</TableHead>
                                        <TableHead className="text-xs">Notes</TableHead>
                                        <TableHead className="text-xs text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingHistory ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                                                Loading receiving history...
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (() => {
                                            const filteredLogs = inboundHistoryLogs.filter((log) => {
                                                const q = historySearchQuery.trim().toLowerCase();
                                                const details = log.new_values || log.changes || {};
                                                if (!q) return true;
                                                const refNum = details.reference_number || log.record_id || "";
                                                const supplier = details.supplier || "";
                                                const notes = details.notes || "";
                                                return refNum.toLowerCase().includes(q) || supplier.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
                                            });

                                            if (filteredLogs.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                                                            No receiving stock orders found in history.
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return filteredLogs.map((log) => {
                                                const details = log.new_values || log.changes || {};
                                                const refNum = details.reference_number || log.record_id || "IN-N/A";
                                                const supplier = details.supplier || "—";
                                                const notes = details.notes || "—";
                                                const totalUnits = details.total_units_added || 0;
                                                const createdAt = log.created_at ? format(new Date(log.created_at), "MMM dd, yyyy HH:mm") : "N/A";

                                                return (
                                                    <TableRow key={log.id} className="hover:bg-muted/30">
                                                        <TableCell className="font-mono font-bold text-xs text-primary">
                                                            {refNum}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {createdAt}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">
                                                            {supplier}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                                                +{totalUnits} units
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={notes}>
                                                            {notes}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setSelectedHistoryLog(log)}
                                                                    className="h-7 px-2 text-xs font-semibold"
                                                                    title="View Items"
                                                                >
                                                                    <Eye className="h-3 w-3 mr-1 text-primary" /> View Items
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleEditInboundOrder(log)}
                                                                    className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                                                    title="Edit Inbound Order"
                                                                >
                                                                    <Edit3 className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRevertInboundOrder(log)}
                                                                    disabled={deletingInboundLogId === log.id}
                                                                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                                                    title="Delete & Revert Stock"
                                                                >
                                                                    {deletingInboundLogId === log.id ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        })()
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal for Order Item Breakdown */}
            <Dialog open={!!selectedHistoryLog} onOpenChange={(open) => !open && setSelectedHistoryLog(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Package className="h-5 w-5 text-emerald-600" />
                            Inbound Order Details: {(selectedHistoryLog?.new_values || selectedHistoryLog?.changes)?.reference_number || selectedHistoryLog?.record_id}
                        </DialogTitle>
                        <DialogDescription>
                            Detailed breakdown of products received in this order.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedHistoryLog && (() => {
                        const details = selectedHistoryLog.new_values || selectedHistoryLog.changes || {};
                        return (
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-muted/30 p-3 rounded-lg border text-xs">
                                    <div>
                                        <span className="text-muted-foreground block">Reference #:</span>
                                        <span className="font-mono font-bold">{details.reference_number || selectedHistoryLog.record_id}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Date & Time:</span>
                                        <span className="font-semibold">{selectedHistoryLog.created_at ? format(new Date(selectedHistoryLog.created_at), "MMM dd, yyyy HH:mm") : "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Supplier:</span>
                                        <span className="font-semibold">{details.supplier || "—"}</span>
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden bg-card">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="text-xs">Product Name</TableHead>
                                                <TableHead className="text-xs">SKU</TableHead>
                                                <TableHead className="text-xs text-center font-bold text-emerald-700">Quantity Added</TableHead>
                                                <TableHead className="text-xs text-center">New Stock Level</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(details.items || []).map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-semibold text-xs py-2">{item.product_name || "Unknown Product"}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground py-2">{item.sku || "—"}</TableCell>
                                                    <TableCell className="text-center py-2">
                                                        <Badge className="bg-emerald-500/15 text-emerald-700 font-bold text-xs">
                                                            +{item.qty_added} units
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-xs py-2">
                                                        {item.new_stock ?? "—"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleRevertInboundOrder(selectedHistoryLog)}
                                        disabled={deletingInboundLogId === selectedHistoryLog.id}
                                        className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold"
                                    >
                                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                        Delete & Revert Stock
                                    </Button>
                                    <Button
                                        onClick={() => handleEditInboundOrder(selectedHistoryLog)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                                    >
                                        <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                                        Edit Inbound Order
                                    </Button>
                                </DialogFooter>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Confirmation Modal for Reverting Inbound Order */}
            <AlertDialog open={!!logToRevert} onOpenChange={(open) => !open && setLogToRevert(null)}>
                <AlertDialogContent className="z-[110]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Delete & Revert Inbound Order
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm py-2">
                            Are you sure you want to delete & revert Inbound Order <span className="font-mono font-bold text-foreground">{(logToRevert?.new_values || logToRevert?.changes)?.reference_number || logToRevert?.record_id}</span>?
                            <br /><br />
                            This will subtract the received stock quantities (<span className="font-bold text-destructive">-{(logToRevert?.new_values || logToRevert?.changes)?.total_units_added || 0} units</span>) from product inventory.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => setLogToRevert(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRevertInboundOrder}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                        >
                            Revert & Delete Order
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
