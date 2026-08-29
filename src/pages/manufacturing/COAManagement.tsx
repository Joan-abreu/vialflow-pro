import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Upload, Calendar, Search, Check, Layers, X } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface Product {
    id: string;
    name: string;
}

interface COA {
    id: string;
    product_id: string | null;
    product_ids?: string[] | null;
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: number | null;
    ph_level: number | null;
    benzyl_alcohol_pct: number | null;
    sterility_status: string;
    is_active: boolean;
    lab_name?: string | null;
    is_featured?: boolean;
    products?: Product | null;
}

// Multi-Product Selector Component with Search, Pills, and Checkboxes
const MultiProductSelect = ({
    products,
    selectedProductIds,
    onChange,
}: {
    products: Product[];
    selectedProductIds: string[];
    onChange: (ids: string[]) => void;
}) => {
    const [search, setSearch] = useState("");

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (id: string) => {
        if (selectedProductIds.includes(id)) {
            onChange(selectedProductIds.filter((i) => i !== id));
        } else {
            onChange([...selectedProductIds, id]);
        }
    };

    const handleSelectAll = () => {
        onChange(products.map((p) => p.id));
    };

    const handleClear = () => {
        onChange([]);
    };

    return (
        <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                    Product Associations ({selectedProductIds.length} selected)
                </span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[11px] font-medium text-primary hover:underline"
                    >
                        Select All
                    </button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Selected Pills */}
            {selectedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-background rounded-lg border">
                    {selectedProductIds.map((id) => {
                        const prod = products.find((p) => p.id === id);
                        if (!prod) return null;
                        return (
                            <span
                                key={id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-medium border border-emerald-300/60 max-w-full"
                            >
                                <span className="truncate max-w-[140px] sm:max-w-[200px]">{prod.name}</span>
                                <button
                                    type="button"
                                    onClick={() => toggle(id)}
                                    className="text-emerald-700 hover:text-emerald-950 dark:hover:text-white font-bold ml-0.5 p-0.5"
                                    title="Remove"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search products (e.g. 10ml, Bac Water, 2-Pack)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs bg-background pl-8"
                />
            </div>

            {/* Checkbox List */}
            <div className="max-h-36 sm:max-h-44 overflow-y-auto space-y-1 pr-1 divide-y divide-border/40">
                {filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">No matching products found.</p>
                ) : (
                    filtered.map((p) => {
                        const isSelected = selectedProductIds.includes(p.id);
                        return (
                            <label
                                key={p.id}
                                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                                    isSelected
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 font-semibold text-emerald-950 dark:text-emerald-200"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggle(p.id)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                                />
                                <span className="truncate flex-1">{p.name}</span>
                                {isSelected && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const COAManagement = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCoa, setSelectedCoa] = useState<COA | null>(null);

    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // Form states
    const [formData, setFormData] = useState({
        product_ids: [] as string[],
        batch_number: "",
        test_date: "",
        pdf_url: "",
        purity_pct: "",
        ph_level: "",
        benzyl_alcohol_pct: "",
        sterility_status: "Pass",
        is_active: true,
        lab_name: "Chromak Research Analytical Lab",
        is_featured: false,
    });

    const [uploading, setUploading] = useState(false);

    // Fetch Products (to populate multi-select and map names)
    const { data: products } = useQuery<Product[]>({
        queryKey: ["admin-products-list"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select("id, name")
                .order("name");
            if (error) throw error;
            return data || [];
        },
    });

    // Create a fast ID -> Product map
    const productsMap = React.useMemo(() => {
        const map = new Map<string, Product>();
        products?.forEach((p) => map.set(p.id, p));
        return map;
    }, [products]);

    // Fetch COAs
    const { data: coas, isLoading } = useQuery<COA[]>({
        queryKey: ["admin-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_coas" as any)
                .select(`
                    *,
                    products:products(id, name)
                `)
                .order("test_date", { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    // File Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Please upload a PDF file only.");
            return;
        }

        setUploading(true);
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const bucket = "coas";

        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, {
                    upsert: false,
                    cacheControl: "31536000",
                });

            if (error) {
                toast.error(`Upload failed: ${error.message}`);
                return;
            }

            const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
            const url = publicData?.publicUrl || "";
            setFormData((prev) => ({ ...prev, pdf_url: url }));
            toast.success("PDF uploaded successfully.");
        } catch (err: any) {
            toast.error(`Error uploading file: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    // Add Mutation
    const addMutation = useMutation({
        mutationFn: async (newData: any) => {
            const pIds = Array.isArray(newData.product_ids) ? newData.product_ids : [];
            const payload = {
                product_ids: pIds,
                product_id: pIds.length > 0 ? pIds[0] : null,
                batch_number: newData.batch_number.trim(),
                test_date: newData.test_date,
                pdf_url: newData.pdf_url,
                purity_pct: newData.purity_pct ? parseFloat(newData.purity_pct) : null,
                ph_level: newData.ph_level ? parseFloat(newData.ph_level) : null,
                benzyl_alcohol_pct: newData.benzyl_alcohol_pct ? parseFloat(newData.benzyl_alcohol_pct) : null,
                sterility_status: newData.sterility_status,
                is_active: newData.is_active,
                lab_name: newData.lab_name?.trim() || "Chromak Research Analytical Lab",
                is_featured: !!newData.is_featured,
            };

            const { error } = await supabase.from("product_coas" as any).insert(payload);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
            queryClient.invalidateQueries({ queryKey: ["product-coas"] });
            toast.success("COA added successfully.");
            setIsAddOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(`Failed to add COA: ${error.message}`);
        },
    });

    // Edit Mutation
    const editMutation = useMutation({
        mutationFn: async (updatedData: any) => {
            const pIds = Array.isArray(updatedData.product_ids) ? updatedData.product_ids : [];
            const payload = {
                product_ids: pIds,
                product_id: pIds.length > 0 ? pIds[0] : null,
                batch_number: updatedData.batch_number.trim(),
                test_date: updatedData.test_date,
                pdf_url: updatedData.pdf_url,
                purity_pct: updatedData.purity_pct ? parseFloat(updatedData.purity_pct) : null,
                ph_level: updatedData.ph_level ? parseFloat(updatedData.ph_level) : null,
                benzyl_alcohol_pct: updatedData.benzyl_alcohol_pct ? parseFloat(updatedData.benzyl_alcohol_pct) : null,
                sterility_status: updatedData.sterility_status,
                is_active: updatedData.is_active,
                lab_name: updatedData.lab_name?.trim() || "Chromak Research Analytical Lab",
                is_featured: !!updatedData.is_featured,
            };

            const { error } = await supabase
                .from("product_coas" as any)
                .update(payload)
                .eq("id", selectedCoa?.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
            queryClient.invalidateQueries({ queryKey: ["product-coas"] });
            toast.success("COA updated successfully.");
            setIsEditOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(`Failed to update COA: ${error.message}`);
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (coa: COA) => {
            try {
                if (coa.pdf_url) {
                    const urlParts = coa.pdf_url.split("/");
                    const fileName = urlParts[urlParts.length - 1];
                    if (fileName) {
                        await supabase.storage.from("coas").remove([fileName]);
                    }
                }
            } catch (err) {
                console.error("Failed to delete storage file:", err);
            }

            const { error } = await supabase.from("product_coas" as any).delete().eq("id", coa.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
            queryClient.invalidateQueries({ queryKey: ["product-coas"] });
            toast.success("COA deleted successfully.");
            setIsDeleteOpen(false);
        },
        onError: (error: any) => {
            toast.error(`Failed to delete COA: ${error.message}`);
        },
    });

    const resetForm = () => {
        setFormData({
            product_ids: [],
            batch_number: "",
            test_date: "",
            pdf_url: "",
            purity_pct: "",
            ph_level: "",
            benzyl_alcohol_pct: "",
            sterility_status: "Pass",
            is_active: true,
            lab_name: "Chromak Research Analytical Lab",
            is_featured: false,
        });
        setSelectedCoa(null);
    };

    const handleEditClick = (coa: COA) => {
        setSelectedCoa(coa);
        
        // Extract product IDs from product_ids array or fallback to single product_id
        let initialProductIds: string[] = [];
        if (Array.isArray(coa.product_ids) && coa.product_ids.length > 0) {
            initialProductIds = coa.product_ids;
        } else if (coa.product_id) {
            initialProductIds = [coa.product_id];
        }

        setFormData({
            product_ids: initialProductIds,
            batch_number: coa.batch_number,
            test_date: coa.test_date,
            pdf_url: coa.pdf_url,
            purity_pct: coa.purity_pct?.toString() || "",
            ph_level: coa.ph_level?.toString() || "",
            benzyl_alcohol_pct: coa.benzyl_alcohol_pct?.toString() || "",
            sterility_status: coa.sterility_status,
            is_active: coa.is_active,
            lab_name: coa.lab_name || "Chromak Research Analytical Lab",
            is_featured: !!coa.is_featured,
        });
        setIsEditOpen(true);
    };

    const handleDeleteClick = (coa: COA) => {
        setSelectedCoa(coa);
        setIsDeleteOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.batch_number || !formData.test_date || !formData.pdf_url) {
            toast.error("Please fill in Batch Number, Test Date, and upload a COA PDF.");
            return;
        }

        if (selectedCoa) {
            editMutation.mutate(formData);
        } else {
            addMutation.mutate(formData);
        }
    };

    const filteredCoas = coas?.filter((coa) => {
        // Collect all product names associated with this COA
        const linkedProductNames = (coa.product_ids && coa.product_ids.length > 0)
            ? coa.product_ids.map(id => productsMap.get(id)?.name || "").join(" ")
            : coa.products?.name || "";

        const matchesSearch =
            coa.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            linkedProductNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (coa.lab_name && coa.lab_name.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesSearch;
    });

    // Pagination Calculations
    const totalItems = filteredCoas?.length || 0;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedCoas = filteredCoas?.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">COA & Lab Reports</h1>
                    <p className="text-sm text-muted-foreground">Manage Certificate of Analysis documents and link them to single or multiple products.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2 w-full sm:w-auto">
                            <Plus className="h-4 w-4" /> Add COA Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border bg-background shadow-2xl">
                        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b bg-muted/20 shrink-0">
                            <DialogTitle className="text-lg sm:text-xl font-bold">Add New COA Report</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                                Upload a PDF and select all products (single, 2-packs, bundles) that share this lot code.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {/* Multi-Product Selector */}
                            <div className="space-y-2">
                                <MultiProductSelect
                                    products={products || []}
                                    selectedProductIds={formData.product_ids}
                                    onChange={(ids) => setFormData((prev) => ({ ...prev, product_ids: ids }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="batch" className="text-xs font-semibold">Batch / Lot Number *</Label>
                                    <Input
                                        id="batch"
                                        placeholder="e.g. DW10M033026"
                                        value={formData.batch_number}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, batch_number: e.target.value }))}
                                        required
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="date" className="text-xs font-semibold">Analysis Date *</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={formData.test_date}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, test_date: e.target.value }))}
                                        required
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="purity" className="text-xs font-semibold">Purity (%)</Label>
                                    <Input
                                        id="purity"
                                        type="number"
                                        step="0.01"
                                        placeholder="99.9"
                                        value={formData.purity_pct}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ph" className="text-xs font-semibold">pH Level</Label>
                                    <Input
                                        id="ph"
                                        type="number"
                                        step="0.01"
                                        placeholder="5.8"
                                        value={formData.ph_level}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, ph_level: e.target.value }))}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ba" className="text-xs font-semibold">Benzyl Alcohol (%)</Label>
                                    <Input
                                        id="ba"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.9"
                                        value={formData.benzyl_alcohol_pct}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, benzyl_alcohol_pct: e.target.value }))}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sterility" className="text-xs font-semibold">Sterility Status</Label>
                                    <Select
                                        value={formData.sterility_status}
                                        onValueChange={(val) => setFormData((prev) => ({ ...prev, sterility_status: val }))}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select sterility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pass">Pass</SelectItem>
                                            <SelectItem value="Fail">Fail</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="active" className="text-xs font-semibold">Visibility</Label>
                                    <Select
                                        value={formData.is_active ? "true" : "false"}
                                        onValueChange={(val) => setFormData((prev) => ({ ...prev, is_active: val === "true" }))}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Active (Visible)</SelectItem>
                                            <SelectItem value="false">Inactive (Hidden)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="lab" className="text-xs font-semibold">Testing Laboratory</Label>
                                    <Input
                                        id="lab"
                                        placeholder="Chromak Research Analytical Lab"
                                        value={formData.lab_name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, lab_name: e.target.value }))}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="featured" className="text-xs font-semibold">Product Page Feature</Label>
                                    <Select
                                        value={formData.is_featured ? "true" : "false"}
                                        onValueChange={(val) => setFormData((prev) => ({ ...prev, is_featured: val === "true" }))}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">★ Current Active Batch</SelectItem>
                                            <SelectItem value="false">Standard Historical Batch</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2 pt-1">
                                <Label htmlFor="pdf" className="text-xs font-semibold">COA PDF File *</Label>
                                {formData.pdf_url ? (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg border">
                                        <div className="flex items-center gap-2.5 truncate">
                                            <FileText className="h-5 w-5 text-primary shrink-0" />
                                            <span className="text-xs sm:text-sm truncate font-medium">COA PDF File Uploaded</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <a
                                                href={formData.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary hover:underline font-semibold"
                                            >
                                                Preview
                                            </a>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="h-7 text-xs px-2.5"
                                                onClick={() => setFormData((prev) => ({ ...prev, pdf_url: "" }))}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-5 sm:p-6 bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <label className="flex flex-col items-center gap-2 cursor-pointer text-center">
                                            <Upload className="h-7 w-7 text-muted-foreground" />
                                            <span className="text-xs sm:text-sm font-semibold text-primary">Click to upload COA PDF</span>
                                            <span className="text-[11px] text-muted-foreground">PDF files up to 15MB</span>
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                disabled={uploading}
                                            />
                                            {uploading && <span className="text-xs text-primary font-medium animate-pulse">Uploading file to storage...</span>}
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 sm:p-5 border-t bg-background flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6">
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto h-9 text-xs">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={addMutation.isPending || uploading} className="w-full sm:w-auto h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {addMutation.isPending ? "Adding..." : "Add COA"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Search */}
            <div className="flex items-center gap-2 w-full max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by batch, product, or lab..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                        className="pl-9 h-10 text-sm"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Batch Number</TableHead>
                            <TableHead>Linked Products</TableHead>
                            <TableHead>Lab & Date</TableHead>
                            <TableHead>Specs Summary</TableHead>
                            <TableHead>Status & Feature</TableHead>
                            <TableHead>PDF</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                    Loading COAs...
                                </TableCell>
                            </TableRow>
                        ) : paginatedCoas.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                    No COAs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedCoas.map((coa) => {
                                // Gather all associated product names
                                const linkedIds = (coa.product_ids && coa.product_ids.length > 0)
                                    ? coa.product_ids
                                    : (coa.product_id ? [coa.product_id] : []);

                                const linkedNames = linkedIds
                                    .map(id => productsMap.get(id)?.name || (coa.products?.id === id ? coa.products.name : null))
                                    .filter(Boolean) as string[];

                                return (
                                    <TableRow key={coa.id}>
                                        <TableCell>
                                            <div className="font-bold font-mono">{coa.batch_number}</div>
                                            {coa.is_featured && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    ★ Active Lot
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="min-w-[200px] max-w-[320px]">
                                            {linkedNames.length === 0 ? (
                                                <span className="text-muted-foreground italic text-xs">None (General)</span>
                                            ) : (
                                                <div className="flex flex-col gap-1.5">
                                                    {linkedNames.map((name, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 leading-snug break-words"
                                                        >
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5 text-xs">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(coa.test_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                                                </div>
                                                <div className="text-[11px] font-medium text-foreground truncate max-w-[150px]">
                                                    {coa.lab_name || "Chromak Research"}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-0.5">
                                                {coa.purity_pct !== null && <div>Purity: <strong className="text-foreground">{coa.purity_pct}%</strong></div>}
                                                {coa.ph_level !== null && <div>pH: <strong className="text-foreground">{coa.ph_level}</strong></div>}
                                                {coa.benzyl_alcohol_pct !== null && <div>BA: <strong className="text-foreground">{coa.benzyl_alcohol_pct}%</strong></div>}
                                                {coa.sterility_status && <div>Sterility: <strong className="text-emerald-600 font-semibold">{coa.sterility_status}</strong></div>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {coa.is_active ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <a href={coa.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline gap-1 text-sm font-semibold">
                                                <FileText className="h-4 w-4" /> View PDF
                                            </a>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(coa)}>
                                                    <Pencil className="h-4 w-4 text-slate-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(coa)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
                
                {totalItems > 0 && (
                    <DataTablePagination
                        pageIndex={pageIndex}
                        pageSize={pageSize}
                        totalItems={totalItems}
                        onPageChange={setPageIndex}
                        onPageSizeChange={(size) => { setPageSize(size); setPageIndex(0); }}
                    />
                )}
            </div>

            {/* Edit Dialog (Fully Responsive) */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border bg-background shadow-2xl">
                    <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b bg-muted/20 shrink-0">
                        <DialogTitle className="text-lg sm:text-xl font-bold">Edit COA Report</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Update specifications or modify the products associated with this batch.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {/* Multi-Product Selector */}
                        <div className="space-y-2">
                            <MultiProductSelect
                                products={products || []}
                                selectedProductIds={formData.product_ids}
                                onChange={(ids) => setFormData((prev) => ({ ...prev, product_ids: ids }))}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-batch" className="text-xs font-semibold">Batch / Lot Number *</Label>
                                <Input
                                    id="edit-batch"
                                    value={formData.batch_number}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, batch_number: e.target.value }))}
                                    required
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-date" className="text-xs font-semibold">Analysis Date *</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={formData.test_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, test_date: e.target.value }))}
                                    required
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-purity" className="text-xs font-semibold">Purity (%)</Label>
                                <Input
                                    id="edit-purity"
                                    type="number"
                                    step="0.01"
                                    value={formData.purity_pct}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-ph" className="text-xs font-semibold">pH Level</Label>
                                <Input
                                    id="edit-ph"
                                    type="number"
                                    step="0.01"
                                    value={formData.ph_level}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, ph_level: e.target.value }))}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-ba" className="text-xs font-semibold">Benzyl Alcohol (%)</Label>
                                <Input
                                    id="edit-ba"
                                    type="number"
                                    step="0.01"
                                    value={formData.benzyl_alcohol_pct}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, benzyl_alcohol_pct: e.target.value }))}
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-sterility" className="text-xs font-semibold">Sterility Status</Label>
                                <Select
                                    value={formData.sterility_status}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, sterility_status: val }))}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select sterility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pass">Pass</SelectItem>
                                        <SelectItem value="Fail">Fail</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-active" className="text-xs font-semibold">Visibility</Label>
                                <Select
                                    value={formData.is_active ? "true" : "false"}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, is_active: val === "true" }))}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Active (Visible)</SelectItem>
                                        <SelectItem value="false">Inactive (Hidden)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-lab" className="text-xs font-semibold">Testing Laboratory</Label>
                                <Input
                                    id="edit-lab"
                                    placeholder="Chromak Research Analytical Lab"
                                    value={formData.lab_name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, lab_name: e.target.value }))}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-featured" className="text-xs font-semibold">Product Page Feature</Label>
                                <Select
                                    value={formData.is_featured ? "true" : "false"}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, is_featured: val === "true" }))}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">★ Current Active Batch</SelectItem>
                                        <SelectItem value="false">Standard Historical Batch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2 pt-1">
                            <Label htmlFor="edit-pdf" className="text-xs font-semibold">COA PDF File *</Label>
                            {formData.pdf_url ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg border">
                                    <div className="flex items-center gap-2.5 truncate">
                                        <FileText className="h-5 w-5 text-primary shrink-0" />
                                        <span className="text-xs sm:text-sm truncate font-medium">COA PDF File Uploaded</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <a
                                            href={formData.pdf_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline font-semibold"
                                        >
                                            Preview
                                        </a>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-7 text-xs px-2.5"
                                            onClick={() => setFormData((prev) => ({ ...prev, pdf_url: "" }))}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-5 sm:p-6 bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <label className="flex flex-col items-center gap-2 cursor-pointer text-center">
                                        <Upload className="h-7 w-7 text-muted-foreground" />
                                        <span className="text-xs sm:text-sm font-semibold text-primary">Click to upload COA PDF</span>
                                        <span className="text-[11px] text-muted-foreground">PDF files up to 15MB</span>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                        {uploading && <span className="text-xs text-primary font-medium animate-pulse">Uploading file to storage...</span>}
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="p-4 sm:p-5 border-t bg-background flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="w-full sm:w-auto h-9 text-xs">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editMutation.isPending || uploading} className="w-full sm:w-auto h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                {editMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Alert Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base sm:text-lg font-bold">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs sm:text-sm">
                            This will permanently delete the COA report for batch **{selectedCoa?.batch_number}** and remove the associated PDF file from storage. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <AlertDialogCancel onClick={() => setSelectedCoa(null)} className="h-9 text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (selectedCoa) deleteMutation.mutate(selectedCoa); }}
                            className="bg-destructive hover:bg-destructive/90 text-white h-9 text-xs font-bold"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete COA"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default COAManagement;
