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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface Product {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    is_published: boolean;
    category: string | null;
    image_url: string | null;
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

const ProductManagement = () => {
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [productImageUrl, setProductImageUrl] = useState<string>("");
    const [variantImageUrl, setVariantImageUrl] = useState<string>("");
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
                `) as any);
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
            toast.error(`Error creating variant: ${error.message}`);
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
            toast.error(`Error updating variant: ${error.message}`);
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
        const variantData = {
            product_id: selectedProductId!,
            vial_type_id: formData.get("vial_type_id") as string,
            sku: formData.get("sku") as string,
            price: parseFloat(formData.get("price") as string) || 0,
            stock_quantity: parseInt(formData.get("stock_quantity") as string) || 0,
            pack_size: parseInt(formData.get("pack_size") as string) || 1,
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

    const handleDeleteProduct = (id: string) => {
        if (confirm("Are you sure you want to delete this product and all its variants?")) {
            deleteProductMutation.mutate(id);
        }
    };

    const handleAddVariant = (productId: string) => {
        setSelectedProductId(productId);
        setEditingVariant(null);
        setIsVariantDialogOpen(true);
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setSelectedProductId(variant.product_id);
        setEditingVariant(variant);
        setVariantImageUrl(variant.image_url || "");
        setIsVariantDialogOpen(true);
    };

    const handleDeleteVariant = (id: string) => {
        if (confirm("Are you sure you want to delete this variant?")) {
            deleteVariantMutation.mutate(id);
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
                                    existingUrl={productImageUrl || editingProduct?.image_url || ""}
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

            {/* Variant Dialog */}
            <Dialog open={isVariantDialogOpen} onOpenChange={(open) => {
                setIsVariantDialogOpen(open);
                if (!open) {
                    setEditingVariant(null);
                    setSelectedProductId(null);
                    setVariantImageUrl("");
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
                            <Label htmlFor="pack_size">Pack Size</Label>
                            <Input id="pack_size" name="pack_size" type="number" min="1" defaultValue={editingVariant?.pack_size || 1} required />
                            <p className="text-xs text-muted-foreground">Number of vials in this pack (default: 1)</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="variant_image">Variant Image (Optional)</Label>
                            <ImageUpload
                                existingUrl={variantImageUrl || editingVariant?.image_url || ""}
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
                                <TableCell colSpan={8} className="text-center py-8">
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
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
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
                                                                    <TableHead>Size</TableHead>
                                                                    <TableHead>Pack Size</TableHead>
                                                                    <TableHead>SKU</TableHead>
                                                                    <TableHead>Price</TableHead>
                                                                    <TableHead>Stock</TableHead>
                                                                    <TableHead>Status</TableHead>
                                                                    <TableHead className="text-right">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {variants.map((variant) => (
                                                                    <TableRow key={variant.id}>
                                                                        <TableCell>{variant.vial_type.size_ml}ml</TableCell>
                                                                        <TableCell>{variant.pack_size}x</TableCell>
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
                                                                                <Button variant="ghost" size="icon" onClick={() => handleEditVariant(variant)}>
                                                                                    <Pencil className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteVariant(variant.id)}>
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
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
        </div>
    );
};

export default ProductManagement;
