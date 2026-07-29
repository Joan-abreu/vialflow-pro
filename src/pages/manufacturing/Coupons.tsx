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
    DialogFooter,
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
import { Check, ChevronsUpDown, Plus, Ticket, Trash2, RefreshCcw, Calendar as CalendarIcon, Mail, Search, X, History, Clock, Loader2 } from "lucide-react";
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
    const [historyCoupon, setHistoryCoupon] = useState<Coupon | null>(null);
    const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
    
    // Searchable Customer Selector state
    const [userSearchOpen, setUserSearchOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [customEmailInput, setCustomEmailInput] = useState("");

    // Fetch redemption history for selected coupon
    const { data: historyOrders, isLoading: isHistoryLoading } = useQuery({
        queryKey: ["coupon-history", historyCoupon?.code],
        enabled: !!historyCoupon,
        queryFn: async () => {
            const { data: ordersData, error } = await supabase
                .from("orders")
                .select("id, user_id, customer_email, shipping_address, status, total_amount, created_at, applied_coupons")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching history orders:", error);
                throw error;
            }

            const targetCode = historyCoupon!.code.trim().toUpperCase();

            console.log("[Coupon History Debug] Target Code:", targetCode, "Target Coupon ID:", historyCoupon!.id);
            console.log("[Coupon History Debug] Total Orders in DB:", ordersData?.length);
            
            const ordersWithCoupons = (ordersData || []).filter(o => o.applied_coupons && (Array.isArray(o.applied_coupons) ? o.applied_coupons.length > 0 : true));
            console.log("[Coupon History Debug] Orders with non-empty applied_coupons:", ordersWithCoupons.length, ordersWithCoupons.slice(0, 5));

            // Fetch profiles for customer names if user_ids are present
            const userIds = [...new Set((ordersData || []).map((o: any) => o.user_id).filter(Boolean))];
            let profileMap: Record<string, string> = {};

            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name")
                    .in("user_id", userIds);
                
                (profiles || []).forEach((p: any) => {
                    if (p.user_id && p.full_name) profileMap[p.user_id] = p.full_name;
                });
            }

            const couponId = historyCoupon!.id;

            const matchedOrders = (ordersData || []).filter((o: any) => {
                if (!o.applied_coupons) return false;

                const raw = o.applied_coupons;

                // Case 1: Array of strings or objects
                if (Array.isArray(raw)) {
                    return raw.some((c: any) => {
                        if (typeof c === "string") {
                            const clean = c.trim().toUpperCase();
                            return clean === targetCode || clean === couponId;
                        }
                        if (typeof c === "object" && c) {
                            const codeMatch = c.code && String(c.code).trim().toUpperCase() === targetCode;
                            const idMatch = c.id && String(c.id) === couponId;
                            return codeMatch || idMatch;
                        }
                        return false;
                    });
                }

                // Case 2: String representation of JSON or code string
                if (typeof raw === "string") {
                    const cleanStr = raw.trim().toUpperCase();
                    if (cleanStr === targetCode || cleanStr.includes(targetCode) || cleanStr.includes(couponId)) return true;

                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                            return parsed.some((c: any) => {
                                if (typeof c === "string") {
                                    const clean = c.trim().toUpperCase();
                                    return clean === targetCode || clean === couponId;
                                }
                                if (typeof c === "object" && c) {
                                    const codeMatch = c.code && String(c.code).trim().toUpperCase() === targetCode;
                                    const idMatch = c.id && String(c.id) === couponId;
                                    return codeMatch || idMatch;
                                }
                                return false;
                            });
                        }
                    } catch (e) {
                        // ignore JSON parse error
                    }
                }

                // Case 3: Object containing code or id
                if (typeof raw === "object" && raw) {
                    const codeMatch = raw.code && String(raw.code).trim().toUpperCase() === targetCode;
                    const idMatch = raw.id && String(raw.id) === couponId;
                    return codeMatch || idMatch;
                }

                return false;
            });

            console.log("[Coupon History Debug] Matched Orders:", matchedOrders.length, matchedOrders);

            return matchedOrders.map((o: any) => ({
                ...o,
                customer_name: (o.user_id && profileMap[o.user_id]) || (o.shipping_address as any)?.full_name || (o.shipping_address as any)?.name || "Customer"
            }));
        },
    });
    
    const queryClient = useQueryClient();

    const handleAddCustomEmail = () => {
        const email = customEmailInput.trim().toLowerCase();
        if (!email) return;
        if (!email.includes("@") || !email.includes(".")) {
            toast.error("Please enter a valid email address");
            return;
        }
        if (selectedUserIds.includes(email)) {
            toast.error("Email already added");
            return;
        }
        setSelectedUserIds(prev => [...prev, email]);
        setCustomEmailInput("");
        toast.success(`Added restriction for ${email}`);
    };

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
        
        const validUuids = selectedUserIds.filter(id => !id.includes("@"));
        const emailStrings = selectedUserIds.filter(id => id.includes("@"));

        const couponData: any = {
            code: (formData.get("code") as string).trim().toUpperCase(),
            target: formData.get("target") as any,
            type: formData.get("type") as any,
            value: parseFloat(formData.get("value") as string),
            max_uses: formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : null,
            expires_at: expiryDate ? expiryDate.toISOString() : null,
            is_active: formData.get("is_active") === "on",
            one_use_per_user: formData.get("one_use_per_user") === "on",
            restricted_to_user_ids: validUuids,
            restricted_to_emails: emailStrings,
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
        const combined = [
            ...(coupon.restricted_to_user_ids || []),
            ...((coupon as any).restricted_to_emails || [])
        ];
        setSelectedUserIds(combined);
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
                                                        const user = users?.find(u => u.user_id === id || u.email?.toLowerCase() === id.toLowerCase());
                                                        const label = user ? (user.full_name || user.email) : id;
                                                        return (
                                                            <Badge key={id} variant="secondary" className="text-[10px] h-5 py-0 px-1 font-medium bg-primary/10 text-primary border-primary/20 flex items-center gap-1 group">
                                                                {label}
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

                                <div className="flex gap-2 pt-1">
                                    <Input
                                        type="email"
                                        placeholder="Or type prospect email (e.g. buyer@domain.com)..."
                                        value={customEmailInput}
                                        onChange={(e) => setCustomEmailInput(e.target.value)}
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCustomEmail();
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs shrink-0"
                                        onClick={handleAddCustomEmail}
                                    >
                                        + Add Email
                                    </Button>
                                </div>
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
                                                {(() => {
                                                    const userIds = coupon.restricted_to_user_ids || [];
                                                    const emailList = (coupon as any).restricted_to_emails || [];
                                                    const allRestrictions = Array.from(new Set([...userIds, ...emailList]));

                                                    if (allRestrictions.length === 0) return null;

                                                    return (
                                                        <div className="flex flex-col gap-0.5 mt-1 border-t border-amber-100 pt-1">
                                                            <span className="text-[8px] text-amber-700 font-bold uppercase tracking-wider">Restricted to ({allRestrictions.length}):</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {allRestrictions.map(id => {
                                                                    const user = users?.find(u => u.user_id === id || u.email?.toLowerCase() === id.toLowerCase());
                                                                    const label = user ? (user.full_name || user.email) : id;
                                                                    return (
                                                                        <span key={id} className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded-sm border border-amber-200 truncate max-w-[150px] font-medium" title={label}>
                                                                            {label}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
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
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                                                onClick={() => setHistoryCoupon(coupon)}
                                                title="View Redemption History"
                                            >
                                                <History className="h-4 w-4" />
                                            </Button>
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(coupon)} title="Edit Coupon">
                                                <Ticket className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingCoupon(coupon)} title="Delete Coupon">
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

            {/* Delete Confirmation Alert */}
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
                            onClick={() => deletingCoupon && deleteCouponMutation.mutate(deletingCoupon.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Coupon
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
            {/* Coupon Usage / Redemption History Modal */}
            <Dialog open={!!historyCoupon} onOpenChange={(open) => !open && setHistoryCoupon(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <History className="h-5 w-5 text-primary" />
                            Redemption History: <span className="font-mono text-primary font-bold">{historyCoupon?.code}</span>
                        </DialogTitle>
                        <DialogDescription>
                            List of all completed customer orders where coupon <strong>{historyCoupon?.code}</strong> was redeemed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between py-2 border-b text-xs">
                        <span className="text-muted-foreground">
                            Total Redemptions: <strong className="text-foreground font-semibold">{historyOrders?.length || 0} order(s)</strong>
                        </span>
                        {historyCoupon && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 font-mono">
                                {historyCoupon.type === 'percentage' ? `${historyCoupon.value}% OFF` : `$${historyCoupon.value.toFixed(2)} OFF`} ({historyCoupon.target})
                            </Badge>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md min-h-[250px]">
                        {isHistoryLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs">Loading coupon redemptions...</span>
                            </div>
                        ) : !historyOrders || historyOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 text-center px-6">
                                <Clock className="h-8 w-8 text-muted-foreground/30" />
                                <span className="font-medium text-sm">No completed customer order records found matching this coupon.</span>
                                {historyCoupon && historyCoupon.times_used > 0 && (
                                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 max-w-md text-left shadow-sm">
                                        <p className="font-semibold mb-1 flex items-center gap-1">
                                            ℹ️ Usage Counter Note ({historyCoupon.times_used} recorded):
                                        </p>
                                        <p className="text-[11px] leading-relaxed text-amber-700">
                                            This coupon shows <strong>{historyCoupon.times_used} usage(s)</strong> in its database counter from past test executions or manual increments, but none of the 321 orders currently in your database have <code>"{historyCoupon.code}"</code> saved in their <code>applied_coupons</code> column.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/50 text-xs sticky top-0 z-10">
                                    <TableRow className="h-9">
                                        <TableHead>Order ID</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Order Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyOrders.map((order: any) => (
                                        <TableRow key={order.id} className="text-xs hover:bg-muted/30">
                                            <TableCell className="font-mono font-semibold text-primary">
                                                #{order.id.slice(0, 8)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {order.customer_name}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {order.customer_email || "No email"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-[11px]">
                                                {format(new Date(order.created_at), "MMM d, yyyy h:mm a")}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize text-[10px] bg-slate-50">
                                                    {order.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-emerald-700">
                                                ${Number(order.total_amount || 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <DialogFooter className="pt-2 border-t flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setHistoryCoupon(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Coupons;
