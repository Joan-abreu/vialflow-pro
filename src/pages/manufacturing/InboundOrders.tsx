import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import {
  ArrowDownCircle,
  Package,
  Calendar,
  Search,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  RefreshCw,
  QrCode,
  Eye,
  FileText,
  Boxes,
  ChevronsUpDown,
  AlertTriangle,
  Loader2,
  Building2,
  Layers,
  Sparkles,
  ShieldCheck,
  X,
  Filter,
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { generateBatchNumber } from "@/utils/batchGenerator";
import VialLabelModal from "@/components/production/VialLabelModal";

interface InboundLineItem {
  variantId: string;
  quantityToAdd: number;
  batchNumber: string;
}

export default function InboundOrders() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Inbound Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [inboundRefNumber, setInboundRefNumber] = useState("");
  const [inboundReceivedDate, setInboundReceivedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [inboundSupplier, setInboundSupplier] = useState("");
  const [inboundNotes, setInboundNotes] = useState("");
  const [inboundLineItems, setInboundLineItems] = useState<InboundLineItem[]>([]);
  const [lineItemFilter, setLineItemFilter] = useState("");
  const [lineItemFilterMode, setLineItemFilterMode] = useState<"all" | "received_only">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProductComboboxOpen, setIsProductComboboxOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Details Modal State
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logToRevert, setLogToRevert] = useState<any | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  // Vial Label Modal State
  const [labelModalBatch, setLabelModalBatch] = useState<any | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  // 1. Query catalog products & variants
  const { data: stockItems = [], isLoading: isLoadingStock } = useQuery({
    queryKey: ["inbound-catalog-items"],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select(`
          id, name, image_url,
          product_categories(name),
          variants:product_variants(
            id, product_id, sku, stock_quantity, pack_size, image_url,
            vial_type:vial_types(name, capacity_ml)
          )
        `)
        .order("name", { ascending: true });

      if (error) throw error;

      const flatVariants: any[] = [];
      (products || []).forEach((p: any) => {
        (p.variants || []).forEach((v: any) => {
          flatVariants.push({
            id: v.id,
            product_id: p.id,
            product_name: p.name,
            category_name: p.product_categories?.name || "Uncategorized",
            vial_type_name: v.vial_type?.name || "Standard",
            capacity_ml: v.vial_type?.capacity_ml || 2,
            sku: v.sku || "N/A",
            stock_quantity: v.stock_quantity ?? 0,
            image_url: v.image_url || p.image_url,
            pack_size: v.pack_size || 1,
          });
        });
      });

      return flatVariants;
    },
  });

  // 2. Query Inbound Orders History from audit_logs
  const {
    data: inboundLogs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["inbound-receiving-orders-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .eq("table_name", "inbound_stock_orders")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Open Modal for New Inbound Order
  const handleOpenNewOrder = () => {
    const today = new Date().toISOString().split("T")[0];
    const autoRef = `IN-${Date.now().toString().slice(-6)}`;
    setEditingLogId(null);
    setInboundRefNumber(autoRef);
    setInboundReceivedDate(today);
    setInboundSupplier("");
    setInboundNotes("");
    setInboundLineItems([]);
    setLineItemFilter("");
    setLineItemFilterMode("all");
    setIsOrderModalOpen(true);
  };

  // Add a product variant to the current receiving order
  const handleAddVariant = (variantId: string) => {
    if (!variantId) return;
    const stockItem = stockItems.find((s) => s.id === variantId);
    const dateObj = inboundReceivedDate ? new Date(inboundReceivedDate) : new Date();
    const batchNum = generateBatchNumber({
      productName: stockItem?.product_name,
      strategy: "hybrid",
      customDate: dateObj,
    });

    setInboundLineItems((prev) => {
      if (prev.some((i) => i.variantId === variantId)) return prev;
      return [...prev, { variantId, quantityToAdd: 50, batchNumber: batchNum }];
    });
  };

  // Load all products in one click
  const handleLoadAllProducts = () => {
    const dateObj = inboundReceivedDate ? new Date(inboundReceivedDate) : new Date();
    const all = stockItems.map((s) => ({
      variantId: s.id,
      quantityToAdd: 0,
      batchNumber: generateBatchNumber({
        productName: s.product_name,
        strategy: "hybrid",
        customDate: dateObj,
      }),
    }));
    setInboundLineItems(all);
    toast.info(`Loaded all ${all.length} products. Enter received quantities for the items you received.`);
  };

  const handleQtyChange = (variantId: string, qty: number) => {
    setInboundLineItems((prev) =>
      prev.map((i) =>
        i.variantId === variantId ? { ...i, quantityToAdd: Math.max(0, qty) } : i
      )
    );
  };

  const handleBatchChange = (variantId: string, batchNumber: string) => {
    setInboundLineItems((prev) =>
      prev.map((i) =>
        i.variantId === variantId ? { ...i, batchNumber: batchNumber.toUpperCase() } : i
      )
    );
  };

  const handleRegenerateBatch = (variantId: string) => {
    const stockItem = stockItems.find((s) => s.id === variantId);
    const dateObj = inboundReceivedDate ? new Date(inboundReceivedDate) : new Date();
    const newBatch = generateBatchNumber({
      productName: stockItem?.product_name,
      strategy: "hybrid",
      customDate: dateObj,
    });

    setInboundLineItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, batchNumber: newBatch } : i))
    );
    toast.info(`Generated batch: ${newBatch}`);
  };

  const handleRemoveLine = (variantId: string) => {
    setInboundLineItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Process and Submit Inbound Order
  const handleProcessOrder = async () => {
    if (inboundLineItems.length === 0) {
      toast.error("Please add at least one product to receive.");
      return;
    }

    const validItems = inboundLineItems.filter((i) => i.quantityToAdd > 0);
    if (validItems.length === 0) {
      toast.error("Please specify a received quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      let totalUnitsAdded = 0;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const receivedDateStr = inboundReceivedDate || new Date().toISOString().split("T")[0];

      // If editing an existing log, revert old quantities first
      if (editingLogId) {
        const oldLog = inboundLogs.find((l) => l.id === editingLogId);
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

      // 1. Update stock and create Batch & COA for each item
      for (const item of validItems) {
        const { data: vData } = await supabase
          .from("product_variants")
          .select("stock_quantity, product_id")
          .eq("id", item.variantId)
          .single();

        const matchedStockItem = stockItems.find((s) => s.id === item.variantId);
        const currentStock = vData ? vData.stock_quantity : matchedStockItem?.stock_quantity || 0;
        const newStock = currentStock + item.quantityToAdd;
        totalUnitsAdded += item.quantityToAdd;

        const { error: updateErr } = await supabase
          .from("product_variants")
          .update({ stock_quantity: newStock })
          .eq("id", item.variantId);

        if (updateErr) throw updateErr;

        const finalBatchNum = (item.batchNumber && item.batchNumber.trim())
          ? item.batchNumber.trim().toUpperCase()
          : generateBatchNumber({
              productName: matchedStockItem?.product_name,
              strategy: "hybrid",
              customDate: new Date(receivedDateStr),
            });

        // Create row in production_batches
        try {
          await supabase.from("production_batches").insert({
            batch_number: finalBatchNum,
            product_id: item.variantId,
            variant_id: item.variantId,
            quantity: item.quantityToAdd,
            sale_type: "individual",
            pack_quantity: 1,
            created_by: session?.user?.id || (await supabase.auth.getUser()).data.user?.id,
            status: "completed",
            completed_at: new Date(receivedDateStr).toISOString(),
            waste_notes: `Inbound Order: ${inboundRefNumber}${inboundSupplier ? ` • Supplier: ${inboundSupplier}` : ""}`,
          });
        } catch (batchErr) {
          console.warn("Error creating production_batch:", batchErr);
        }

        // Pre-register draft in product_coas
        const prodId = vData?.product_id || matchedStockItem?.product_id;
        if (prodId) {
          try {
            await supabase.from("product_coas" as any).insert({
              batch_number: finalBatchNum,
              product_id: prodId,
              product_ids: [prodId],
              test_date: receivedDateStr,
              pdf_url: "",
              sterility_status: "Pending Test",
              lab_name: "3rd Party Accredited US Lab",
              is_active: false,
              is_featured: false,
            });
          } catch (coaErr) {
            console.warn("Error pre-registering COA:", coaErr);
          }
        }
      }

      // 2. Save receiving order in audit_logs
      const payload = {
        table_name: "inbound_stock_orders",
        operation: editingLogId ? "UPDATE_INBOUND_RECEIVING" : "INBOUND_RECEIVING",
        changed_by: session?.user?.id || null,
        new_values: {
          reference_number: inboundRefNumber,
          received_date: receivedDateStr,
          supplier: inboundSupplier,
          notes: inboundNotes,
          total_units_added: totalUnitsAdded,
          items: validItems.map((i) => {
            const s = stockItems.find((x) => x.id === i.variantId);
            return {
              variant_id: i.variantId,
              sku: s?.sku,
              product_name: s?.product_name,
              qty_added: i.quantityToAdd,
              new_stock: (s?.stock_quantity || 0) + i.quantityToAdd,
              batch_number: (i.batchNumber && i.batchNumber.trim())
                ? i.batchNumber.trim().toUpperCase()
                : generateBatchNumber({ productName: s?.product_name, strategy: "hybrid" }),
            };
          }),
        },
      };

      if (editingLogId) {
        await supabase.from("audit_logs" as any).update(payload).eq("id", editingLogId);
        toast.success(`Inbound order ${inboundRefNumber} updated successfully!`);
      } else {
        await supabase.from("audit_logs" as any).insert({
          ...payload,
          record_id: crypto.randomUUID(),
        });
        toast.success(
          `Inbound order ${inboundRefNumber} received! Added ${totalUnitsAdded} units and generated batch numbers.`
        );
      }

      setIsOrderModalOpen(false);
      setEditingLogId(null);
      setInboundLineItems([]);
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ["inbound-catalog-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-quick-stock-manager"] });
      queryClient.invalidateQueries({ queryKey: ["production-batches-select"] });
    } catch (err: any) {
      console.error("Inbound process error:", err);
      toast.error(err.message || "Failed to process inbound receiving order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revert & Delete Inbound Order
  const handleConfirmRevert = async () => {
    if (!logToRevert) return;
    setIsReverting(true);
    const details = logToRevert.new_values || logToRevert.changes || {};
    const items = details.items || [];
    const refNum = details.reference_number || logToRevert.record_id || "IN-N/A";

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

      await supabase.from("audit_logs" as any).delete().eq("id", logToRevert.id);
      toast.success(`Inbound Order ${refNum} deleted! Subtracted ${totalUnitsReverted} units.`);
      setLogToRevert(null);
      setSelectedLog(null);
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ["inbound-catalog-items"] });
    } catch (err: any) {
      console.error("Revert error:", err);
      toast.error(err.message || "Failed to revert order.");
    } finally {
      setIsReverting(false);
    }
  };

  // Edit from history
  const handleEditFromHistory = (log: any) => {
    const details = log.new_values || log.changes || {};
    setEditingLogId(log.id);
    setInboundRefNumber(details.reference_number || `IN-${Date.now().toString().slice(-6)}`);
    setInboundReceivedDate(details.received_date || new Date().toISOString().split("T")[0]);
    setInboundSupplier(details.supplier || "");
    setInboundNotes(details.notes || "");

    const items = (details.items || [])
      .map((i: any) => {
        const s = stockItems.find((x) => x.id === i.variant_id);
        return {
          variantId: i.variant_id,
          quantityToAdd: i.qty_added || 0,
          batchNumber: i.batch_number || generateBatchNumber({ productName: s?.product_name, strategy: "hybrid" }),
        };
      })
      .filter((i: any) => !!i.variantId);

    setInboundLineItems(items);
    setLineItemFilter("");
    setLineItemFilterMode("all");
    setSelectedLog(null);
    setIsOrderModalOpen(true);
  };

  // Filtered line items inside the receiving order modal
  const filteredLineItems = inboundLineItems.filter((line) => {
    const stockItem = stockItems.find((s) => s.id === line.variantId);
    if (!stockItem) return false;

    if (lineItemFilterMode === "received_only" && (line.quantityToAdd || 0) <= 0) {
      return false;
    }

    if (!lineItemFilter.trim()) return true;
    const q = lineItemFilter.toLowerCase().trim();
    const name = (stockItem.product_name || "").toLowerCase();
    const sku = (stockItem.sku || "").toLowerCase();
    const batch = (line.batchNumber || "").toLowerCase();
    const cat = (stockItem.category_name || "").toLowerCase();
    const vial = (stockItem.vial_type_name || "").toLowerCase();

    return name.includes(q) || sku.includes(q) || batch.includes(q) || cat.includes(q) || vial.includes(q);
  });

  // Filter logs
  const filteredLogs = inboundLogs.filter((log: any) => {
    const details = log.new_values || log.changes || {};
    const ref = (details.reference_number || log.record_id || "").toLowerCase();
    const sup = (details.supplier || "").toLowerCase();
    const notes = (details.notes || "").toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    return !q || ref.includes(q) || sup.includes(q) || notes.includes(q);
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <ArrowDownCircle className="h-6 w-6" />
            </span>
            Inbound Orders & Stock Receiving
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register supplier shipments, auto-generate laboratory batch numbers, print vial labels, and restock inventory.
          </p>
        </div>

        <Button
          onClick={handleOpenNewOrder}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm h-10 px-5 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Register Inbound Order (+Stock)
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-card to-muted/20 border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              Total Inbound Shipments
              <Boxes className="h-4 w-4 text-primary opacity-60" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{inboundLogs.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Recorded replenishment orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-muted/20 border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              Total Units Received
              <Package className="h-4 w-4 text-emerald-600 opacity-60" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {inboundLogs.reduce((acc, curr) => acc + (curr.new_values?.total_units_added || 0), 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Vials added to available stock</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-muted/20 border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              Lot Numbering Standard
              <ShieldCheck className="h-4 w-4 text-primary opacity-60" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-bold text-foreground flex items-center gap-1.5 font-mono">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              [PREFIX]-[YYMM]-[RAND3]
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Automated cGMP lab traceability</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border">
        <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b">
          <div>
            <CardTitle className="text-base font-bold">Inbound Receiving History</CardTitle>
            <CardDescription className="text-xs">
              Every stock intake creates permanent batch traceability and pre-registered COAs.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search reference, supplier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 text-xs h-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {isLoadingLogs ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              Loading inbound history...
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              {searchQuery ? "No matching inbound orders found." : "No inbound orders registered yet. Click 'Register Inbound Order' to receive your first shipment."}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs">Reference #</TableHead>
                  <TableHead className="text-xs">Received Date</TableHead>
                  <TableHead className="text-xs">Supplier / Origin</TableHead>
                  <TableHead className="text-xs">Products & Batch Numbers</TableHead>
                  <TableHead className="text-xs text-center font-bold text-emerald-700">Units Added</TableHead>
                  <TableHead className="text-xs text-right w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log: any) => {
                  const details = log.new_values || log.changes || {};
                  const items = details.items || [];
                  const receivedDate = details.received_date || log.created_at;

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {details.reference_number || log.record_id}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium text-foreground">
                            {receivedDate ? format(new Date(receivedDate), "PP") : "—"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-medium">
                        {details.supplier ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{details.supplier}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {items.slice(0, 3).map((it: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 border text-foreground"
                            >
                              <strong>{it.product_name}:</strong> {it.batch_number || `+${it.qty_added}`}
                            </span>
                          ))}
                          {items.length > 3 && (
                            <span className="text-[10px] text-muted-foreground self-center font-medium">
                              +{items.length - 3} more
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center py-2">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                          +{details.total_units_added || 0} units
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-8 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                            title="View Order Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoadingLogs && filteredLogs.length > 0 && (
            <div className="p-4 border-t">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredLogs.length}
                pageSize={itemsPerPage}
                onPageSizeChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* REGISTER INBOUND RECEIVING MODAL */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="w-[96vw] max-w-6xl 2xl:max-w-7xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ArrowDownCircle className="h-6 w-6 shrink-0" />
              {editingLogId ? "Edit Inbound Receiving Order" : "Register Inbound Receiving Order (Stock Intake)"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Record incoming peptide shipments, assign certified lot numbers, print vial labels, and restock inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs overflow-y-auto pr-1 flex-1">
            {/* Top Form Fields: Reference #, Received Date, Supplier, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border shrink-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reference # *</Label>
                <Input
                  value={inboundRefNumber}
                  onChange={(e) => setInboundRefNumber(e.target.value)}
                  placeholder="e.g. IN-2026-001"
                  className="h-9 text-xs font-mono font-bold"
                  required
                />
              </div>

              {/* RECEIVED DATE FIELD */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  Received Date *
                </Label>
                <Input
                  type="date"
                  value={inboundReceivedDate}
                  onChange={(e) => setInboundReceivedDate(e.target.value)}
                  className="h-9 text-xs font-semibold border-emerald-500/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Supplier / Origin (Optional)</Label>
                <Input
                  value={inboundSupplier}
                  onChange={(e) => setInboundSupplier(e.target.value)}
                  placeholder="e.g. Synthesis Lab PO #42"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Comments</Label>
                <Input
                  value={inboundNotes}
                  onChange={(e) => setInboundNotes(e.target.value)}
                  placeholder="e.g. Lyophilized vials verified"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Product Selector and Table Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  Products Received ({inboundLineItems.length})
                </h4>

                {/* Quick Filter Toggles if items exist */}
                {inboundLineItems.length > 0 && (
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border text-xs">
                    <button
                      type="button"
                      onClick={() => setLineItemFilterMode("all")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        lineItemFilterMode === "all"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({inboundLineItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineItemFilterMode("received_only")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        lineItemFilterMode === "received_only"
                          ? "bg-emerald-600 text-white shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Qty &gt; 0 ({inboundLineItems.filter((i) => (i.quantityToAdd || 0) > 0).length})
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Real-time search filter for products in table */}
                {inboundLineItems.length > 0 && (
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter received products..."
                      value={lineItemFilter}
                      onChange={(e) => setLineItemFilter(e.target.value)}
                      className="pl-8 pr-7 h-9 text-xs bg-background"
                    />
                    {lineItemFilter && (
                      <button
                        type="button"
                        onClick={() => setLineItemFilter("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <Popover open={isProductComboboxOpen} onOpenChange={setIsProductComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-64 justify-between text-xs h-9 font-normal">
                      <span className="truncate text-muted-foreground">+ Add product to list...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0 pointer-events-auto z-[100]" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search product name, SKU..." className="text-xs h-9" />
                      <CommandList className="max-h-60 overflow-y-auto">
                        <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                          No matching products found.
                        </CommandEmpty>
                        <CommandGroup>
                          {stockItems.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.product_name} ${item.sku} ${item.vial_type_name}`}
                              onSelect={() => {
                                handleAddVariant(item.id);
                                setIsProductComboboxOpen(false);
                              }}
                              className="text-xs py-2 cursor-pointer flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs truncate">{item.product_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{item.vial_type_name} • SKU: {item.sku}</div>
                              </div>
                              <Badge variant="outline" className="text-[9px] font-mono">
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
                  onClick={handleLoadAllProducts}
                  className="text-xs h-9 font-medium w-full sm:w-auto"
                >
                  + Load All Products
                </Button>
              </div>
            </div>

            {/* Inbound Line Items Table */}
            <div className="border rounded-xl overflow-x-auto bg-card shadow-inner max-h-[48vh] overflow-y-auto">
              <Table className="min-w-[950px] w-full text-xs">
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="min-w-[280px] max-w-[380px] text-xs font-semibold">
                      Product / Variant {inboundLineItems.length > 0 && (lineItemFilter || lineItemFilterMode === "received_only") ? `(${filteredLineItems.length} of ${inboundLineItems.length})` : ""}
                    </TableHead>
                    <TableHead className="w-[100px] min-w-[100px] text-xs">SKU</TableHead>
                    <TableHead className="w-[200px] min-w-[200px] text-xs">Batch / Lot # (Auto)</TableHead>
                    <TableHead className="w-[100px] min-w-[100px] text-xs text-center">Current Stock</TableHead>
                    <TableHead className="w-[130px] min-w-[130px] text-xs text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">+ Quantity Received</TableHead>
                    <TableHead className="w-[110px] min-w-[110px] text-xs text-center">New Stock</TableHead>
                    <TableHead className="w-[95px] min-w-[95px] text-xs text-center">Vial Labels</TableHead>
                    <TableHead className="w-[50px] min-w-[50px] text-xs text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboundLineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                        No products added yet. Select a product from the dropdown above or click "+ Load All Products" to assign batch numbers and received quantities.
                      </TableCell>
                    </TableRow>
                  ) : filteredLineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                        <Filter className="h-6 w-6 mx-auto mb-1.5 opacity-40 text-muted-foreground" />
                        No products match your filter criteria "{lineItemFilter}".{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setLineItemFilter("");
                            setLineItemFilterMode("all");
                          }}
                          className="text-primary hover:underline font-semibold ml-1 inline-flex items-center gap-1"
                        >
                          Clear filters
                        </button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLineItems.map((line) => {
                      const stockItem = stockItems.find((s) => s.id === line.variantId);
                      if (!stockItem) return null;

                      const currentStock = stockItem.stock_quantity;
                      const addedQty = line.quantityToAdd || 0;
                      const newStock = currentStock + addedQty;

                      return (
                        <TableRow key={line.variantId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="min-w-[280px] max-w-[380px] py-2.5">
                            <div className="flex items-start gap-2.5">
                              {stockItem.image_url ? (
                                <img src={stockItem.image_url} alt="" className="w-9 h-9 rounded-md object-cover border shrink-0 mt-0.5" />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-muted border flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground text-[10px]">
                                  <Package className="w-4 h-4 text-muted-foreground/60" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs leading-snug line-clamp-2 text-foreground" title={stockItem.product_name}>
                                  {stockItem.product_name}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{stockItem.vial_type_name}</span>
                                  {stockItem.category_name && stockItem.category_name !== "Uncategorized" && (
                                    <span className="text-[10px] text-muted-foreground/80">• {stockItem.category_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px] text-xs font-mono text-muted-foreground">{stockItem.sku || "—"}</TableCell>

                          {/* Batch / Lot Cell */}
                          <TableCell className="w-[200px] min-w-[200px] py-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={line.batchNumber || ""}
                                onChange={(e) => handleBatchChange(line.variantId, e.target.value)}
                                className="w-36 h-8 font-mono text-xs uppercase font-bold bg-background border-primary/30 tracking-wide"
                                placeholder="e.g. BPC-2609-7X2"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleRegenerateBatch(line.variantId)}
                                className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10"
                                title="Regenerate random lot suffix"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell className="w-[100px] min-w-[100px] text-center font-bold text-xs font-mono">{currentStock.toLocaleString()}</TableCell>
                          <TableCell className="w-[130px] min-w-[130px] text-center py-2 bg-emerald-500/5">
                            <Input
                              type="number"
                              min="0"
                              value={line.quantityToAdd}
                              onChange={(e) => handleQtyChange(line.variantId, parseInt(e.target.value) || 0)}
                              className="w-24 text-center font-bold text-sm h-8 mx-auto border-emerald-500 ring-1 ring-emerald-500/30 bg-background"
                            />
                          </TableCell>
                          <TableCell className="w-[110px] min-w-[110px] text-center">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs border-0">
                              {newStock.toLocaleString()} units
                            </Badge>
                          </TableCell>

                          {/* Print Labels Button */}
                          <TableCell className="w-[95px] min-w-[95px] text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLabelModalBatch({
                                  id: line.variantId,
                                  batch_number: line.batchNumber || "PENDING",
                                  quantity: line.quantityToAdd || 50,
                                  product_name: stockItem.product_name,
                                  vial_capacity_ml: stockItem.capacity_ml,
                                  created_at: inboundReceivedDate ? new Date(inboundReceivedDate).toISOString() : new Date().toISOString(),
                                });
                                setLabelModalOpen(true);
                              }}
                              className="h-8 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                              title="Print Physical Labels for this Lot"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Labels
                            </Button>
                          </TableCell>

                          <TableCell className="w-[50px] min-w-[50px] text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveLine(line.variantId)}
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

          <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t mt-2 shrink-0">
            <div className="text-xs text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground">{inboundLineItems.length}</span> products •{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{inboundLineItems.reduce((acc, i) => acc + (i.quantityToAdd || 0), 0).toLocaleString()}
              </span> units to restock
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOrderModalOpen(false)}
                className="flex-1 sm:flex-none text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleProcessOrder}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Process Inbound Order (+Stock)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAILS VIEW MODAL */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[88vh] overflow-y-auto p-4 sm:p-6">
          {selectedLog && (() => {
            const details = selectedLog.new_values || selectedLog.changes || {};
            const items = details.items || [];
            const recDate = details.received_date || selectedLog.created_at;

            return (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Inbound Order Details: {details.reference_number || selectedLog.record_id}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Recorded replenishment entry and generated batch lots.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground block font-medium">Reference:</span>
                    <span className="font-mono font-bold">{details.reference_number || selectedLog.record_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Received Date:</span>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      {recDate ? format(new Date(recDate), "PP") : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Supplier:</span>
                    <span className="font-semibold">{details.supplier || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Total Units:</span>
                    <span className="font-bold text-emerald-600">+{details.total_units_added || 0} units</span>
                  </div>
                </div>

                {details.notes && (
                  <div className="p-2.5 bg-muted/20 border rounded-lg text-xs">
                    <span className="font-semibold text-muted-foreground">Notes: </span>
                    {details.notes}
                  </div>
                )}

                <div className="border rounded-xl overflow-x-auto bg-card">
                  <Table className="min-w-[700px] w-full text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Product Name</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Batch / Lot #</TableHead>
                        <TableHead className="text-xs text-center font-bold text-emerald-700">Quantity Added</TableHead>
                        <TableHead className="text-xs text-center">New Stock Level</TableHead>
                        <TableHead className="text-xs text-right">Labels</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-xs py-2">{item.product_name || "Unknown Product"}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground py-2">{item.sku || "—"}</TableCell>
                          <TableCell className="py-2">
                            {item.batch_number ? (
                              <Badge variant="outline" className="font-mono text-[10px] font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                                {item.batch_number}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Badge className="bg-emerald-500/15 text-emerald-700 font-bold text-xs">
                              +{item.qty_added} units
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs py-2">
                            {item.new_stock ?? "—"}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {item.batch_number && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLabelModalBatch({
                                    id: item.variant_id,
                                    batch_number: item.batch_number,
                                    quantity: item.qty_added || 50,
                                    product_name: item.product_name,
                                    created_at: recDate ? new Date(recDate).toISOString() : new Date().toISOString(),
                                  });
                                  setLabelModalOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 gap-1 font-semibold"
                                title="Print Labels for this Lot"
                              >
                                <QrCode className="h-3 w-3" />
                                Labels
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setLogToRevert(selectedLog)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Delete & Revert Stock
                  </Button>
                  <Button
                    onClick={() => handleEditFromHistory(selectedLog)}
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

      {/* REVERT CONFIRMATION MODAL */}
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
              onClick={handleConfirmRevert}
              disabled={isReverting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              {isReverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revert & Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VIAL LABEL PRINT & QR MODAL */}
      <VialLabelModal
        batch={labelModalBatch}
        open={labelModalOpen}
        onOpenChange={setLabelModalOpen}
      />
    </div>
  );
}
