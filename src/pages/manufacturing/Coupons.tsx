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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus, Ticket, Trash2, RefreshCcw, Calendar as CalendarIcon, Mail, Search, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import CopyCell from "@/components/CopyCell";
import { SendCouponDialog } from "@/components/shared/SendCouponDialog";
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
import { cn } from "@/lib/utils";

interface Coupon {
    id: string;
    code: string;
    target: 'product' | 'shipping' | 'all';
    type: 'percentage' | 'fixed_amount';
    value: number;
    max_uses: number | null;
    times_used: number;
    expires_at: string | null;
    is_active: boolean;
    is_referral: boolean;
    one_use_per_user: boolean;
    restricted_to_user_ids: string[] | null;
    created_at: string;
}

const Coupons = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);
    const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
    
    // Searchable Customer Selector state
    const [userSearchOpen, setUserSearchOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    
    const queryClient = useQueryClient();

    // Fetch coupons
    const { data: coupons, isLoading } = useQuery({
        queryKey: ["admin-coupons"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("coupons")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as Coupon[];
        },
    });

    // Fetch customers for restriction dropdown
    const { data: users } = useQuery({
        queryKey: ["admin-profiles-lookup"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("user_id, full_name, email")
                .order("full_name");
            if (error) throw error;
            return data;
        },
    });

    // Mutations
    const createCouponMutation = useMutation({
        mutationFn: async (newCoupon: any) => {
            const { data, error } = await supabase
                .from("coupons")
                .insert([newCoupon])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon created successfully");
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(`Error creating coupon: ${error.message}`);
        },
    });

    const updateCouponMutation = useMutation({
        mutationFn: async ({ id, ...updates }: any) => {
            const { data, error } = await supabase
                .from("coupons")
                .update(updates)
                .eq("id", id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon updated");
            setIsDialogOpen(false);
            setEditingCoupon(null);
        },
        onError: (error: any) => {
            toast.error(`Error updating coupon: ${error.message}`);
        },
    });

    const deleteCouponMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("coupons")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon deleted");
        },
        onError: (error: any) => {
            toast.error(`Error deleting coupon: ${error.message}`);
        },
    });

    const resetForm = () => {
        setEditingCoupon(null);
        setExpiryDate(undefined);
        setSelectedUserIds([]);
        setUserSearchOpen(false);
    };

    const generateCode = () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const codeInput = document.getElementById('code') as HTMLInputElement;
        if (codeInput) codeInput.value = code;
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        const couponData = {
            code: (formData.get("code") as string).trim().toUpperCase(),
            target: formData.get("target") as any,
            type: formData.get("type") as any,
            value: parseFloat(formData.get("value") as string),
            max_uses: formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : null,
            expires_at: expiryDate ? expiryDate.toISOString() : null,
            is_active: formData.get("is_active") === "on",
            one_use_per_user: formData.get("one_use_per_user") === "on",
            restricted_to_user_ids: selectedUserIds.length > 0 ? selectedUserIds : [],
        };

        if (editingCoupon) {
            updateCouponMutation.mutate({ id: editingCoupon.id, ...couponData });
        } else {
            createCouponMutation.mutate(couponData);
        }
    };

    const handleToggleActive = (coupon: Coupon) => {
        updateCouponMutation.mutate({ id: coupon.id, is_active: !coupon.is_active });
    };

    const handleEdit = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setExpiryDate(coupon.expires_at ? new Date(coupon.expires_at) : undefined);
        setSelectedUserIds(coupon.restricted_to_user_ids || []);
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Coupon Management</h1>
                    <p className="text-muted-foreground mt-2">
                        Create and manage discounts for your customers.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="shadow-lg hover:scale-105 transition-all">
                            <Plus className="mr-2 h-4 w-4" /> Add Coupon
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editingCoupon ? "Edit Coupon" : "Create New Coupon"}</DialogTitle>
                            <DialogDescription>
                                Set the rules for your promotional discount.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Coupon Code</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="code" 
                                        name="code" 
                                        placeholder="E.g. SUMMER10" 
                                        defaultValue={editingCoupon?.code} 
                                        required 
                                        className="uppercase font-mono"
                                    />
                                    <Button type="button" variant="outline" size="icon" onClick={generateCode} title="Generate random code">
                                        <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="target">Apply To</Label>
                                    <select
                                        id="target"
                                        name="target"
                                        defaultValue={editingCoupon?.target || "all"}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="product">Products Only</option>
                                        <option value="shipping">Shipping Only</option>
                                        <option value="all">Everything (Cart Total)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="type">Discount Type</Label>
                                    <select
                                        id="type"
                                        name="type"
                                        defaultValue={editingCoupon?.type || "percentage"}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed_amount">Fixed Amount ($)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="value">Discount Value</Label>
                                    <Input 
                                        id="value" 
                                        name="value" 
                                        type="number" 
                                        step="0.01" 
                                        defaultValue={editingCoupon?.value} 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_uses">Max Uses (Optional)</Label>
                                    <Input 
                                        id="max_uses" 
                                        name="max_uses" 
                                        type="number" 
                                        defaultValue={editingCoupon?.max_uses || ""} 
                                        placeholder="Unlimited"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Expiry Date (Optional)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal relative pr-8",
                                                !expiryDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {expiryDate ? format(expiryDate, "PPP") : <span>Pick a date</span>}
                                            {expiryDate && (
                                                <div 
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-destructive cursor-pointer z-10 p-1"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setExpiryDate(undefined);
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </div>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={expiryDate}
                                            onSelect={setExpiryDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox 
                                    id="is_active" 
                                    name="is_active" 
                                    defaultChecked={editingCoupon?.is_active ?? true} 
                                />
                                <Label htmlFor="is_active" className="text-sm font-medium leading-none cursor-pointer">
                                    Keep this coupon active for checkout
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2 pt-2 border-t pt-4">
                                <Checkbox 
                                    id="one_use_per_user" 
                                    name="one_use_per_user" 
                                    defaultChecked={editingCoupon?.one_use_per_user ?? true} 
                                />
                                <Label htmlFor="one_use_per_user" className="text-sm font-medium leading-none cursor-pointer">
                                    Limit to one use per customer
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="restricted_to_user_ids">Restrict to Specific Customers (Optional)</Label>
                                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={userSearchOpen}
                                            className="w-full justify-between h-auto min-h-[40px] font-normal py-2"
                                        >
                                            <div className="flex flex-wrap gap-1 items-start max-w-[90%]">
                                                {selectedUserIds.length > 0 ? (
                                                    selectedUserIds.map(id => {
                                                        const user = users?.find(u => u.user_id === id);
                                                        return (
                                                            <Badge key={id} variant="secondary" className="text-[10px] h-5 py-0 px-1 font-medium bg-primary/10 text-primary border-primary/20 flex items-center gap-1 group">
                                                                {user?.full_name || "Unknown"}
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedUserIds(prev => prev.filter(i => i !== id));
                                                                    }}
                                                                    className="hover:text-destructive cursor-pointer"
                                                                >
                                                                    ×
                                                                </div>
                                                            </Badge>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-muted-foreground">Anyone can use</span>
                                                )}
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search customer by name or email..." className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>No customer found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="none"
                                                        onSelect={() => {
                                                            setSelectedUserIds([]);
                                                            setUserSearchOpen(false);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedUserIds.length === 0 ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        Anyone can use (Clear selection)
                                                    </CommandItem>
                                                    {users?.map((user) => (
                                                        <CommandItem
                                                            key={user.user_id}
                                                            value={`${user.full_name} ${user.email}`}
                                                            onSelect={() => {
                                                                setSelectedUserIds(prev => 
                                                                    prev.includes(user.user_id) 
                                                                        ? prev.filter(i => i !== user.user_id)
                                                                        : [...prev, user.user_id]
                                                                );
                                                            }}
                                                            className="cursor-pointer"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedUserIds.includes(user.user_id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-xs">{user.full_name}</span>
                                                                <span className="text-[9px] text-muted-foreground">{user.email}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Button type="submit" className="w-full mt-6" disabled={createCouponMutation.isPending || updateCouponMutation.isPending}>
                                {editingCoupon ? "Save Changes" : "Create Coupon"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Limits</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground animate-pulse">
                                    Loading coupons...
                                </TableCell>
                            </TableRow>
                        ) : coupons?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                    No coupons created yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            coupons?.map((coupon) => (
                                <TableRow key={coupon.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-mono font-bold text-primary">
                                        <div className="flex items-center gap-2 group">
                                            <span>{coupon.code}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CopyCell value={coupon.code} size={14} />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="capitalize text-xs font-medium">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full",
                                            coupon.target === 'all' ? "bg-purple-100 text-purple-700" :
                                            coupon.target === 'product' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                        )}>
                                            {coupon.target}
                                        </span>
                                    </TableCell>
                                    <TableCell className="capitalize text-xs">{coupon.type.replace('_', ' ')}</TableCell>
                                    <TableCell className="font-medium">
                                        {coupon.type === 'percentage' ? `${coupon.value}%` : `$${coupon.value.toFixed(2)}`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-semibold">{coupon.times_used} uses</span>
                                                {coupon.max_uses && (
                                                    <span className="text-[10px] text-muted-foreground">/ {coupon.max_uses} max</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {coupon.one_use_per_user && (
                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 bg-blue-50 text-blue-600 border-blue-200">Single Use</Badge>
                                                )}
                                                {coupon.restricted_to_user_ids && coupon.restricted_to_user_ids.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 mt-1 border-t border-amber-100 pt-1">
                                                        <span className="text-[8px] text-amber-700 font-bold uppercase tracking-wider">Restricted to:</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {coupon.restricted_to_user_ids.map(id => {
                                                                const user = users?.find(u => u.user_id === id);
                                                                return (
                                                                    <span key={id} className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded-sm border border-amber-200 truncate max-w-[120px]">
                                                                        {user?.full_name || "Unknown"}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {coupon.expires_at ? format(new Date(coupon.expires_at), "MMM d, yyyy") : "Never"}
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className={cn(
                                                "h-7 text-xs rounded-full px-3",
                                                coupon.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                                            )}
                                            onClick={() => handleToggleActive(coupon)}
                                        >
                                            {coupon.is_active ? "Active" : "Disabled"}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <SendCouponDialog 
                                                couponCode={coupon.code}
                                                discountDetails={coupon.type === 'percentage' ? `${coupon.value}% off ${coupon.target}` : `$${coupon.value.toFixed(2)} off ${coupon.target}`}
                                                expiresAt={coupon.expires_at ? format(new Date(coupon.expires_at), "MMM d, yyyy") : undefined}
                                                restrictedToUserIds={coupon.restricted_to_user_ids}
                                                trigger={
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" title="Send to Customers">
                                                        <Mail className="h-4 w-4" />
                                                    </Button>
                                                }
                                            />
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(coupon)}>
                                                <Ticket className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingCoupon(coupon)}>
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

            <AlertDialog open={!!deletingCoupon} onOpenChange={(open) => !open && setDeletingCoupon(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the coupon code <strong>{deletingCoupon?.code}</strong>. 
                            Existing orders using this coupon will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex justify-end gap-3 pt-4">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingCoupon && deleteCouponMutation.mutate(deletingCoupon.id)}
                        >
                            Delete Coupon
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Coupons;
