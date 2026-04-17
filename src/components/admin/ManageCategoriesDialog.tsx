import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface ProductCategory {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    is_private?: boolean;
    position: number;
}

export function ManageCategoriesDialog() {
    const [open, setOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDescription, setNewCategoryDescription] = useState("");
    const [newCategoryIsPrivate, setNewCategoryIsPrivate] = useState(false);
    const [newCategoryPosition, setNewCategoryPosition] = useState(0);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
    const queryClient = useQueryClient();

    // Fetch categories
    const { data: categories, isLoading } = useQuery({
        queryKey: ["product-categories"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_categories" as any)
                .select("*")
                .order("position", { ascending: true })
                .order("name");
            if (error) throw error;
            return data as any as ProductCategory[];
        },
        enabled: open,
    });

    // Create mutation
    const createCategoryMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; is_private: boolean, position: number }) => {
            const { error } = await supabase
                .from("product_categories" as any)
                .insert([{ 
                    name: data.name, 
                    description: data.description, 
                    is_private: data.is_private,
                    position: data.position 
                }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories"] });
            setNewCategoryName("");
            setNewCategoryDescription("");
            setNewCategoryIsPrivate(false);
            setNewCategoryPosition(0);
            toast.success("Category created");
        },
        onError: (error: any) => {
            toast.error("Error creating category: " + error.message);
        },
    });

    // Update mutation
    const updateCategoryMutation = useMutation({
        mutationFn: async (category: { id: string; name: string; description: string; is_private: boolean, position: number }) => {
            const { error } = await supabase
                .from("product_categories" as any)
                .update({ 
                    name: category.name, 
                    description: category.description, 
                    is_private: category.is_private,
                    position: category.position
                })
                .eq("id", category.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories"] });
            setEditingCategory(null);
            setNewCategoryName("");
            setNewCategoryDescription("");
            setNewCategoryIsPrivate(false);
            setNewCategoryPosition(0);
            toast.success("Category updated");
        },
        onError: (error: any) => {
            toast.error("Error updating category: " + error.message);
        },
    });

    // Delete mutation
    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("product_categories" as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories"] });
            toast.success("Category deleted");
        },
        onError: (error: any) => {
            toast.error("Error deleting category (it might be in use): " + error.message);
        },
    });

    // Toggle active mutation
    const toggleActiveMutation = useMutation({
        mutationFn: async (category: ProductCategory) => {
            const { error } = await supabase
                .from("product_categories" as any)
                .update({ active: !category.active })
                .eq("id", category.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-categories"] });
            toast.success("Category status updated");
        },
        onError: (error: any) => {
            toast.error("Error updating status: " + error.message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        if (editingCategory) {
            updateCategoryMutation.mutate({
                id: editingCategory.id,
                name: newCategoryName.trim(),
                description: newCategoryDescription.trim(),
                is_private: newCategoryIsPrivate,
                position: newCategoryPosition,
            });
        } else {
            createCategoryMutation.mutate({
                name: newCategoryName.trim(),
                description: newCategoryDescription.trim(),
                is_private: newCategoryIsPrivate,
                position: newCategoryPosition,
            });
        }
    };

    const handleEdit = (category: ProductCategory) => {
        setEditingCategory(category);
        setNewCategoryName(category.name);
        setNewCategoryDescription(category.description || "");
        setNewCategoryIsPrivate(category.is_private || false);
        setNewCategoryPosition(category.position || 0);
    };

    const handleCancelEdit = () => {
        setEditingCategory(null);
        setNewCategoryName("");
        setNewCategoryDescription("");
        setNewCategoryIsPrivate(false);
        setNewCategoryPosition(0);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) handleCancelEdit();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">Manage Categories</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Product Categories</DialogTitle>
                    <DialogDescription>
                        Add, update, or remove categories for your products.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="categoryName">Name</Label>
                            <Input
                                id="categoryName"
                                placeholder="Category Name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="categoryDescription">Description</Label>
                            <Input
                                id="categoryDescription"
                                placeholder="Description (optional)"
                                value={newCategoryDescription}
                                onChange={(e) => setNewCategoryDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid w-full items-center gap-1.5 mt-2">
                            <Label htmlFor="categoryIsPrivate" className="mb-1">Private Category (VIP)</Label>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="categoryIsPrivate"
                                    checked={newCategoryIsPrivate}
                                    onCheckedChange={setNewCategoryIsPrivate}
                                />
                                <span className="text-sm font-normal text-muted-foreground">Hide from public and search engines</span>
                            </div>
                        </div>
                        <div className="grid w-full items-center gap-1.5 mt-2">
                            <Label htmlFor="categoryPosition">Display Order (Lower numbers show first)</Label>
                            <Input
                                id="categoryPosition"
                                type="number"
                                placeholder="0"
                                value={newCategoryPosition}
                                onChange={(e) => setNewCategoryPosition(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                            {editingCategory && (
                                <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                            )}
                            <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                                {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editingCategory ? (
                                    "Save Changes"
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Category
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">Order</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center">Loading...</TableCell>
                                    </TableRow>
                                ) : categories?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">No categories yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    categories?.map((cat) => (
                                        <TableRow key={cat.id}>
                                            <TableCell className="font-mono text-xs">{cat.position}</TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {cat.name}
                                                    {cat.is_private && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold uppercase">Private</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{cat.description || "-"}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={cat.active}
                                                    onCheckedChange={() => toggleActiveMutation.mutate(cat)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(cat)}
                                                        className="h-8 w-8"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
