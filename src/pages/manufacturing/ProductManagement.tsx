import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface Product {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    is_published: boolean;
    category: string | null;
    image_url: string | null;
    sale_type: string;
    default_pack_size: number | null;
}

interface ProductVariant {
    id: string;
    product_id: string;
    vial_type_id: string;
    sku: string | null;
    price: number;
    stock_quantity: number;
    is_published: boolean;
    pack_size: number;
    image_url: string | null;
    vial_type: {
        name: string;
        size_ml: number;
    };
}

interface VialType {
    id: string;
    name: string;
    size_ml: number;
}

interface SortableVariantRowProps {
    variant: ProductVariant;
    onEdit: (variant: ProductVariant) => void;
    onDelete: (variant: ProductVariant) => void;
}

const SortableVariantRow = ({ variant, onEdit, onDelete }: SortableVariantRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: variant.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell>
                <div {...attributes} {...listeners} className="cursor-move touch-none flex items-center justify-center">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            </TableCell>
            <TableCell>
                {variant.image_url ? (
                    <img
                        src={variant.image_url}
                        alt={`${variant.vial_type.size_ml}ml variant`}
                        className="h-10 w-10 object-cover rounded"
                    />
                ) : (
                    <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                        —
                    </div>
                )}
            </TableCell>
            <TableCell>{variant.vial_type.size_ml}ml</TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium capitalize">{variant.pack_size > 1 ? 'Pack' : 'Individual'}</span>
                    {variant.pack_size > 1 && (
                        <span className="text-xs text-muted-foreground">
                            {variant.pack_size}x
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="font-mono text-xs">{variant.sku || '-'}</TableCell>
            <TableCell>${variant.price.toFixed(2)}</TableCell>
            <TableCell>{variant.stock_quantity}</TableCell>
            <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs ${variant.is_published ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {variant.is_published ? 'Published' : 'Draft'}
                </span>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(variant)}>
                        <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(variant)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

const ProductManagement = () => {
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [productImageUrl, setProductImageUrl] = useState<string>("");
    const [variantImageUrl, setVariantImageUrl] = useState<string>("");
    const [variantSaleType, setVariantSaleType] = useState<string>("individual");
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
    const [deletingVariant, setDeletingVariant] = useState<ProductVariant | null>(null);
    const queryClient = useQueryClient();

    // Fetch products
    const { data: products, isLoading } = useQuery({
        queryKey: ["products-with-variants"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .order("name");
            if (error) throw error;
            return data as Product[];
        },
    });

    // Fetch variants for a product
    const { data: variantsMap } = useQuery({
        queryKey: ["product-variants-all"],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from("product_variants" as any)
                .select(`
                    *,
                    vial_type:vial_types(name, size_ml)
                `)
                .order('position', { ascending: true }) as any);
            if (error) throw error;

            // Group by product_id
            const grouped: Record<string, ProductVariant[]> = {};
            (data as any[])?.forEach((v: any) => {
                if (!grouped[v.product_id]) {
                    grouped[v.product_id] = [];
                }
                grouped[v.product_id].push({
                    id: v.id,
                    product_id: v.product_id,
                    vial_type_id: v.vial_type_id,
                    sku: v.sku,
                    price: v.price,
                    stock_quantity: v.stock_quantity,
                    is_published: v.is_published,
                    pack_size: v.pack_size || 1,
                    image_url: v.image_url,
                    vial_type: v.vial_type,
                });
            });
            return grouped;
        },
    });

    // Fetch vial types
    const { data: vialTypes } = useQuery({
        queryKey: ["vial-types"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vial_types")
                .select("*")
                .eq("active", true)
                .order("size_ml");
            if (error) throw error;
            return data as VialType[];
        },
    });

    // Product mutations
    const createProductMutation = useMutation({
        mutationFn: async (newProduct: Omit<Product, "id">) => {
            const { data, error } = await supabase
                .from("products")
                .insert([newProduct])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products-with-variants"] });
            toast.success("Product created successfully");
            setIsProductDialogOpen(false);
        },
        onError: (error) => {
            toast.error(`Error creating product: ${error.message}`);
        },
    });

    const updateProductMutation = useMutation({
        mutationFn: async (product: Product) => {
            const { data, error } = await supabase
                .from("products")
                .update(product)
                .eq("id", product.id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products-with-variants"] });
            toast.success("Product updated successfully");
            setIsProductDialogOpen(false);
            setEditingProduct(null);
        },
        onError: (error) => {
            toast.error(`Error updating product: ${error.message}`);
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: async (id: string) => {
            // First check if there are production batches associated with this product
            const { data: batches, error: batchError } = await supabase
                .from("production_batches")
                .select("id")
                .eq("product_id", id)
                .limit(1);

            if (batchError) throw batchError;

            if (batches && batches.length > 0) {
                throw new Error("Cannot delete product with existing production batches. Please remove or reassign the batches first.");
            }

            // Check if there are variants
            const { data: variants, error: variantError } = await (supabase
                .from("product_variants" as any)
                .select("id")
                .eq("product_id", id) as any);

            if (variantError) throw variantError;

            if (variants && variants.length > 0) {
                throw new Error("Cannot delete product with existing variants. Please delete all variants first.");
            }

            // If no dependencies, proceed with deletion
            const { error } = await supabase.from("products").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products-with-variants"] });
            toast.success("Product deleted successfully");
        },
        onError: (error) => {
            toast.error(`Error deleting product: ${error.message}`);
        },
    });

    // Variant mutations
    const createVariantMutation = useMutation({
        mutationFn: async (newVariant: Omit<ProductVariant, "id" | "vial_type">) => {
            const { data, error } = await (supabase
                .from("product_variants" as any)
                .insert([newVariant])
                .select() as any);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-variants-all"] });
            toast.success("Variant created successfully");
            setIsVariantDialogOpen(false);
        },
        onError: (error: any) => {
            let errorMessage = "Error creating variant";

            if (error.message?.includes("product_variants_product_vial_pack_unique")) {
                errorMessage = "This variant already exists. You cannot create two variants with the same product, vial size, and sale type (Individual or Pack with the same quantity).";
            } else if (error.message) {
                errorMessage = `Error creating variant: ${error.message}`;
            }

            toast.error(errorMessage);
        },
    });

    const updateVariantMutation = useMutation({
        mutationFn: async (variant: Omit<ProductVariant, "vial_type">) => {
            const { data, error } = await (supabase
                .from("product_variants" as any)
                .update(variant)
                .eq("id", variant.id)
                .select() as any);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-variants-all"] });
            toast.success("Variant updated successfully");
            setIsVariantDialogOpen(false);
            setEditingVariant(null);
        },
        onError: (error: any) => {
            let errorMessage = "Error updating variant";

            if (error.message?.includes("product_variants_product_vial_pack_unique")) {
                errorMessage = "This variant already exists. You cannot have two variants with the same product, vial size, and sale type (Individual or Pack with the same quantity).";
            } else if (error.message) {
                errorMessage = `Error updating variant: ${error.message}`;
            }

            toast.error(errorMessage);
        },
    });

    const deleteVariantMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from("product_variants" as any).delete().eq("id", id) as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-variants-all"] });
            toast.success("Variant deleted successfully");
        },
        onError: (error: any) => {
            toast.error(`Error deleting variant: ${error.message}`);
        },
    });

    const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const productData = {
            name: formData.get("name") as string,
            description: formData.get("description") as string,
            category: formData.get("category") as string,
            image_url: productImageUrl || formData.get("image_url") as string,
            is_active: formData.get("is_active") === "on",
            is_published: formData.get("is_published") === "on",
            sale_type: 'individual',
            default_pack_size: null,
        };

        if (editingProduct) {
            updateProductMutation.mutate({ ...productData, id: editingProduct.id });
        } else {
            createProductMutation.mutate(productData);
        }
    };

    const handleVariantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const skuValue = formData.get("sku") as string;
        const variantData = {
            product_id: selectedProductId!,
            vial_type_id: formData.get("vial_type_id") as string,
            sku: skuValue?.trim() || null,
            price: parseFloat(formData.get("price") as string) || 0,
            stock_quantity: parseInt(formData.get("stock_quantity") as string) || 0,
            sale_type: variantSaleType,
            pack_size: variantSaleType === 'pack' ? (parseInt(formData.get("pack_size") as string) || 1) : 1,
            is_published: formData.get("is_published") === "on",
            image_url: variantImageUrl || null,
        };

        if (editingVariant) {
            updateVariantMutation.mutate({ ...variantData, id: editingVariant.id });
        } else {
            createVariantMutation.mutate(variantData);
        }
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setProductImageUrl(product.image_url || "");
        setIsProductDialogOpen(true);
    };

    const handleDeleteProduct = (product: Product) => {
        setDeletingProduct(product);
    };

    const confirmDeleteProduct = () => {
        if (deletingProduct) {
            deleteProductMutation.mutate(deletingProduct.id);
            setDeletingProduct(null);
        }
    };

    const handleAddVariant = (productId: string) => {
        setSelectedProductId(productId);
        setEditingVariant(null);
        setVariantSaleType("individual");
        setIsVariantDialogOpen(true);
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setSelectedProductId(variant.product_id);
        setEditingVariant(variant);
        setVariantImageUrl(variant.image_url || "");
        setVariantSaleType(variant.pack_size > 1 ? "pack" : "individual");
        setIsVariantDialogOpen(true);
    };

    const handleDeleteVariant = (variant: ProductVariant) => {
        setDeletingVariant(variant);
    };

    const confirmDeleteVariant = () => {
        if (deletingVariant) {
            deleteVariantMutation.mutate(deletingVariant.id);
            setDeletingVariant(null);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            let productId: string | null = null;
            let variants: ProductVariant[] = [];

            // Find which product these variants belong to
            for (const [pid, list] of Object.entries(variantsMap || {})) {
                if (list.find(v => v.id === active.id)) {
                    productId = pid;
                    variants = list;
                    break;
                }
            }

            if (productId && variants.length > 0) {
                const oldIndex = variants.findIndex((v) => v.id === active.id);
                const newIndex = variants.findIndex((v) => v.id === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newVariants = arrayMove(variants, oldIndex, newIndex);

                    // Optimistic update
                    queryClient.setQueryData(["product-variants-all"], (oldData: any) => {
                        return {
                            ...oldData,
                            [productId!]: newVariants
                        };
                    });

                    // Update positions in DB
                    const updates = newVariants.map((v, index) => ({
                        id: v.id,
                        position: index,
                    }));

                    try {
                        await Promise.all(updates.map(u =>
                            supabase.from('product_variants' as any).update({ position: u.position }).eq('id', u.id)
                        ));
                        toast.success("Order updated");
                    } catch (error) {
                        toast.error("Failed to update order");
                        queryClient.invalidateQueries({ queryKey: ["product-variants-all"] });
                    }
                }
            }
        }
    };

    const toggleExpanded = (productId: string) => {
        const newExpanded = new Set(expandedProducts);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedProducts(newExpanded);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Product Management</h1>
                    <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                        setIsProductDialogOpen(open);
                        if (!open) {
                            setEditingProduct(null);
                            setProductImageUrl("");
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
                                <DialogDescription>
                                    {editingProduct ? "Update product information" : "Create a new product"}
                                </DialogDescription>
                            </DialogHeader>
                            <form key={editingProduct ? editingProduct.id : "new"} onSubmit={handleProductSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" defaultValue={editingProduct?.name} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" name="description" defaultValue={editingProduct?.description || ""} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <select
                                        id="category"
                                        name="category"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={editingProduct?.category || ""}
                                    >
                                        <option value="" disabled>Select a category</option>
                                        <option value="Peptides">Peptides</option>
                                        <option value="Water">Water</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image_url">Product Image</Label>
                                    <ImageUpload
                                        existingUrl={productImageUrl}
                                        onUpload={setProductImageUrl}
                                    />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        name="is_active"
                                        className="h-4 w-4 rounded border-gray-300"
                                        defaultChecked={editingProduct?.is_active ?? true}
                                    />
                                    <Label htmlFor="is_active">Active (Manufacturing)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="is_published"
                                        name="is_published"
                                        className="h-4 w-4 rounded border-gray-300"
                                        defaultChecked={editingProduct?.is_published ?? false}
                                    />
                                    <Label htmlFor="is_published">Published (E-commerce)</Label>
                                </div>
                                <Button type="submit" className="w-full">
                                    {editingProduct ? "Update Product" : "Create Product"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the product
                                "{deletingProduct?.name}" and all its data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteProduct}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!deletingVariant} onOpenChange={(open) => !open && setDeletingVariant(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the variant
                                "{deletingVariant?.vial_type.size_ml}ml - {deletingVariant?.sku || 'No SKU'}" and all its data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteVariant}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Variant Dialog */}
                <Dialog open={isVariantDialogOpen} onOpenChange={(open) => {
                    setIsVariantDialogOpen(open);
                    if (!open) {
                        setEditingVariant(null);
                        setSelectedProductId(null);
                        setVariantImageUrl("");
                        setVariantSaleType("individual");
                    }
                }}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingVariant ? "Edit Variant" : "Add Variant"}</DialogTitle>
                            <DialogDescription>
                                {editingVariant ? "Update variant details" : "Create a new product variant"}
                            </DialogDescription>
                        </DialogHeader>
                        <form key={editingVariant ? editingVariant.id : "new"} onSubmit={handleVariantSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="vial_type_id">Vial Type</Label>
                                <select
                                    id="vial_type_id"
                                    name="vial_type_id"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={editingVariant?.vial_type_id || ""}
                                    required
                                >
                                    <option value="" disabled>Select vial type</option>
                                    {vialTypes?.map((vt) => (
                                        <option key={vt.id} value={vt.id}>
                                            {vt.name} ({vt.size_ml}ml)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU (Optional)</Label>
                                <Input id="sku" name="sku" defaultValue={editingVariant?.sku || ""} placeholder="SKU-001" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price</Label>
                                    <Input id="price" name="price" type="number" step="0.01" defaultValue={editingVariant?.price} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="stock_quantity">Stock</Label>
                                    <Input id="stock_quantity" name="stock_quantity" type="number" defaultValue={editingVariant?.stock_quantity} required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="variant_sale_type">Sale Type</Label>
                                <select
                                    id="variant_sale_type"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={variantSaleType}
                                    onChange={(e) => setVariantSaleType(e.target.value)}
                                >
                                    <option value="individual">Individual</option>
                                    <option value="pack">Pack</option>
                                </select>
                            </div>
                            {variantSaleType === "pack" && (
                                <div className="space-y-2">
                                    <Label htmlFor="pack_size">Pack Size</Label>
                                    <Input id="pack_size" name="pack_size" type="number" min="2" defaultValue={editingVariant?.pack_size || 2} required />
                                    <p className="text-xs text-muted-foreground">Number of vials in this pack</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="variant_image">Variant Image (Optional)</Label>
                                <ImageUpload
                                    existingUrl={variantImageUrl}
                                    onUpload={setVariantImageUrl}
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="variant_is_published"
                                    name="is_published"
                                    className="h-4 w-4 rounded border-gray-300"
                                    defaultChecked={editingVariant?.is_published ?? true}
                                />
                                <Label htmlFor="variant_is_published">Published</Label>
                            </div>
                            <Button type="submit" className="w-full">
                                {editingVariant ? "Update Variant" : "Create Variant"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Image</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Manufacturing</TableHead>
                                <TableHead>E-commerce</TableHead>
                                <TableHead>Variants</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        Loading products...
                                    </TableCell>
                                </TableRow>
                            ) : products?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8">
                                        No products found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products?.map((product) => {
                                    const variants = variantsMap?.[product.id] || [];
                                    const isExpanded = expandedProducts.has(product.id);

                                    return (
                                        <React.Fragment key={product.id}>
                                            <TableRow>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleExpanded(product.id)}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    {product.image_url ? (
                                                        <img
                                                            src={product.image_url}
                                                            alt={product.name}
                                                            className="h-12 w-12 object-cover rounded"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                                                            No image
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell>{product.category || "—"}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {product.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${product.is_published ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {product.is_published ? 'Published' : 'Draft'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{variants.length} variant{variants.length !== 1 ? 's' : ''}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleAddVariant(product.id)}>
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && variants.length > 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="bg-muted/50 p-0">
                                                        <div className="p-4">
                                                            <h4 className="font-semibold mb-3 text-sm">Variants</h4>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="w-10"></TableHead>
                                                                        <TableHead>Image</TableHead>
                                                                        <TableHead>Size</TableHead>
                                                                        <TableHead>Sale Type</TableHead>
                                                                        <TableHead>SKU</TableHead>
                                                                        <TableHead>Price</TableHead>
                                                                        <TableHead>Stock</TableHead>
                                                                        <TableHead>Status</TableHead>
                                                                        <TableHead className="text-right">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    <SortableContext
                                                                        items={variants.map(v => v.id)}
                                                                        strategy={verticalListSortingStrategy}
                                                                    >
                                                                        {variants.map((variant) => (
                                                                            <SortableVariantRow
                                                                                key={variant.id}
                                                                                variant={variant}
                                                                                onEdit={handleEditVariant}
                                                                                onDelete={handleDeleteVariant}
                                                                            />
                                                                        ))}
                                                                    </SortableContext>
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Delete Product Confirmation Dialog */}
                <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete product "{deletingProduct?.name}"? This will also delete all related variants and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteProduct}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DndContext>
    );
};

export default ProductManagement;
