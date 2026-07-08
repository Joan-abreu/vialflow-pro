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
import { Plus, Pencil, Trash2, FileText, Upload, Calendar } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface Product {
    id: string;
    name: string;
}

interface COA {
    id: string;
    product_id: string | null;
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: number | null;
    ph_level: number | null;
    benzyl_alcohol_pct: number | null;
    sterility_status: string;
    is_active: boolean;
    products?: Product | null;
}

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
        product_id: "none",
        batch_number: "",
        test_date: "",
        pdf_url: "",
        purity_pct: "",
        ph_level: "",
        benzyl_alcohol_pct: "",
        sterility_status: "Pass",
        is_active: true,
    });

    const [uploading, setUploading] = useState(false);

    // Fetch Products (to populate dropdown)
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
            const payload = {
                ...newData,
                product_id: newData.product_id === "none" ? null : newData.product_id,
                purity_pct: newData.purity_pct ? parseFloat(newData.purity_pct) : null,
                ph_level: newData.ph_level ? parseFloat(newData.ph_level) : null,
                benzyl_alcohol_pct: newData.benzyl_alcohol_pct ? parseFloat(newData.benzyl_alcohol_pct) : null,
            };
            const { error } = await supabase.from("product_coas" as any).insert(payload);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
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
            const payload = {
                ...updatedData,
                product_id: updatedData.product_id === "none" ? null : updatedData.product_id,
                purity_pct: updatedData.purity_pct ? parseFloat(updatedData.purity_pct) : null,
                ph_level: updatedData.ph_level ? parseFloat(updatedData.ph_level) : null,
                benzyl_alcohol_pct: updatedData.benzyl_alcohol_pct ? parseFloat(updatedData.benzyl_alcohol_pct) : null,
            };
            const { error } = await supabase
                .from("product_coas" as any)
                .update(payload)
                .eq("id", selectedCoa?.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coas"] });
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
            // Optional: delete from storage first if we can parse the filename
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
            toast.success("COA deleted successfully.");
            setIsDeleteOpen(false);
        },
        onError: (error: any) => {
            toast.error(`Failed to delete COA: ${error.message}`);
        },
    });

    const resetForm = () => {
        setFormData({
            product_id: "none",
            batch_number: "",
            test_date: "",
            pdf_url: "",
            purity_pct: "",
            ph_level: "",
            benzyl_alcohol_pct: "",
            sterility_status: "Pass",
            is_active: true,
        });
        setSelectedCoa(null);
    };

    const handleEditClick = (coa: COA) => {
        setSelectedCoa(coa);
        setFormData({
            product_id: coa.product_id || "none",
            batch_number: coa.batch_number,
            test_date: coa.test_date,
            pdf_url: coa.pdf_url,
            purity_pct: coa.purity_pct?.toString() || "",
            ph_level: coa.ph_level?.toString() || "",
            benzyl_alcohol_pct: coa.benzyl_alcohol_pct?.toString() || "",
            sterility_status: coa.sterility_status,
            is_active: coa.is_active,
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
        const matchesSearch =
            coa.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (coa.products?.name && coa.products.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
                    <h1 className="text-3xl font-bold tracking-tight">COA & Lab Reports</h1>
                    <p className="text-muted-foreground">Manage Certificate of Analysis documents and specifications for your products.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add COA Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add New COA Report</DialogTitle>
                            <DialogDescription>
                                Upload a PDF and fill in the analysis results.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="product">Product Association (Optional)</Label>
                                <Select
                                    value={formData.product_id}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, product_id: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Product Association</SelectItem>
                                        {products?.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="batch">Batch Number *</Label>
                                    <Input
                                        id="batch"
                                        placeholder="BW-30ML-2026-A"
                                        value={formData.batch_number}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, batch_number: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date">Analysis Date *</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={formData.test_date}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, test_date: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="purity">Purity (%)</Label>
                                    <Input
                                        id="purity"
                                        type="number"
                                        step="0.01"
                                        placeholder="99.9"
                                        value={formData.purity_pct}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ph">pH Level</Label>
                                    <Input
                                        id="ph"
                                        type="number"
                                        step="0.01"
                                        placeholder="5.8"
                                        value={formData.ph_level}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, ph_level: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ba">Benzyl Alcohol (%)</Label>
                                    <Input
                                        id="ba"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.9"
                                        value={formData.benzyl_alcohol_pct}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, benzyl_alcohol_pct: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sterility">Sterility Status</Label>
                                    <Select
                                        value={formData.sterility_status}
                                        onValueChange={(val) => setFormData((prev) => ({ ...prev, sterility_status: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select sterility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pass">Pass</SelectItem>
                                            <SelectItem value="Fail">Fail</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="active">Visibility</Label>
                                    <Select
                                        value={formData.is_active ? "true" : "false"}
                                        onValueChange={(val) => setFormData((prev) => ({ ...prev, is_active: val === "true" }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Active (Visible)</SelectItem>
                                            <SelectItem value="false">Inactive (Hidden)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <Label htmlFor="pdf">COA PDF File *</Label>
                                {formData.pdf_url ? (
                                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                                        <FileText className="h-6 w-6 text-primary shrink-0" />
                                        <span className="text-sm truncate flex-1 font-medium">COA PDF File Uploaded</span>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setFormData((prev) => ({ ...prev, pdf_url: "" }))}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 bg-muted/30">
                                        <label className="flex flex-col items-center gap-2 cursor-pointer">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <span className="text-sm font-semibold text-primary">Click to upload COA PDF</span>
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                disabled={uploading}
                                            />
                                            {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading file...</span>}
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={addMutation.isPending || uploading}>
                                    {addMutation.isPending ? "Adding..." : "Add COA"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Search */}
            <div className="flex items-center gap-2 w-full max-w-sm">
                <Input
                    placeholder="Search by batch or product..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                />
            </div>

            {/* Table */}
            <div className="bg-card border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Batch Number</TableHead>
                            <TableHead>Product Association</TableHead>
                            <TableHead>Test Date</TableHead>
                            <TableHead>Specs Summary</TableHead>
                            <TableHead>Status</TableHead>
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
                            paginatedCoas.map((coa) => (
                                <TableRow key={coa.id}>
                                    <TableCell className="font-bold">{coa.batch_number}</TableCell>
                                    <TableCell>{coa.products?.name || <span className="text-muted-foreground italic">None</span>}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {new Date(coa.test_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs space-y-1">
                                            {coa.purity_pct !== null && <div>Purity: <strong className="text-foreground">{coa.purity_pct}%</strong></div>}
                                            {coa.ph_level !== null && <div>pH: <strong className="text-foreground">{coa.ph_level}</strong></div>}
                                            {coa.benzyl_alcohol_pct !== null && <div>Benzyl Alcohol: <strong className="text-foreground">{coa.benzyl_alcohol_pct}%</strong></div>}
                                            {coa.sterility_status && <div>Sterility: <strong className="text-foreground">{coa.sterility_status}</strong></div>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {coa.is_active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Hidden
                                            </span>
                                        )}
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
                            ))
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

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit COA Report</DialogTitle>
                        <DialogDescription>
                            Update specifications or modify the uploaded report file.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-product">Product Association (Optional)</Label>
                            <Select
                                value={formData.product_id}
                                onValueChange={(val) => setFormData((prev) => ({ ...prev, product_id: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Product Association</SelectItem>
                                    {products?.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-batch">Batch Number *</Label>
                                <Input
                                    id="edit-batch"
                                    value={formData.batch_number}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, batch_number: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Analysis Date *</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={formData.test_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, test_date: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="edit-purity">Purity (%)</Label>
                                <Input
                                    id="edit-purity"
                                    type="number"
                                    step="0.01"
                                    value={formData.purity_pct}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, purity_pct: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-ph">pH Level</Label>
                                <Input
                                    id="edit-ph"
                                    type="number"
                                    step="0.01"
                                    value={formData.ph_level}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, ph_level: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-ba">Benzyl Alcohol (%)</Label>
                                <Input
                                    id="edit-ba"
                                    type="number"
                                    step="0.01"
                                    value={formData.benzyl_alcohol_pct}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, benzyl_alcohol_pct: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-sterility">Sterility Status</Label>
                                <Select
                                    value={formData.sterility_status}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, sterility_status: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select sterility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pass">Pass</SelectItem>
                                        <SelectItem value="Fail">Fail</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-active">Visibility</Label>
                                <Select
                                    value={formData.is_active ? "true" : "false"}
                                    onValueChange={(val) => setFormData((prev) => ({ ...prev, is_active: val === "true" }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Active (Visible)</SelectItem>
                                        <SelectItem value="false">Inactive (Hidden)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="edit-pdf">COA PDF File *</Label>
                            {formData.pdf_url ? (
                                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                                    <FileText className="h-6 w-6 text-primary shrink-0" />
                                    <span className="text-sm truncate flex-1 font-medium">COA PDF File Uploaded</span>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setFormData((prev) => ({ ...prev, pdf_url: "" }))}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 bg-muted/30">
                                    <label className="flex flex-col items-center gap-2 cursor-pointer">
                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-sm font-semibold text-primary">Click to upload COA PDF</span>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                        {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading file...</span>}
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={editMutation.isPending || uploading}>
                                {editMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Alert Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the COA report for batch **{selectedCoa?.batch_number}** and remove the associated PDF file from storage. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedCoa(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (selectedCoa) deleteMutation.mutate(selectedCoa); }}
                            className="bg-destructive hover:bg-destructive/90 text-white"
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
