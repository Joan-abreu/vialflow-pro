import React, { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Plus,
    Pencil,
    Trash2,
    FileText,
    Upload,
    Calendar,
    Search,
    Check,
    Layers,
    X,
    FlaskConical,
    ExternalLink,
    Award,
    ShieldCheck,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import ProductVariantMultiSelect, { ProductWithVariants } from "@/components/admin/ProductVariantMultiSelect";
import { COA, PeptideComponent } from "@/types/coa";

interface FormDataState {
    product_ids: string[];
    variant_ids: string[];
    coa_type: "peptide" | "water";
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: string;
    // Peptide
    target_dosage_mg: string;
    measured_dosage_mg: string;
    task_number: string;
    verification_key: string;
    verification_url: string;
    sequence_status: string;
    appearance: string;
    components: PeptideComponent[];
    // Water
    ph_level: string;
    benzyl_alcohol_pct: string;
    sterility_status: string;
    // Meta
    is_active: boolean;
    lab_name: string;
    is_featured: boolean;
}

const defaultFormData: FormDataState = {
    product_ids: [],
    variant_ids: [],
    coa_type: "peptide",
    batch_number: "",
    test_date: new Date().toISOString().split("T")[0],
    pdf_url: "",
    purity_pct: "",
    target_dosage_mg: "",
    measured_dosage_mg: "",
    task_number: "",
    verification_key: "",
    verification_url: "https://www.janoshik.com/verify/",
    sequence_status: "Confirmed",
    appearance: "White Lyophilized Powder",
    components: [],
    ph_level: "",
    benzyl_alcohol_pct: "",
    sterility_status: "Pass",
    is_active: true,
    lab_name: "Janoshik Analytical",
    is_featured: false,
};

const COAManagement = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCoa, setSelectedCoa] = useState<COA | null>(null);

    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // Form state
    const [formData, setFormData] = useState<FormDataState>(defaultFormData);
    const [uploading, setUploading] = useState(false);
    const [newCompName, setNewCompName] = useState("");
    const [newCompAmount, setNewCompAmount] = useState("");

    // Fetch Products with their Variants
    const { data: products = [] } = useQuery<ProductWithVariants[]>({
        queryKey: ["admin-products-with-variants"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select(`
                    id,
                    name,
                    slug,
                    product_variants (
                        id,
                        sku,
                        price,
                        pack_size,
                        vial_type:vial_types(name, capacity_ml)
                    )
                `)
                .order("name");
            if (error) throw error;
            return (data || []) as any[];
        },
    });

    // Fast mapping to resolve product and variant names
    const { productsMap, variantsMap } = useMemo(() => {
        const pMap = new Map<string, ProductWithVariants>();
        const vMap = new Map<string, { variantName: string; productName: string; sku?: string }>();

        products.forEach((p) => {
            pMap.set(p.id, p);
            p.product_variants?.forEach((v) => {
                const rawName = v.vial_type?.name || (v.sku ? `SKU: ${v.sku}` : `Variant`);
                const label = rawName.replace(/\s+(Tall|Short)\s+Vial/gi, "").replace(/\s+Vial/gi, "").trim();
                vMap.set(v.id, {
                    variantName: label,
                    productName: p.name,
                    sku: v.sku || undefined,
                });
            });
        });

        return { productsMap: pMap, variantsMap: vMap };
    }, [products]);

    // Fetch COAs
    const { data: coas = [], isLoading } = useQuery<COA[]>({
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
            return (data || []) as COA[];
        },
    });

    const resetForm = () => {
        setFormData(defaultFormData);
        setNewCompName("");
        setNewCompAmount("");
    };

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
        const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
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

    // Build common payload for insert / update
    const buildPayload = (data: FormDataState) => {
        const pIds = Array.isArray(data.product_ids) ? data.product_ids : [];
        const vIds = Array.isArray(data.variant_ids) ? data.variant_ids : [];

        return {
            product_ids: pIds,
            product_id: pIds.length > 0 ? pIds[0] : null,
            variant_ids: vIds,
            coa_type: data.coa_type || "peptide",
            batch_number: data.batch_number.trim(),
            test_date: data.test_date,
            pdf_url: data.pdf_url,
            purity_pct: data.purity_pct !== "" && data.purity_pct !== null ? parseFloat(data.purity_pct) : null,
            // Peptide Fields
            target_dosage_mg: data.target_dosage_mg !== "" && data.target_dosage_mg !== null ? parseFloat(data.target_dosage_mg) : null,
            measured_dosage_mg: data.measured_dosage_mg !== "" && data.measured_dosage_mg !== null ? parseFloat(data.measured_dosage_mg) : null,
            task_number: data.task_number?.trim() || null,
            verification_key: data.verification_key?.trim() || null,
            verification_url: data.verification_url?.trim() || null,
            sequence_status: data.sequence_status || "Confirmed",
            appearance: data.appearance?.trim() || "White Lyophilized Powder",
            components: Array.isArray(data.components) ? data.components : [],
            // Water Fields
            ph_level: data.ph_level !== "" && data.ph_level !== null ? parseFloat(data.ph_level) : null,
            benzyl_alcohol_pct: data.benzyl_alcohol_pct !== "" && data.benzyl_alcohol_pct !== null ? parseFloat(data.benzyl_alcohol_pct) : null,
            sterility_status: data.sterility_status || "Pass",
            // Meta
            is_active: data.is_active,
            lab_name: data.lab_name?.trim() || (data.coa_type === "peptide" ? "Janoshik Analytical" : "Chromak Research Analytical Lab"),
            is_featured: !!data.is_featured,
        };
    };

    // Add Mutation
    const addMutation = useMutation({
        mutationFn: async (newData: FormDataState) => {
            const payload = buildPayload(newData);
            const { error } = await supabase.from("product_coas" as any).insert(payload);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
            queryClient.invalidateQueries({ queryKey: ["public-coas"] });
            queryClient.invalidateQueries({ queryKey: ["product-coas"] });
            toast.success("Certificate of Analysis added successfully.");
            setIsAddOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(`Failed to add COA: ${error.message}`);
        },
    });

    // Edit Mutation
    const editMutation = useMutation({
        mutationFn: async (updatedData: FormDataState) => {
            if (!selectedCoa) return;
            const payload = buildPayload(updatedData);
            const { error } = await supabase
                .from("product_coas" as any)
                .update(payload)
                .eq("id", selectedCoa.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
            queryClient.invalidateQueries({ queryKey: ["public-coas"] });
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
            queryClient.invalidateQueries({ queryKey: ["public-coas"] });
            queryClient.invalidateQueries({ queryKey: ["product-coas"] });
            toast.success("COA deleted successfully.");
            setIsDeleteOpen(false);
            setSelectedCoa(null);
        },
        onError: (error: any) => {
            toast.error(`Failed to delete COA: ${error.message}`);
        },
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.batch_number.trim()) {
            toast.error("Batch Number is required.");
            return;
        }
        if (!formData.test_date) {
            toast.error("Analysis Date is required.");
            return;
        }
        if (!formData.pdf_url) {
            toast.error("Please upload a COA PDF file.");
            return;
        }

        if (isEditOpen) {
            editMutation.mutate(formData);
        } else {
            addMutation.mutate(formData);
        }
    };

    const handleEditClick = (coa: COA) => {
        setSelectedCoa(coa);
        setFormData({
            product_ids: coa.product_ids || (coa.product_id ? [coa.product_id] : []),
            variant_ids: coa.variant_ids || [],
            coa_type: (coa.coa_type as any) || (coa.benzyl_alcohol_pct ? "water" : "peptide"),
            batch_number: coa.batch_number || "",
            test_date: coa.test_date || "",
            pdf_url: coa.pdf_url || "",
            purity_pct: coa.purity_pct !== null && coa.purity_pct !== undefined ? coa.purity_pct.toString() : "",
            target_dosage_mg: coa.target_dosage_mg !== null && coa.target_dosage_mg !== undefined ? coa.target_dosage_mg.toString() : "",
            measured_dosage_mg: coa.measured_dosage_mg !== null && coa.measured_dosage_mg !== undefined ? coa.measured_dosage_mg.toString() : "",
            task_number: coa.task_number || "",
            verification_key: coa.verification_key || "",
            verification_url: coa.verification_url || "https://www.janoshik.com/verify/",
            sequence_status: coa.sequence_status || "Confirmed",
            appearance: coa.appearance || "White Lyophilized Powder",
            components: coa.components || [],
            ph_level: coa.ph_level !== null && coa.ph_level !== undefined ? coa.ph_level.toString() : "",
            benzyl_alcohol_pct: coa.benzyl_alcohol_pct !== null && coa.benzyl_alcohol_pct !== undefined ? coa.benzyl_alcohol_pct.toString() : "",
            sterility_status: coa.sterility_status || "Pass",
            is_active: coa.is_active ?? true,
            lab_name: coa.lab_name || "Janoshik Analytical",
            is_featured: !!coa.is_featured,
        });
        setIsEditOpen(true);
    };

    const handleDeleteClick = (coa: COA) => {
        setSelectedCoa(coa);
        setIsDeleteOpen(true);
    };

    // Add component to blend
    const handleAddComponent = () => {
        if (!newCompName.trim()) return;
        const amount = parseFloat(newCompAmount) || 0;
        setFormData((prev) => ({
            ...prev,
            components: [...prev.components, { name: newCompName.trim(), amount_mg: amount }],
        }));
        setNewCompName("");
        setNewCompAmount("");
    };

    const handleRemoveComponent = (idx: number) => {
        setFormData((prev) => ({
            ...prev,
            components: prev.components.filter((_, i) => i !== idx),
        }));
    };

    // Filter COAs
    const filteredCoas = useMemo(() => {
        return coas.filter((coa) => {
            const matchesType =
                typeFilter === "all" ||
                (typeFilter === "peptide" && coa.coa_type === "peptide") ||
                (typeFilter === "water" && coa.coa_type === "water");

            const q = searchQuery.toLowerCase().trim();
            if (!q) return matchesType;

            const batchMatch = coa.batch_number.toLowerCase().includes(q);
            const labMatch = coa.lab_name?.toLowerCase().includes(q);
            const keyMatch = coa.verification_key?.toLowerCase().includes(q);
            const taskMatch = coa.task_number?.toLowerCase().includes(q);

            const linkedIds = coa.product_ids || (coa.product_id ? [coa.product_id] : []);
            const productMatch = linkedIds.some((id) =>
                productsMap.get(id)?.name.toLowerCase().includes(q)
            );

            const variantMatch = (coa.variant_ids || []).some((vId) =>
                variantsMap.get(vId)?.variantName.toLowerCase().includes(q)
            );

            return matchesType && (batchMatch || labMatch || keyMatch || taskMatch || productMatch || variantMatch);
        });
    }, [coas, typeFilter, searchQuery, productsMap, variantsMap]);

    // Pagination
    const totalItems = filteredCoas.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedCoas = useMemo(() => {
        const start = pageIndex * pageSize;
        return filteredCoas.slice(start, start + pageSize);
    }, [filteredCoas, pageIndex, pageSize]);

    // Dosage difference calculation
    const dosageAccuracy = useMemo(() => {
        const target = parseFloat(formData.target_dosage_mg);
        const measured = parseFloat(formData.measured_dosage_mg);
        if (!target || !measured || target <= 0) return null;
        const diff = ((measured - target) / target) * 100;
        return {
            diff,
            diffFormatted: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
            potencyRatio: (measured / target) * 100,
        };
    }, [formData.target_dosage_mg, formData.measured_dosage_mg]);

    // Reusable Form Component for Add & Edit
    const renderFormFields = () => (
        <div className="space-y-4">
            {/* Product & Variant Hierarchical Selector */}
            <ProductVariantMultiSelect
                products={products}
                selectedProductIds={formData.product_ids}
                selectedVariantIds={formData.variant_ids}
                onChange={(pIds, vIds) =>
                    setFormData((prev) => ({ ...prev, product_ids: pIds, variant_ids: vIds }))
                }
            />

            {/* COA Type Switcher */}
            <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-foreground">Analytical Protocol Type</Label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            setFormData((prev) => ({
                                ...prev,
                                coa_type: "peptide",
                                lab_name: prev.lab_name === "Chromak Research Analytical Lab" ? "Janoshik Analytical" : prev.lab_name,
                            }))
                        }
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                            formData.coa_type === "peptide"
                                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs"
                                : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                    >
                        <FlaskConical className="h-4 w-4 text-emerald-600" />
                        <span>🔬 Peptide / API (Janoshik HPLC)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setFormData((prev) => ({
                                ...prev,
                                coa_type: "water",
                                lab_name: prev.lab_name === "Janoshik Analytical" ? "Chromak Research Analytical Lab" : prev.lab_name,
                            }))
                        }
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                            formData.coa_type === "water"
                                ? "border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs"
                                : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>💧 Bacteriostatic Water / Solvent</span>
                    </button>
                </div>
            </div>

            {/* Batch Number & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="batch" className="text-xs font-semibold">Batch / Lot Number *</Label>
                    <Input
                        id="batch"
                        placeholder={formData.coa_type === "peptide" ? "e.g. RT20/2026-04-15" : "e.g. DW10M033026"}
                        value={formData.batch_number}
                        onChange={(e) => setFormData((prev) => ({ ...prev, batch_number: e.target.value }))}
                        required
                        className="h-9 text-sm font-mono"
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

            {/* PEPTIDE SPECIFIC FIELDS */}
            {formData.coa_type === "peptide" && (
                <div className="space-y-3.5 p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                            Janoshik Peptide Analytical Specifications
                        </span>
                        {dosageAccuracy && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                Potency: {dosageAccuracy.diffFormatted} ({dosageAccuracy.potencyRatio.toFixed(1)}%)
                            </Badge>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="target_mg" className="text-xs font-semibold">Nominal Dosage (mg)</Label>
                            <Input
                                id="target_mg"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 20"
                                value={formData.target_dosage_mg}
                                onChange={(e) => setFormData((prev) => ({ ...prev, target_dosage_mg: e.target.value }))}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="measured_mg" className="text-xs font-semibold">Measured Content (mg)</Label>
                            <Input
                                id="measured_mg"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 20.64"
                                value={formData.measured_dosage_mg}
                                onChange={(e) => setFormData((prev) => ({ ...prev, measured_dosage_mg: e.target.value }))}
                                className="h-9 text-sm bg-background font-bold text-emerald-700 dark:text-emerald-400"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="purity" className="text-xs font-semibold">Purity (%) (HPLC)</Label>
                            <Input
                                id="purity"
                                type="number"
                                step="0.001"
                                placeholder="e.g. 99.265"
                                value={formData.purity_pct}
                                onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                className="h-9 text-sm bg-background font-bold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="task_number" className="text-xs font-semibold">Janoshik Task Number</Label>
                            <Input
                                id="task_number"
                                placeholder="e.g. #150361"
                                value={formData.task_number}
                                onChange={(e) => setFormData((prev) => ({ ...prev, task_number: e.target.value }))}
                                className="h-9 text-sm bg-background font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="verification_key" className="text-xs font-semibold">Lab Verification Key *</Label>
                            <Input
                                id="verification_key"
                                placeholder="e.g. 6N8BEI6MKCRK"
                                value={formData.verification_key}
                                onChange={(e) => setFormData((prev) => ({ ...prev, verification_key: e.target.value }))}
                                className="h-9 text-sm bg-background font-mono uppercase font-bold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="sequence" className="text-xs font-semibold">Identity / Sequence</Label>
                            <Select
                                value={formData.sequence_status}
                                onValueChange={(val) => setFormData((prev) => ({ ...prev, sequence_status: val }))}
                            >
                                <SelectTrigger className="h-9 text-sm bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Confirmed">Confirmed (Pass)</SelectItem>
                                    <SelectItem value="Mass Spec Verified">Mass Spec Verified</SelectItem>
                                    <SelectItem value="Blind Test Pass">Blind Test Pass</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="appearance" className="text-xs font-semibold">Appearance</Label>
                            <Input
                                id="appearance"
                                placeholder="White Lyophilized Powder"
                                value={formData.appearance}
                                onChange={(e) => setFormData((prev) => ({ ...prev, appearance: e.target.value }))}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                    </div>

                    {/* Blend Components Table (for KLOW, Wolverine, etc.) */}
                    <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground">
                                Multi-Peptide Blend Breakdown ({formData.components.length})
                            </Label>
                            <span className="text-[11px] text-muted-foreground">For blend vials (e.g. KLOW, CJC+IPA)</span>
                        </div>

                        {formData.components.length > 0 && (
                            <div className="space-y-1.5 bg-background p-2 rounded-lg border">
                                {formData.components.map((comp, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded bg-muted/40">
                                        <span className="font-semibold text-foreground">{comp.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                                                {comp.amount_mg} mg
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveComponent(idx)}
                                                className="text-muted-foreground hover:text-destructive p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Component name (e.g. GHK, BPC-157)"
                                value={newCompName}
                                onChange={(e) => setNewCompName(e.target.value)}
                                className="h-8 text-xs flex-1 bg-background"
                            />
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Amount (mg)"
                                value={newCompAmount}
                                onChange={(e) => setNewCompAmount(e.target.value)}
                                className="h-8 text-xs w-24 bg-background"
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddComponent}
                                className="h-8 text-xs px-2.5 font-semibold shrink-0"
                            >
                                + Add
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* WATER / SOLVENT SPECIFIC FIELDS */}
            {formData.coa_type === "water" && (
                <div className="space-y-3 p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40">
                    <span className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                        Bacteriostatic Water Formulation Specifications
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="purity_water" className="text-xs font-semibold">Purity (%)</Label>
                            <Input
                                id="purity_water"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 99.9"
                                value={formData.purity_pct}
                                onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ph" className="text-xs font-semibold">pH Level</Label>
                            <Input
                                id="ph"
                                type="number"
                                step="0.01"
                                placeholder="5.72"
                                value={formData.ph_level}
                                onChange={(e) => setFormData((prev) => ({ ...prev, ph_level: e.target.value }))}
                                className="h-9 text-sm bg-background font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ba" className="text-xs font-semibold">Benzyl Alcohol (%)</Label>
                            <Input
                                id="ba"
                                type="number"
                                step="0.01"
                                placeholder="0.90"
                                value={formData.benzyl_alcohol_pct}
                                onChange={(e) => setFormData((prev) => ({ ...prev, benzyl_alcohol_pct: e.target.value }))}
                                className="h-9 text-sm bg-background font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="sterility" className="text-xs font-semibold">Sterility Status (USP &lt;71&gt;)</Label>
                        <Select
                            value={formData.sterility_status}
                            onValueChange={(val) => setFormData((prev) => ({ ...prev, sterility_status: val }))}
                        >
                            <SelectTrigger className="h-9 text-sm bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Pass">Pass (Zero Growth)</SelectItem>
                                <SelectItem value="Fail">Fail</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Laboratory & Visibility Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="lab" className="text-xs font-semibold">Testing Laboratory</Label>
                    <Input
                        id="lab"
                        placeholder="Janoshik Analytical"
                        value={formData.lab_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, lab_name: e.target.value }))}
                        className="h-9 text-sm"
                    />
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
                <div className="space-y-1.5">
                    <Label htmlFor="featured" className="text-xs font-semibold">Product Page Status</Label>
                    <Select
                        value={formData.is_featured ? "true" : "false"}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, is_featured: val === "true" }))}
                    >
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">★ Current Active Lot</SelectItem>
                            <SelectItem value="false">Historical Archive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* PDF File Upload */}
            <div className="space-y-2 pt-1">
                <Label htmlFor="pdf" className="text-xs font-semibold">Official COA PDF Document *</Label>
                {formData.pdf_url ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg border">
                        <div className="flex items-center gap-2.5 truncate">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-xs sm:text-sm truncate font-medium">COA PDF Document Uploaded</span>
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
                            <span className="text-[11px] text-muted-foreground">Official lab test reports up to 15MB</span>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                            {uploading && (
                                <span className="text-xs text-primary font-medium animate-pulse">Uploading file to storage...</span>
                            )}
                        </label>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <ShieldCheck className="h-7 w-7 text-emerald-600" />
                        Certificates of Analysis (COAs)
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage third-party analytical lab reports, peptide HPLC testing, and batch verification records per product variant.
                    </p>
                </div>
                <div>
                    <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-4 w-4" /> New COA Report
                    </Button>
                </div>
            </div>

            {/* Filter Search & Type Pills */}
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search batch, variant (e.g. 20mg), key, or lab..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                        className="pl-9 h-10 text-sm"
                    />
                </div>

                {/* Filter by Type */}
                <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => { setTypeFilter("all"); setPageIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            typeFilter === "all"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        All ({coas.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTypeFilter("peptide"); setPageIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            typeFilter === "peptide"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        🔬 Peptides ({coas.filter((c) => c.coa_type === "peptide").length})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTypeFilter("water"); setPageIndex(0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            typeFilter === "water"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        💧 Solutions ({coas.filter((c) => c.coa_type === "water").length})
                    </button>
                </div>
            </div>

            {/* Table & Pagination Container */}
            <div className="bg-card border rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px]">Batch / Lot</TableHead>
                            <TableHead className="w-[280px]">Linked Product &amp; Variants</TableHead>
                            <TableHead>Lab &amp; Verification</TableHead>
                            <TableHead>Analytical Results</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Report</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                    Loading analytical certificates...
                                </TableCell>
                            </TableRow>
                        ) : paginatedCoas.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    No analytical reports found matching your filter.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedCoas.map((coa) => {
                                // Gather product names
                                const linkedIds = coa.product_ids || (coa.product_id ? [coa.product_id] : []);
                                const linkedNames = linkedIds
                                    .map((id) => productsMap.get(id)?.name || (coa.products?.id === id ? coa.products.name : null))
                                    .filter(Boolean) as string[];

                                // Gather variant badges
                                const linkedVariants = (coa.variant_ids || [])
                                    .map((vId) => variantsMap.get(vId))
                                    .filter(Boolean);

                                const isPeptide = coa.coa_type === "peptide";

                                return (
                                    <TableRow key={coa.id} className="hover:bg-muted/40">
                                        <TableCell>
                                            <div className="font-bold font-mono text-sm text-foreground">{coa.batch_number}</div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {isPeptide ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                        🔬 Peptide
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                        💧 Solution
                                                    </span>
                                                )}
                                                {coa.is_featured && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                        ★ Active Lot
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {linkedNames.length === 0 && linkedVariants.length === 0 ? (
                                                <span className="text-muted-foreground italic text-xs">General (Unlinked)</span>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {linkedNames.map((name, i) => (
                                                        <div key={i} className="font-semibold text-xs text-foreground truncate max-w-[260px]">
                                                            {name}
                                                        </div>
                                                    ))}
                                                    {linkedVariants.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {linkedVariants.map((v, idx) => (
                                                                <Badge
                                                                    key={idx}
                                                                    variant="outline"
                                                                    className="text-[10px] py-0 px-1.5 font-bold bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                                                >
                                                                    {v?.variantName}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <div className="space-y-0.5 text-xs">
                                                <div className="font-semibold text-foreground">{coa.lab_name || "Janoshik Analytical"}</div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(coa.test_date).toLocaleDateString(undefined, { timeZone: "UTC" })}
                                                </div>
                                                {coa.verification_key && (
                                                    <div className="pt-0.5">
                                                        <a
                                                            href={
                                                                coa.verification_url
                                                                    ? `${coa.verification_url.replace(/\/$/, "")}/?key=${coa.verification_key}`
                                                                    : `https://www.janoshik.com/verify/?key=${coa.verification_key}`
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-primary hover:underline"
                                                            title="Verify on Janoshik Portal"
                                                        >
                                                            Key: {coa.verification_key}
                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                {coa.purity_pct !== null && (
                                                    <div className="font-medium">
                                                        Purity: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{coa.purity_pct}%</strong>
                                                    </div>
                                                )}
                                                {isPeptide && coa.measured_dosage_mg && (
                                                    <div className="text-muted-foreground text-[11px]">
                                                        Content: <strong className="text-foreground">{coa.measured_dosage_mg} mg</strong>
                                                        {coa.target_dosage_mg && ` (Target: ${coa.target_dosage_mg}mg)`}
                                                    </div>
                                                )}
                                                {!isPeptide && (
                                                    <>
                                                        {coa.ph_level !== null && <div>pH: <strong className="text-foreground">{coa.ph_level}</strong></div>}
                                                        {coa.benzyl_alcohol_pct !== null && <div>BA: <strong className="text-foreground">{coa.benzyl_alcohol_pct}%</strong></div>}
                                                        {coa.sterility_status && (
                                                            <div>Sterility: <strong className="text-emerald-600 font-semibold">{coa.sterility_status}</strong></div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="space-y-1">
                                                {coa.is_active ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <a
                                                href={coa.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                            >
                                                <FileText className="h-3.5 w-3.5" /> PDF
                                            </a>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(coa)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(coa)}>
                                                    <Trash2 className="h-4 w-4" />
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

                {totalItems > 0 && (
                    <div className="p-3 sm:p-4 border-t bg-muted/20">
                        <DataTablePagination
                            currentPage={pageIndex + 1}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            onPageChange={(page) => setPageIndex(page - 1)}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPageIndex(0);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* CREATE COA MODAL */}
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border bg-background shadow-2xl">
                    <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/20 shrink-0">
                        <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            Upload Certificate of Analysis (COA)
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Link analytical batch testing data and verification keys directly to products and specific dosage variants.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {renderFormFields()}

                        <div className="p-4 sm:p-5 border-t bg-background flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 z-10">
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto h-9 text-xs">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={addMutation.isPending || uploading} className="w-full sm:w-auto h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                {addMutation.isPending ? "Adding COA..." : "Save COA Certificate"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* EDIT COA MODAL */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border bg-background shadow-2xl">
                    <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/20 shrink-0">
                        <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-primary" />
                            Edit COA Report — Lot #{formData.batch_number}
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Modify variant associations, analytical purity, or Janoshik verification keys.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {renderFormFields()}

                        <div className="p-4 sm:p-5 border-t bg-background flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 z-10">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="w-full sm:w-auto h-9 text-xs">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editMutation.isPending || uploading} className="w-full sm:w-auto h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                {editMutation.isPending ? "Updating..." : "Update COA"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* DELETE ALERT DIALOG */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Certificate of Analysis?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete Lot <strong>{selectedCoa?.batch_number}</strong>? This action cannot be undone and will remove the PDF document from cloud storage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedCoa(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedCoa && deleteMutation.mutate(selectedCoa)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete COA
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default COAManagement;
