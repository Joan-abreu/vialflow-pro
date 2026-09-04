import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
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
import { Factory, Loader2, Eye, Tag, Truck, Search, Package, Trash2, Mail, RefreshCw, Printer, X, FileText, Lock, ShieldCheck, AlertTriangle, XCircle, Plus, Receipt } from "lucide-react";

import { MultiCarrierShippingDialog } from "@/components/shipping/MultiCarrierShippingDialog";
import { CreateManualOrderDialog } from "@/components/orders/CreateManualOrderDialog";
import { EditAddressDialog } from "@/components/shipping/EditAddressDialog";
import { SendEmailDialog } from "@/components/shared/SendEmailDialog";
import { VirtualTerminalModal } from "@/components/admin/VirtualTerminalModal";
import { P2PVerificationModal } from "@/components/admin/P2PVerificationModal";
import { UploadPaymentProofDialog } from "@/components/checkout/UploadPaymentProofDialog";

import CopyCell from "@/components/CopyCell";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkShippingDialog } from "@/components/shipping/BulkShippingDialog";
import { OrderNotesDialog } from "@/components/orders/OrderNotesDialog";
import { PackingSlipDialog } from "@/components/orders/PackingSlipDialog";
import { PackingSlipDocument } from "@/components/orders/PackingSlipDocument";
import { InvoiceDialog } from "@/components/orders/InvoiceDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    price_at_time: number;
    is_bulk?: boolean;
    with_labels?: boolean;
    label_fee_applied?: number;
    custom_label_image_url?: string | null;
    custom_label_instructions?: string | null;
    variant?: {
        id: string;
        product_id: string;
        vial_type_id: string;
        sku: string;
        sale_type: string;
        pack_size: number;
        image_url: string | null;
        product: {
            name: string;
            image_url: string | null;
        };
        vial_type: {
            name: string;
            capacity_ml: number;
            color: string | null;
            shape: string | null;
        };
    };
}

interface Order {
    id: string;
    total_amount: number;
    shipping_cost?: number;
    status: string;
    created_at: string;
    user_id: string;
    customer_email: string;
    shipping_address: any;
    sent_to_production: boolean;
    sent_to_production_at: string | null;
    tracking_number?: string | null;
    shipping_service?: string;
    shipping_service_code?: string;
    shipping_carrier?: string;
    payment_method?: string | null;
    payment_intent_id?: string | null;
    p2p_status?: string | null;
    p2p_submission_count?: number | null;
    p2p_proof_url?: string | null;
    order_items?: OrderItem[];
    customer_profile?: {
        full_name: string;
    };
    order_shipments?: {
        id: string;
        carrier: string;
        tracking_number: string;
        tracking_url: string;
        label_url: string;
        status: string;
        pickup_confirmation?: string;
    }[];
    applied_coupons?: string[];
    product_discount?: number;
    shipping_discount?: number;
}

const OrderManagement = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [showProductionDialog, setShowProductionDialog] = useState(false);
    const [showShippingDialog, setShowShippingDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("to_ship");
    const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string, status: string } | null>(null);
    const [selectedVirtualTerminalOrder, setSelectedVirtualTerminalOrder] = useState<Order | null>(null);
    const [isVirtualTerminalOpen, setIsVirtualTerminalOpen] = useState(false);
    const [selectedP2POrder, setSelectedP2POrder] = useState<Order | null>(null);
    const [isP2PModalOpen, setIsP2PModalOpen] = useState(false);
    const [selectedUploadProofOrder, setSelectedUploadProofOrder] = useState<Order | null>(null);
    const [isUploadProofModalOpen, setIsUploadProofModalOpen] = useState(false);
    const [refreshingTracking, setRefreshingTracking] = useState<string | null>(null);
    const [packingSlipOrders, setPackingSlipOrders] = useState<Order[] | null>(null);
    const [isPackingSlipOpen, setIsPackingSlipOpen] = useState(false);
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [filterManualOnly, setFilterManualOnly] = useState(false);

    const handleOpenInvoice = (order: Order) => {
        setInvoiceOrder(order);
        setIsInvoiceOpen(true);
    };

    const queryClient = useQueryClient();
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { data: orders, isLoading } = useQuery({
        queryKey: ["orders"],
        queryFn: async () => {
            const { data: ordersData, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items (
                        *,
                        variant:product_variants (
                            *,
                            product:products (*),
                            vial_type:vial_types (*)
                        )
                    ),
                    order_shipments (*)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            if (!ordersData) return [];

            // Get unique user_ids to fetch profiles across tables
            const userIds = [...new Set(ordersData.map(o => o.user_id).filter(id => !!id))];
            
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name")
                    .in("user_id", userIds);
                
                // Map profiles back to orders
                const profileMap = (profiles || []).reduce((acc, p) => {
                    acc[p.user_id] = { full_name: p.full_name };
                    return acc;
                }, {} as Record<string, { full_name: string }>);

                return ordersData.map(order => ({
                    ...order,
                    customer_profile: order.user_id ? profileMap[order.user_id] : null
                })) as any as Order[];
            }

            return ordersData as any as Order[];
        },
        refetchInterval: 5 * 60 * 1000, // Auto-refreshes orders every 5 minutes
        refetchIntervalInBackground: false,
    });

    // Fetch all order notes count mapping
    const { data: allOrderNotes } = useQuery({
        queryKey: ["all-order-notes"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("order_notes")
                .select("id, order_id");
            if (error) return [];
            return data || [];
        },
        refetchInterval: 5 * 60 * 1000,
    });

    const notesCountMap = useMemo(() => {
        const map: Record<string, number> = {};
        (allOrderNotes || []).forEach((n: any) => {
            map[n.order_id] = (map[n.order_id] || 0) + 1;
        });
        return map;
    }, [allOrderNotes]);

    const formatVariantSpecification = (variant: any) => {
        if (!variant) return "";
        const vialName = variant.vial_type?.name || "";
        const capMl = variant.vial_type?.capacity_ml;
        const color = variant.vial_type?.color;
        const shape = variant.vial_type?.shape;
        const category = (variant.product?.category || variant.product?.product_categories?.name || "").toLowerCase();
        
        // Check if it is a peptide or specified in MG
        const isMg = 
            vialName.toLowerCase().includes("mg") || 
            category.includes("peptide") ||
            (variant.sku && /^(RT|MOTS|NAD|TR|GLP|PEP)/i.test(variant.sku));

        if (isMg) {
            // Only show the MG dosage (e.g. "40mg", "500mg", "30mg", "10mg")
            const mgLabel = vialName || (capMl ? `${capMl}mg` : "");
            const details = [color, shape].filter(Boolean).join(" - ");
            return details ? `${mgLabel} (${details})` : mgLabel;
        }

        // For Reconstitution Solutions / BAC water (liquid volumes in ml)
        const sizeStr = capMl ? `${capMl}ml` : "";
        let mainLabel = vialName || sizeStr;
        
        if (vialName && sizeStr) {
            if (vialName.toLowerCase() === sizeStr.toLowerCase() || vialName.toLowerCase().includes(sizeStr.toLowerCase())) {
                mainLabel = vialName;
            } else {
                mainLabel = `${sizeStr} (${vialName})`;
            }
        }

        const details = [color, shape].filter(Boolean).join(" - ");
        if (details && !mainLabel.includes(details)) {
            return `${mainLabel} - ${details}`;
        }
        return mainLabel;
    };

    const CUSTOMER_NOTIFY_STATUSES = ['shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const updatePayload: any = { status };

            if (status === 'ready_to_ship') {
                updatePayload.tracking_number = null;
                await supabase.from("order_shipments").delete().eq("order_id", orderId);
            }

            const { error } = await supabase
                .from("orders")
                .update(updatePayload)
                .eq("id", orderId);

            if (error) throw error;

            if (CUSTOMER_NOTIFY_STATUSES.includes(status)) {
                try {
                    await supabase.functions.invoke("send-order-email", {
                        body: { order_id: orderId, type: "status_update" },
                    });
                } catch (emailErr) {
                    console.error("Error sending status email:", emailErr);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Order status updated");
        },
    });

    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [bulkStatus, setBulkStatus] = useState<string>("");
    const [showBulkShippingDialog, setShowBulkShippingDialog] = useState(false);

    const selectedOrders = useMemo(() => {
        if (!orders) return [];
        return orders.filter(o => selectedOrderIds.includes(o.id));
    }, [orders, selectedOrderIds]);

    const readyToShipOrders = useMemo(() => {
        return selectedOrders.filter(o => o.status === 'ready_to_ship');
    }, [selectedOrders]);

    const allSelectedAreReadyToShip = useMemo(() => {
        return selectedOrders.length > 0 && selectedOrders.every(o => o.status === 'ready_to_ship');
    }, [selectedOrders]);

    const isBulkShippingEnabled = useMemo(() => {
        return allSelectedAreReadyToShip && selectedOrders.length <= 50;
    }, [allSelectedAreReadyToShip, selectedOrders.length]);

    const handleOpenBulkShipping = () => {
        if (selectedOrders.length > 50) {
            toast.error(`Shippo supports a maximum of 50 orders per batch. You currently have ${selectedOrders.length} selected. Please select 50 or fewer.`);
            return;
        }
        if (!allSelectedAreReadyToShip) {
            toast.error("All selected orders must be in 'Ready to Ship' status to create shipping labels.");
            return;
        }
        setShowBulkShippingDialog(true);
    };

    const handleOpenPackingSlip = (order: Order) => {
        setPackingSlipOrders([order]);
        setIsPackingSlipOpen(true);
    };

    const handleOpenBulkPackingSlips = () => {
        if (selectedOrders.length === 0) {
            toast.error("Please select at least one order to generate packing slips.");
            return;
        }
        setPackingSlipOrders(selectedOrders);
        setIsPackingSlipOpen(true);
    };

    const bulkUpdateStatusMutation = useMutation({
        mutationFn: async ({ orderIds, status }: { orderIds: string[]; status: string }) => {
            const updatePayload: any = { status };

            if (status === 'ready_to_ship') {
                updatePayload.tracking_number = null;
                await supabase.from("order_shipments").delete().in("order_id", orderIds);
            }

            const { error } = await supabase
                .from("orders")
                .update(updatePayload)
                .in("id", orderIds);

            if (error) throw error;

            if (CUSTOMER_NOTIFY_STATUSES.includes(status)) {
                for (const id of orderIds) {
                    try {
                        await supabase.functions.invoke("send-order-email", {
                            body: { order_id: id, type: "status_update" },
                        });
                    } catch (emailErr) {
                        console.error(`Error sending bulk status email for order ${id}:`, emailErr);
                    }
                }
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            setSelectedOrderIds([]);
            setBulkStatus("");
            toast.success(`Updated ${variables.orderIds.length} orders to ${variables.status.replace(/_/g, " ")}`);
        },
        onError: (error: any) => {
            toast.error("Failed bulk status update: " + error.message);
        },
    });

    const bulkSendToProductionMutation = useMutation({
        mutationFn: async (orderIds: string[]) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const targetOrders = orders?.filter(o => orderIds.includes(o.id) && !o.sent_to_production) || [];
            if (targetOrders.length === 0) {
                throw new Error("No eligible orders selected (orders may already be in production)");
            }

            for (const order of targetOrders) {
                const variantGroups = getVariantGroups(order);
                const batchInserts = variantGroups.map((group, index) => ({
                    batch_number: `ORD-${order.id.slice(0, 8)}-${index + 1}`,
                    product_id: group.variant.id,
                    quantity: group.totalQuantity * group.variant.pack_size,
                    sale_type: group.variant.sale_type,
                    pack_quantity: group.variant.sale_type === 'pack' ? group.variant.pack_size : null,
                    status: 'pending',
                    order_id: order.id,
                    created_by: user.id
                }));

                const { error: batchError } = await supabase
                    .from("production_batches")
                    .insert(batchInserts);

                if (batchError) throw batchError;

                const { error } = await supabase
                    .from("orders")
                    .update({
                        sent_to_production: true,
                        sent_to_production_at: new Date().toISOString(),
                        status: 'in_production'
                    })
                    .eq("id", order.id);

                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            setSelectedOrderIds([]);
            toast.success("Selected orders sent to production");
        },
        onError: (error: any) => {
            toast.error("Bulk production error: " + error.message);
        }
    });

    const deleteOrderMutation = useMutation({
        mutationFn: async (orderId: string) => {
            // 1. Delete shipments
            const { error: shipmentError } = await supabase
                .from("order_shipments")
                .delete()
                .eq("order_id", orderId);
            
            if (shipmentError) console.error("Shipment delete error:", shipmentError);

            // 2. Delete related production batches
            const { error: batchError } = await supabase
                .from("production_batches")
                .delete()
                .eq("order_id", orderId);
            
            if (batchError) console.error("Batch delete error:", batchError);

            // 3. Delete order items
            const { error: itemsError } = await supabase
                .from("order_items")
                .delete()
                .eq("order_id", orderId);
            
            if (itemsError) throw itemsError;
            
            // 4. Finally delete the order itself
            const { count: orderCount, error } = await supabase
                .from("orders")
                .delete({ count: 'exact' })
                .eq("id", orderId);

            if (error) throw error;
            
            if (orderCount === 0) {
                throw new Error("The order was not found or you don't have permission to delete it. (Rows affected: 0)");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Order deleted successfully");
            setDeletingOrder(null);
        },
        onError: (error) => {
            toast.error("Failed to delete order: " + error.message);
        },
    });

    const sendToProductionMutation = useMutation({
        mutationFn: async (order: Order) => {
            const variantGroups = getVariantGroups(order);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("User not authenticated");

            // Create production batches for each variant group
            const batchInserts = variantGroups.map((group, index) => ({
                batch_number: `ORD-${order.id.slice(0, 8)}-${index + 1}`,
                product_id: group.variant.id,
                quantity: group.totalQuantity * group.variant.pack_size,
                sale_type: group.variant.sale_type,
                pack_quantity: group.variant.sale_type === 'pack' ? group.variant.pack_size : null,
                status: 'pending',
                order_id: order.id,
                created_by: user.id
            }));

            const { error: batchError } = await supabase
                .from("production_batches")
                .insert(batchInserts);

            if (batchError) throw batchError;

            // Mark the order as sent to production
            const { error } = await supabase
                .from("orders")
                .update({
                    sent_to_production: true,
                    sent_to_production_at: new Date().toISOString(),
                    status: 'in_production'
                })
                .eq("id", order.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            setShowProductionDialog(false);
            toast.success("Order sent to production");
        },
        onError: (error) => {
            toast.error("Failed to send to production: " + error.message);
        },
    });

    const handleStatusChange = (orderId: string, status: string) => {
        updateStatusMutation.mutate({ orderId, status });
    };

    const handleInitiateStatusChange = (orderId: string, status: string) => {
        setPendingStatusChange({ orderId, status });
    };

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setShowDetailsDialog(true);
    };

    const handleSendToProduction = (order: Order) => {
        setSelectedOrder(order);
        setShowProductionDialog(true);
    };

    const handleCreateShippingLabel = (order: Order) => {
        setSelectedOrder(order);
        setShowShippingDialog(true);
    };

    const renderCarrierLogo = (carrierStr?: string, serviceStr?: string) => {
        const combined = `${carrierStr || ""} ${serviceStr || ""}`.toLowerCase();
        let iconName = "usps.svg";

        if (combined.includes("ups") || combined.includes("next day air")) {
            iconName = "ups.svg";
        } else if (combined.includes("fedex") || combined.includes("2day")) {
            iconName = "fedex.svg";
        } else if (combined.includes("dhl")) {
            iconName = "dhl.svg";
        }

        return (
            <img 
                src={`/carriers/${iconName}`} 
                alt="Carrier Logo" 
                className="w-5 h-5 object-contain shrink-0 rounded"
            />
        );
    };

    const getCarrierBadge = (carrier?: string, service?: string) => {
        if (!carrier && !service) return null;
        
        const combined = `${carrier || ""} ${service || ""}`.toLowerCase();
        let carrierTarget = "USPS";
        if (combined.includes("ups")) carrierTarget = "UPS";
        else if (combined.includes("fedex")) carrierTarget = "FedEx";
        else if (combined.includes("dhl")) carrierTarget = "DHL";

        const serviceName = service ? service.replace(/®|™/g, "") : carrierTarget;

        return (
            <div className="flex items-center gap-1.5 min-w-0" title={`Shippo / ${serviceName}`}>
                {renderCarrierLogo(carrier, service)}
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-800 shrink-0">
                    <span className="text-[10px] text-slate-500 font-normal shrink-0">Shippo /</span>
                    <span className="whitespace-nowrap font-medium text-slate-800">{serviceName}</span>
                </div>
            </div>
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-gray-100 text-gray-800";
            case "pending_payment": return "bg-yellow-100 text-yellow-800";
            case "processing": return "bg-blue-100 text-blue-800";
            case "in_production": return "bg-purple-100 text-purple-800";
            case "ready_to_ship": return "bg-orange-100 text-orange-800";
            case "label_created": return "bg-cyan-100 text-cyan-800";
            case "pickup_scheduled": return "bg-teal-100 text-teal-800";
            case "shipped": return "bg-indigo-100 text-indigo-800";
            case "in_transit": return "bg-violet-100 text-violet-800";
            case "out_for_delivery": return "bg-sky-100 text-sky-800";
            case "delivered": return "bg-green-100 text-green-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const handleRefreshTracking = async (shipmentId: string, carrier: string) => {
        try {
            setRefreshingTracking(shipmentId);
            const { data: { session } } = await supabase.auth.getSession();
            
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipping`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        carrier: carrier,
                        action: 'track_shipment',
                        data: {
                            shipmentId: shipmentId
                        }
                    }),
                }
            );

            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            toast.success(`Tracking status updated for ${carrier}`);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        } catch (e: any) {
            toast.error(`Error refreshing: ${e.message}`);
        } finally {
            setRefreshingTracking(null);
        }
    };

    const getVariantGroups = (order: Order | null) => {
        if (!order || !order.order_items) return [];
        const groups: Record<string, { variant: any, totalQuantity: number }> = {};

        order.order_items.forEach(item => {
            if (!item.variant) return;
            const key = item.variant_id;
            if (!groups[key]) {
                groups[key] = { variant: item.variant, totalQuantity: 0 };
            }
            groups[key].totalQuantity += item.quantity;
        });

        return Object.values(groups);
    };

    const isInvoiceOrder = (order: Order | any) => {
        if (!order) return false;
        const method = (order.payment_method || "").toLowerCase();
        return (
            method === "external_invoice" ||
            method === "zelle" ||
            method === "bank_wire" ||
            method === "cash" ||
            method === "offline_manual" ||
            method === "manual_terminal" ||
            method === "manual"
        );
    };

    const TABS = [
        { id: 'to_ship', label: 'To Ship', statuses: ['processing', 'in_production', 'ready_to_ship'] },
        { id: 'awaiting_collection', label: 'Awaiting Collection', statuses: ['label_created', 'pickup_scheduled'] },
        { id: 'shipped', label: 'Shipped', statuses: ['shipped'] },
        { id: 'in_transit', label: 'In Transit', statuses: ['in_transit', 'out_for_delivery'] },
        { id: 'completed', label: 'Completed', statuses: ['delivered'] },
        { id: 'unpaid', label: 'Unpaid / Pending', statuses: ['pending', 'pending_payment'] },
        { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
        { id: 'all', label: 'All', statuses: [] },
    ];

    const totalManualOrdersCount = useMemo(() => {
        return orders?.filter(isInvoiceOrder).length || 0;
    }, [orders]);

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = { 
            all: orders?.length || 0,
        };
        TABS.filter(t => t.id !== 'all').forEach(tab => {
            counts[tab.id] = orders?.filter(o => tab.statuses.includes(o.status)).length || 0;
        });
        return counts;
    }, [orders]);

    const filteredOrders = orders?.filter((order) => {
        // First filter by tab
        if (activeTab !== 'all') {
            const currentTab = TABS.find(t => t.id === activeTab);
            if (currentTab && !currentTab.statuses.includes(order.status)) {
                return false;
            }
        }

        // Filter by manual-only toggle
        if (filterManualOnly && !isInvoiceOrder(order)) {
            return false;
        }

        // Then filter by search query
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        
        // Match "invoice" or "invoices" or "manual"
        const isInvoiceKeyword = query === "invoice" || query === "invoices" || query === "manual";
        if (isInvoiceKeyword && isInvoiceOrder(order)) return true;

        const matchesOrder = (
            order.id.toLowerCase().includes(query) ||
            order.customer_email?.toLowerCase().includes(query) ||
            order.customer_profile?.full_name?.toLowerCase().includes(query) ||
            order.status.toLowerCase().includes(query) ||
            (order.payment_method && order.payment_method.toLowerCase().includes(query)) ||
            (order.tracking_number && order.tracking_number.toLowerCase().includes(query)) ||
            order.applied_coupons?.some(c => c.toLowerCase().includes(query))
        );

        const matchesShipments = order.order_shipments?.some(shipment => 
            shipment.tracking_number?.toLowerCase().includes(query)
        );

        const matchesItems = order.order_items?.some(item => 
            (item.variant?.sku && item.variant.sku.toLowerCase().includes(query)) ||
            (item.variant?.product?.name && item.variant.product.name.toLowerCase().includes(query))
        );

        return matchesOrder || matchesShipments || matchesItems;
    });

    const currentVisibleOrders = useMemo(() => {
        if (!filteredOrders) return [];
        return filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredOrders, currentPage, itemsPerPage]);

    const isAllVisibleSelected = useMemo(() => {
        if (currentVisibleOrders.length === 0) return false;
        return currentVisibleOrders.every(o => selectedOrderIds.includes(o.id));
    }, [currentVisibleOrders, selectedOrderIds]);

    const handleToggleSelectAll = () => {
        const visibleIds = currentVisibleOrders.map(o => o.id);
        if (isAllVisibleSelected) {
            setSelectedOrderIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedOrderIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleSelectAllFiltered = () => {
        if (!filteredOrders) return;
        const allFilteredIds = filteredOrders.map(o => o.id);
        setSelectedOrderIds(allFilteredIds);
        toast.info(`Selected all ${allFilteredIds.length} filtered orders`);
    };

    const handleToggleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    return (
        <>
        <div className="space-y-6 print:hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Order Management</h1>
                    <p className="text-muted-foreground mt-2">
                        Track and manage your customer orders, production status, and shipments.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ["orders"] });
                            queryClient.invalidateQueries({ queryKey: ["all-order-notes"] });
                            toast.success("Orders list refreshed");
                        }}
                        title="Refresh orders (Auto-refreshes every 5 mins)"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin text-primary")} />
                    </Button>
                    <Button 
                        onClick={() => setIsCreateOrderOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground font-bold shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Create Order / Invoice
                    </Button>
                    <Link to="/manufacturing/order-labels">
                        <Button variant="outline" className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            Shipping & Pickups
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="relative flex items-center w-full sm:w-96">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
                        <Input
                            placeholder="Search by ID, Customer, SKU, Product, Email, or Tracking #"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-9"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setCurrentPage(1);
                                }}
                                className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted"
                                title="Clear search filter"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Quick filter for Manual Orders / Invoices without disrupting lifecycle tabs */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant={filterManualOnly ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setFilterManualOnly(!filterManualOnly);
                                setCurrentPage(1);
                            }}
                            className={cn(
                                "h-9 text-xs font-semibold gap-1.5 transition-colors",
                                filterManualOnly
                                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                    : "border-purple-200 text-purple-700 hover:bg-purple-50"
                            )}
                        >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>{filterManualOnly ? "Showing Manual Orders Only" : "Filter: Manual Orders"}</span>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center font-bold ml-0.5",
                                    filterManualOnly ? "bg-white/25 text-white" : "bg-purple-100 text-purple-800"
                                )}
                            >
                                {totalManualOrdersCount}
                            </Badge>
                            {filterManualOnly && (
                                <X className="h-3 w-3 ml-0.5 text-white/80" />
                            )}
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(val) => {
                    setActiveTab(val);
                    setCurrentPage(1);
                    setSelectedOrderIds([]);
                }} className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50 gap-1">
                        {TABS.map((tab) => (
                            <TabsTrigger 
                                key={tab.id} 
                                value={tab.id}
                                className="px-4 py-2 text-sm whitespace-nowrap"
                            >
                                {tab.label}
                                {tabCounts[tab.id] > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center">
                                        {tabCounts[tab.id]}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            {selectedOrderIds.length > 0 && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all animate-in fade-in slide-in-from-top-2">
                    {/* Left: Selection count, Deselect button, and Select all filtered */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="bg-primary text-primary-foreground font-bold px-2.5 py-1 text-xs shadow-2xs">
                            {selectedOrderIds.length} Order{selectedOrderIds.length > 1 ? 's' : ''} Selected
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold gap-1"
                            onClick={() => setSelectedOrderIds([])}
                            title="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                            Deselect All
                        </Button>
                        {filteredOrders && filteredOrders.length > selectedOrderIds.length && (
                            <>
                                <div className="h-3.5 w-[1px] bg-border mx-0.5" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-primary hover:bg-primary/10 h-7 px-2 font-medium"
                                    onClick={handleSelectAllFiltered}
                                >
                                    Select all {filteredOrders.length} in this tab
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Select
                            value={bulkStatus}
                            onValueChange={(value) => {
                                setBulkStatus(value);
                                if (value) {
                                    bulkUpdateStatusMutation.mutate({ orderIds: selectedOrderIds, status: value });
                                }
                            }}
                        >
                            <SelectTrigger className="w-[190px] h-8 text-xs bg-background">
                                <SelectValue placeholder="Bulk Change Status..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending_payment">Pending Payment</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="in_production">In Production</SelectItem>
                                <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                                <SelectItem value="label_created">Label Created</SelectItem>
                                <SelectItem value="pickup_scheduled">Pickup Scheduled</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="in_transit">In Transit</SelectItem>
                                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-background"
                            onClick={() => bulkSendToProductionMutation.mutate(selectedOrderIds)}
                            disabled={bulkSendToProductionMutation.isPending}
                        >
                            <Factory className="h-3.5 w-3.5 mr-1 text-primary" />
                            Send to Production
                        </Button>

                        {selectedOrders.length > 50 && (
                            <Badge variant="destructive" className="text-[11px] animate-pulse">
                                ⚠️ Max 50 orders per batch ({selectedOrders.length} selected)
                            </Badge>
                        )}

                        <Button
                            size="sm"
                            variant={isBulkShippingEnabled ? "default" : "outline"}
                            className={`h-8 text-xs font-medium ${isBulkShippingEnabled ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "opacity-60"}`}
                            onClick={handleOpenBulkShipping}
                            disabled={!isBulkShippingEnabled}
                            title={
                                selectedOrders.length > 50 
                                    ? `Shippo limit: Max 50 orders per batch (Currently selected: ${selectedOrders.length})` 
                                    : !allSelectedAreReadyToShip 
                                        ? "All selected orders must be in 'Ready to Ship' status to generate labels" 
                                        : ""
                            }
                        >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Create Shipping Labels ({selectedOrders.length})
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-background border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold gap-1"
                            onClick={() => {
                                if (selectedOrders.length > 0) {
                                    handleOpenInvoice(selectedOrders[0]);
                                }
                            }}
                            title="View / Print Invoice for selected order"
                        >
                            <Receipt className="h-3.5 w-3.5 text-purple-600" />
                            Invoice ({selectedOrders.length})
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-background border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold gap-1"
                            onClick={handleOpenBulkPackingSlips}
                            title="Generate and print packing slips for selected orders"
                        >
                            <Printer className="h-3.5 w-3.5 text-indigo-600" />
                            Packing Slips ({selectedOrders.length})
                        </Button>
                    </div>
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl">Orders ({filteredOrders?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto w-full border-t max-h-[calc(100vh-260px)] relative shadow-inner">
                        <Table className="min-w-[1300px] [&_td]:py-2 [&_td]:px-3 [&_th]:py-2.5 [&_th]:px-3">
                            <TableHeader className="bg-muted/90 backdrop-blur sticky top-0 z-20 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={isAllVisibleSelected}
                                            onCheckedChange={handleToggleSelectAll}
                                            aria-label="Select all orders on page"
                                        />
                                    </TableHead>
                                    <TableHead className="min-w-[90px]">Order ID</TableHead>
                                    <TableHead className="min-w-[110px]">Date</TableHead>
                                    <TableHead className="min-w-[160px]">Customer</TableHead>
                                    <TableHead className="min-w-[200px]">Products</TableHead>
                                    <TableHead className="text-center w-14">Qty</TableHead>
                                    <TableHead className="min-w-[120px]">Status</TableHead>
                                    <TableHead className="text-right w-24">Total</TableHead>
                                    <TableHead className="min-w-[160px]">Actions</TableHead>
                                    <TableHead className="min-w-[120px]">Production</TableHead>
                                    <TableHead className="w-[240px] min-w-[240px]">Shipping</TableHead>
                                </TableRow>
                            </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-8">
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrders?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-8">
                                        No orders found matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders
                                    ?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((order) => {
                                        const hasCoupon = Boolean(
                                            (order.applied_coupons && order.applied_coupons.length > 0) ||
                                            (order.product_discount || 0) > 0 ||
                                            (order.shipping_discount || 0) > 0
                                        );
                                        const couponCode = order.applied_coupons && order.applied_coupons.length > 0 ? order.applied_coupons[0] : null;

                                        return (
                                        <TableRow 
                                            key={order.id} 
                                            className={cn(
                                                selectedOrderIds.includes(order.id) && "bg-muted/30",
                                                hasCoupon && !selectedOrderIds.includes(order.id) && "bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70"
                                            )}
                                        >
                                            <TableCell className="w-10">
                                                <Checkbox
                                                    checked={selectedOrderIds.includes(order.id)}
                                                    onCheckedChange={() => handleToggleSelectOrder(order.id)}
                                                    aria-label={`Select order ${order.id}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <span>#{order.id.slice(0, 8)}</span>
                                                    {isInvoiceOrder(order) && (
                                                        <Badge 
                                                            variant="outline" 
                                                            className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 text-[9px] px-1.5 py-0 font-bold flex items-center gap-1 uppercase"
                                                            title="Custom Manual Order / Invoice"
                                                        >
                                                            <Receipt className="w-2.5 h-2.5 text-purple-600" />
                                                            Invoice
                                                        </Badge>
                                                    )}
                                                    {order.order_items?.some(item => item.is_bulk) && (
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] px-1 py-0 font-bold uppercase">
                                                            Bulk
                                                        </Badge>
                                                    )}
                                                    {hasCoupon && (
                                                        <Badge 
                                                            variant="outline" 
                                                            className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700 text-[9px] px-1.5 py-0 font-bold flex items-center gap-1 uppercase"
                                                            title={order.applied_coupons?.length ? `Cupones aplicables: ${order.applied_coupons.join(", ")}` : 'Descuento aplicado'}
                                                        >
                                                            <Tag className="w-2.5 h-2.5" />
                                                            {couponCode || 'Cupón'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{format(new Date(order.created_at), "MMM d, yyyy h:mm a")}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="font-medium text-sm">
                                                        {order.customer_profile?.full_name || order.shipping_address?.full_name || "Guest Customer"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {order.customer_email || "N/A"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[200px] max-w-[300px]">
                                                {order.order_items && order.order_items.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {order.order_items.map((item, idx) => {
                                                            const specLabel = formatVariantSpecification(item.variant);
                                                            const packStr = (item.variant?.sale_type === 'pack' || (item.variant?.pack_size && item.variant.pack_size > 1))
                                                                ? ` - Pack of ${item.variant.pack_size}`
                                                                : '';

                                                            return (
                                                                <div key={item.id || idx} className="flex flex-col justify-center py-0.5">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="font-medium text-xs text-foreground truncate" title={item.variant?.product?.name || "Product"}>
                                                                            {item.variant?.product?.name || "Unknown Product"}
                                                                        </span>
                                                                        {item.variant?.sku && (
                                                                            <div className="inline-flex items-center gap-0.5">
                                                                                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50 font-medium">
                                                                                    {item.variant.sku}
                                                                                </Badge>
                                                                                <CopyCell value={item.variant.sku} size={11} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {specLabel && (
                                                                        <span className="text-[11px] text-muted-foreground truncate">
                                                                            {specLabel}{packStr}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No products</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {order.order_items && order.order_items.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {order.order_items.map((item, idx) => (
                                                            <div key={item.id || idx} className="flex items-center justify-center py-0.5">
                                                                <Badge variant="outline" className="font-bold text-xs px-2 py-0.5 min-w-[28px] justify-center bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                                                                    {item.quantity}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {(order as any).p2p_status === 'pending_verification' ? (
                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-400 font-bold flex items-center gap-1 text-[10px] px-2 py-0.5 whitespace-nowrap animate-pulse">
                                                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                                                        P2P Pending Verification
                                                    </Badge>
                                                ) : (order as any).p2p_submission_count >= 2 && order.status === 'payment_failed' ? (
                                                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-400 font-bold flex items-center gap-1 text-[10px] px-2 py-0.5 whitespace-nowrap">
                                                        <AlertTriangle className="w-3 h-3 text-red-600" />
                                                        Requires Manual Intervention
                                                    </Badge>
                                                ) : (order as any).p2p_status === 'rejected' ? (
                                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-400 font-bold flex items-center gap-1 text-[10px] px-2 py-0.5 whitespace-nowrap">
                                                        <XCircle className="w-3 h-3 text-orange-600" />
                                                        P2P Rejected (Re-uploading)
                                                    </Badge>
                                                ) : order.payment_method === 'manual_terminal' && order.status === 'pending_payment' ? (
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/40 font-bold flex items-center gap-1 text-[10px] px-2 py-0.5 whitespace-nowrap">
                                                        <Lock className="w-3 h-3 text-amber-600" />
                                                        Pending Manual Charge
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className={getStatusColor(order.status)}>
                                                        {order.status.replace(/_/g, " ")}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-semibold">${order.total_amount.toFixed(2)}</div>
                                                {hasCoupon && (
                                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-end gap-1 mt-0.5" title={order.applied_coupons?.join(", ") || "Descuento aplicado"}>
                                                        <Tag className="w-2.5 h-2.5" />
                                                        <span>{couponCode || 'Cupón'}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {((order as any).p2p_status === 'pending_verification' || (order as any).p2p_proof_url || order.payment_method === 'manual') && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2 text-[11px] font-bold bg-purple-500/10 text-purple-800 border-purple-300 hover:bg-purple-500/20 flex items-center gap-1"
                                                            onClick={() => {
                                                                setSelectedP2POrder(order);
                                                                setIsP2PModalOpen(true);
                                                            }}
                                                            title="Verify P2P Payment Receipt"
                                                        >
                                                            <ShieldCheck className="h-3 w-3 text-purple-600" />
                                                            Verify P2P
                                                        </Button>
                                                    )}
                                                    {(order.payment_method === 'manual_terminal' || (order.status === 'pending_payment' && !(order as any).p2p_status)) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2 text-[11px] font-bold bg-amber-500/10 text-amber-800 border-amber-300 hover:bg-amber-500/20 flex items-center gap-1"
                                                            onClick={() => {
                                                                setSelectedVirtualTerminalOrder(order);
                                                                setIsVirtualTerminalOpen(true);
                                                            }}
                                                            title="Process Card via Virtual Terminal"
                                                        >
                                                            <Lock className="h-3 w-3 text-amber-600" />
                                                            Process Card
                                                        </Button>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handleViewDetails(order)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                                        onClick={() => handleOpenInvoice(order)}
                                                        title="View / Print Invoice (PDF)"
                                                    >
                                                        <Receipt className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                        onClick={() => handleOpenPackingSlip(order)}
                                                        title="Print Packing Slip"
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                    <SendEmailDialog 
                                                        recipientEmail={order.customer_email} 
                                                        recipientName={order.customer_profile?.full_name || order.shipping_address?.full_name || order.customer_email?.split('@')[0]}
                                                        relatedId={order.id}
                                                        trigger={
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Send Email"
                                                                className="h-7 w-7 text-primary"
                                                            >
                                                                <Mail className="h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                    <OrderNotesDialog
                                                        orderId={order.id}
                                                        orderNumber={order.id.slice(0, 8)}
                                                        customerEmail={order.customer_email}
                                                        trigger={
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Order Notes & Log"
                                                                className={cn(
                                                                    "h-7 w-7 relative",
                                                                    (notesCountMap[order.id] || 0) > 0 ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-slate-500 hover:text-slate-700"
                                                                )}
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                                {(notesCountMap[order.id] || 0) > 0 && (
                                                                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                                                                        {notesCountMap[order.id]}
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        }
                                                    />
                                                    <Select
                                                        value={order.status}
                                                        onValueChange={(value) => handleInitiateStatusChange(order.id, value)}
                                                    >
                                                        <SelectTrigger className="w-[130px] h-7 text-xs">
                                                            <SelectValue placeholder="Status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending_payment">Pending Payment</SelectItem>
                                                            <SelectItem value="processing">Processing</SelectItem>
                                                            <SelectItem value="in_production">In Production</SelectItem>
                                                            <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                                                            <SelectItem value="label_created">Label Created</SelectItem>
                                                            <SelectItem value="pickup_scheduled">Pickup Scheduled</SelectItem>
                                                            <SelectItem value="shipped">Shipped</SelectItem>
                                                            <SelectItem value="in_transit">In Transit</SelectItem>
                                                            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                                                            <SelectItem value="delivered">Delivered</SelectItem>
                                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive h-7 w-7 ml-0.5"
                                                        onClick={() => setDeletingOrder(order)}
                                                        title="Delete Order"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {order.status === 'in_production' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-2 gap-1"
                                                        onClick={() => handleStatusChange(order.id, 'ready_to_ship')}
                                                    >
                                                        <Package className="h-3.5 w-3.5" />
                                                        <span>Complete</span>
                                                    </Button>
                                                ) : order.sent_to_production ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px] px-1.5 py-0.5">
                                                        ✓ Sent
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSendToProduction(order)}
                                                        disabled={order.status !== 'processing'}
                                                        className="h-7 text-xs px-2 gap-1"
                                                        title={order.status !== 'processing' ? "Order must be Processing to send to production" : ""}
                                                    >
                                                        <Factory className="h-3.5 w-3.5" />
                                                        <span>Send to Prod</span>
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="w-[240px] min-w-[240px]">
                                                <div className="flex flex-col gap-1">
                                                    {/* Line 1: Logo / Shippo / Carrier service */}
                                                    {getCarrierBadge(order.shipping_carrier, order.shipping_service)}
                                                    
                                                    {/* Line 2: Create Label / Manage shipment button */}
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleCreateShippingLabel(order)}
                                                        disabled={!['ready_to_ship', 'label_created', 'pickup_scheduled', 'shipped'].includes(order.status)}
                                                        variant={['label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "secondary" : "outline"}
                                                        className="h-7 text-xs px-2 w-full justify-center gap-1.5"
                                                        title={!['ready_to_ship', 'label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "Complete production first" : ""}
                                                    >
                                                        <Truck className="h-3.5 w-3.5" />
                                                        <span>{['label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "Manage Shipment" : "Create Label"}</span>
                                                    </Button>

                                                    {/* Line 3: Borderless inline tracking number + copy + refresh */}
                                                    {order.order_shipments && order.order_shipments.filter(s => s.status !== 'cancelled').length > 0 && (
                                                        <div className="flex flex-col gap-0.5 text-xs pt-0.5">
                                                            {order.order_shipments
                                                                .filter(s => s.status !== 'cancelled')
                                                                .map((shipment, idx) => (
                                                                    <div key={idx} className="flex items-center gap-1 text-[11px] px-0.5">
                                                                        <a
                                                                            href={shipment.tracking_url || "#"}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-600 hover:underline font-mono text-[10px] font-medium shrink-0"
                                                                            title={shipment.tracking_number}
                                                                        >
                                                                            {shipment.tracking_number}
                                                                        </a>
                                                                        <CopyCell value={shipment.tracking_number} size={11} />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-4 w-4 p-0 text-slate-400 hover:text-slate-700 shrink-0"
                                                                            onClick={() => handleRefreshTracking(shipment.id, shipment.carrier)}
                                                                            disabled={refreshingTracking === shipment.id}
                                                                            title="Refresh Tracking Status"
                                                                        >
                                                                            <RefreshCw className={cn("h-3 w-3", refreshingTracking === shipment.id && "animate-spin")} />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                {!isLoading && filteredOrders && filteredOrders.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            totalItems={filteredOrders.length}
                            pageSize={itemsPerPage}
                            onPageSizeChange={(size) => {
                                setItemsPerPage(size);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                        <DialogDescription>
                            Order #{selectedOrder?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-2">
                                        Customer Info
                                        <SendEmailDialog 
                                            recipientEmail={selectedOrder.customer_email} 
                                            recipientName={selectedOrder.customer_profile?.full_name || selectedOrder.shipping_address?.full_name || selectedOrder.customer_email?.split('@')[0]}
                                            relatedId={selectedOrder.id}
                                            trigger={
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                    <Mail className="h-3 w-3 text-primary" />
                                                </Button>
                                            }
                                        />
                                    </h4>
                                    <div className="flex flex-col">
                                        <p className="font-medium">{selectedOrder.customer_profile?.full_name || selectedOrder.shipping_address?.full_name || "Guest Customer"}</p>
                                        <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                                    </div>
                                    {selectedOrder.shipping_address && (
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            <p>{selectedOrder.shipping_address.line1}</p>
                                            <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.postal_code}</p>
                                            <p>{selectedOrder.shipping_address.country}</p>
                                            <div className="mt-2">
                                                <EditAddressDialog 
                                                    orderId={selectedOrder.id} 
                                                    currentAddress={selectedOrder.shipping_address} 
                                                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-4">
                                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">Shipping Method</h4>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium">
                                                {selectedOrder.shipping_service || "Standard"}
                                            </p>
                                            {selectedOrder.shipping_carrier && (
                                                <Badge variant="outline" className="text-xs">
                                                    {selectedOrder.shipping_carrier}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Order Status</h4>
                                    <Badge variant="secondary" className={getStatusColor(selectedOrder.status)}>
                                        {selectedOrder.status}
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Date: {format(new Date(selectedOrder.created_at), "PPP p")}
                                    </p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Product</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedOrder.order_items?.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                                                            {item.variant?.product?.image_url || item.variant?.image_url ? (
                                                                <img
                                                                    src={item.variant?.product?.image_url || item.variant?.image_url || ""}
                                                                    alt={item.variant?.product?.name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center bg-gray-100">
                                                                    <Tag className="h-4 w-4 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{item.variant?.product?.name}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                <span>{formatVariantSpecification(item.variant)}</span>
                                                                {item.variant?.sale_type === 'pack' ? ` - Pack of ${item.variant?.pack_size}` : ''}
                                                                {item.is_bulk && (
                                                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                                                        Bulk - {item.with_labels ? 'With Labels' : 'Unlabeled'}
                                                                    </span>
                                                                )}
                                                                {item.with_labels && (item.custom_label_image_url || item.custom_label_instructions) && (
                                                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-900 space-y-1 max-w-md">
                                                                        <div className="font-semibold flex items-center gap-1">
                                                                            🎨 Custom Label details:
                                                                        </div>
                                                                        {item.custom_label_instructions && (
                                                                            <p className="italic">"{item.custom_label_instructions}"</p>
                                                                        )}
                                                                        {item.custom_label_image_url && (
                                                                            <div className="pt-1">
                                                                                <a 
                                                                                    href={item.custom_label_image_url} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                                                                                >
                                                                                    Download Design ↗
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <span>{item.variant?.sku || "N/A"}</span>
                                                        {item.variant?.sku && <CopyCell value={item.variant.sku} size={12} />}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">${item.price_at_time.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${(item.price_at_time * item.quantity).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end">
                                <div className="w-1/3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>${(selectedOrder.total_amount - (selectedOrder.shipping_cost || 0) + (selectedOrder.product_discount || 0) + (selectedOrder.shipping_discount || 0)).toFixed(2)}</span>
                                    </div>
                                    {(selectedOrder.product_discount || 0) > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 font-medium">
                                            <span>Discount {selectedOrder.applied_coupons && `(${selectedOrder.applied_coupons.join(", ")})`}</span>
                                            <span>-${selectedOrder.product_discount?.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Shipping ({selectedOrder.shipping_service || "Standard"})
                                            {selectedOrder.shipping_carrier && ` via ${selectedOrder.shipping_carrier}`}
                                        </span>
                                        <span>${(selectedOrder.shipping_cost || 0).toFixed(2)}</span>
                                    </div>
                                    {(selectedOrder.shipping_discount || 0) > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 font-medium">
                                            <span>Shipping Discount</span>
                                            <span>-${selectedOrder.shipping_discount?.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t pt-4">
                                        <span className="font-bold text-lg">Total</span>
                                        <span className="font-bold text-lg">${selectedOrder.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex justify-between sm:justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (selectedOrder) {
                                        handleOpenInvoice(selectedOrder);
                                    }
                                }}
                                className="gap-2 text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 font-semibold"
                            >
                                <Receipt className="h-4 w-4 text-purple-600" />
                                Invoice (PDF)
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (selectedOrder) {
                                        handleOpenPackingSlip(selectedOrder);
                                    }
                                }}
                                className="gap-2 text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-semibold"
                            >
                                <Printer className="h-4 w-4 text-indigo-600" />
                                Print Packing Slip
                            </Button>
                            {selectedOrder && (
                                <OrderNotesDialog
                                    orderId={selectedOrder.id}
                                    orderNumber={selectedOrder.id.slice(0, 8)}
                                    customerEmail={selectedOrder.customer_email}
                                    trigger={
                                        <Button variant="outline" className="gap-2 text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100">
                                            <FileText className="h-4 w-4" />
                                            <span>Order Notes & Log ({(notesCountMap[selectedOrder.id] || 0)})</span>
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showProductionDialog} onOpenChange={setShowProductionDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Send Order to Production</DialogTitle>
                        <DialogDescription>
                            This will create production batches for order #{selectedOrder?.id.slice(0, 8)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-blue-900">
                                {getVariantGroups(selectedOrder).length} production batch{getVariantGroups(selectedOrder).length > 1 ? 'es' : ''} will be created:
                            </p>
                        </div>

                        <div className="space-y-2">
                            {getVariantGroups(selectedOrder).map((group, index) => (
                                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {(() => {
                                                    const displayImage = group.variant?.image_url || group.variant?.product?.image_url;
                                                    return displayImage ? (
                                                        <img
                                                            src={displayImage}
                                                            alt={group.variant?.product?.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Factory className="h-6 w-6 text-muted-foreground" />
                                                    );
                                                })()}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {group.variant?.product?.name || "Unknown Product"}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatVariantSpecification(group.variant)}
                                                    {group.variant?.pack_size && group.variant.pack_size > 1 ? ` (${group.variant.pack_size}x Pack)` : ''}
                                                    {group.variant?.sale_type === 'pack' ? ' - Pack' : ' - Individual'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary">
                                            Qty: {group.totalQuantity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowProductionDialog(false)}
                            disabled={sendToProductionMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedOrder && sendToProductionMutation.mutate(selectedOrder)}
                            disabled={sendToProductionMutation.isPending}
                        >
                            {sendToProductionMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Production Batches
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete order #{deletingOrder?.id.slice(0, 8)}? This action cannot be undone and will delete all associated data (cart items, batches, etc).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletingOrder && deleteOrderMutation.mutate(deletingOrder.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteOrderMutation.isPending}
                        >
                            {deleteOrderMutation.isPending ? "Deleting..." : "Delete Order"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!pendingStatusChange} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change Order Status?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change the status of order #{pendingStatusChange?.orderId.slice(0, 8)} to <span className="font-semibold uppercase">{pendingStatusChange?.status.replace(/_/g, " ")}</span>? 
                            This action may trigger automated processes such as sending update emails to the customer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingStatusChange) {
                                    handleStatusChange(pendingStatusChange.orderId, pendingStatusChange.status);
                                    setPendingStatusChange(null);
                                }
                            }}
                        >
                            Confirm Change
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <MultiCarrierShippingDialog
                orderId={selectedOrder?.id || ""}
                open={showShippingDialog}
                onOpenChange={setShowShippingDialog}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                }}
            />

            <BulkShippingDialog
                orders={readyToShipOrders}
                open={showBulkShippingDialog}
                onOpenChange={setShowBulkShippingDialog}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                    setSelectedOrderIds([]);
                }}
            />

            {/* Packing Slip Preview & Print Dialog */}
            <PackingSlipDialog
                open={isPackingSlipOpen}
                onOpenChange={setIsPackingSlipOpen}
                orders={packingSlipOrders}
            />

            {/* Create Manual Order / Invoice Dialog */}
            <CreateManualOrderDialog
                open={isCreateOrderOpen}
                onOpenChange={setIsCreateOrderOpen}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                }}
                onOpenShippingLabel={(order) => {
                    handleCreateShippingLabel(order);
                }}
                onOpenPackingSlip={(order) => {
                    handleOpenPackingSlip(order);
                }}
                onOpenInvoice={(order) => {
                    handleOpenInvoice(order);
                }}
            />

            {/* Commercial Invoice Preview & Print Dialog */}
            <InvoiceDialog
                open={isInvoiceOpen}
                onOpenChange={setIsInvoiceOpen}
                order={invoiceOrder}
            />
        </div>

        {/* Modals */}
        {selectedVirtualTerminalOrder && (
            <VirtualTerminalModal
                open={isVirtualTerminalOpen}
                onOpenChange={setIsVirtualTerminalOpen}
                order={selectedVirtualTerminalOrder}
                onOrderUpdated={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            />
        )}

        {selectedP2POrder && (
            <P2PVerificationModal
                open={isP2PModalOpen}
                onOpenChange={setIsP2PModalOpen}
                order={selectedP2POrder}
                onOrderUpdated={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            />
        )}

        {selectedUploadProofOrder && (
            <UploadPaymentProofDialog
                open={isUploadProofModalOpen}
                onOpenChange={setIsUploadProofModalOpen}
                orderId={selectedUploadProofOrder.id}
                orderNumber={selectedUploadProofOrder.id.slice(0, 8).toUpperCase()}
                totalAmount={selectedUploadProofOrder.total_amount}
                p2pProvider={(selectedUploadProofOrder as any).p2p_provider || "zelle"}
                onProofUploaded={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            />
        )}
        </>
    );
};

export default OrderManagement;
