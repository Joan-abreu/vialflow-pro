import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Mail, 
    Loader2, 
    Send, 
    Search, 
    CheckSquare, 
    Square,
    Users as UsersIcon
} from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Customer {
    id: string;
    display_name: string;
    full_name?: string;
    email: string;
    role: string;
}

interface SendCouponDialogProps {
    couponCode: string;
    discountDetails: string;
    expiresAt?: string;
    restrictedToUserIds?: string[] | null;
    trigger?: React.ReactNode;
}

export const SendCouponDialog = ({ couponCode, discountDetails, expiresAt, restrictedToUserIds, trigger }: SendCouponDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingCustomers, setFetchingCustomers] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [personalNote, setPersonalNote] = useState("");

    const fetchCustomers = async () => {
        try {
            setFetchingCustomers(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch customers");

            const { users } = await response.json();
            // Include both customers and admins, filtering out hidden system accounts
            setCustomers(users.filter((u: any) => u.email !== 'hidden.admin@dev.com'));
        } catch (error: any) {
            console.error("Error fetching customers:", error);
            toast.error("Could not load customer list");
        } finally {
            setFetchingCustomers(false);
        }
    };

    useEffect(() => {
        if (open && customers.length === 0) {
            fetchCustomers();
        }
    }, [open]);

    const filteredCustomers = useMemo(() => {
        let result = customers;
        
        // Filter by restricted users if applicable
        if (restrictedToUserIds && restrictedToUserIds.length > 0) {
            result = result.filter(c => restrictedToUserIds.includes(c.id));
        }

        if (!searchQuery) return result;
        const query = searchQuery.toLowerCase();
        return result.filter(c => 
            c.email.toLowerCase().includes(query) || 
            (c.full_name || c.display_name || "").toLowerCase().includes(query)
        );
    }, [customers, searchQuery, restrictedToUserIds]);

    const toggleSelectAll = () => {
        if (selectedEmails.length === filteredCustomers.length) {
            setSelectedEmails([]);
        } else {
            setSelectedEmails(filteredCustomers.map(c => c.email));
        }
    };

    const toggleCustomer = (email: string) => {
        setSelectedEmails(prev => 
            prev.includes(email) 
                ? prev.filter(e => e !== email) 
                : [...prev, email]
        );
    };

    const handleSend = async () => {
        if (selectedEmails.length === 0) {
            toast.error("Please select at least one customer.");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("send-system-notification", {
                body: {
                    type: "coupon_promotion",
                    recipient: selectedEmails,
                    data: {
                        couponCode,
                        discountDetails,
                        expiresAt,
                        personalNote: personalNote.trim() || undefined
                    }
                }
            });

            if (error) throw error;

            toast.success(`Coupon sent to ${selectedEmails.length} customer(s)`);
            setOpen(false);
            setSelectedEmails([]);
            setPersonalNote("");
        } catch (error: any) {
            console.error("Error sending coupon:", error);
            toast.error("Failed to send: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Send to Customers
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <Mail className="h-5 w-5" />
                        Send Coupon: <span className="font-mono">{couponCode}</span>
                    </DialogTitle>
                    <DialogDescription>
                        Promote this discount to your customers. Selected recipients will receive a professional email with the code.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                    {/* Personal Note Section */}
                    <div className="grid gap-2">
                        <Label htmlFor="note" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Personal Note (Optional)</Label>
                        <Textarea 
                            id="note" 
                            value={personalNote} 
                            onChange={(e) => setPersonalNote(e.target.value)} 
                            placeholder="Add a custom message to the email..."
                            className="h-20 resize-none text-sm"
                        />
                    </div>

                    {/* Customer Selection Section */}
                    <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                                Select Recipients ({selectedEmails.length})
                            </Label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs"
                                onClick={toggleSelectAll}
                                disabled={filteredCustomers.length === 0}
                            >
                                {selectedEmails.length === filteredCustomers.length ? "Deselect All" : "Select All Filters"}
                            </Button>
                        </div>
                        
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                className="pl-9 h-9 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <ScrollArea className="h-[350px] w-full border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow className="h-10">
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead className="text-xs">Customer</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
                                        <TableHead className="text-xs">Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fetchingCustomers ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                                Loading recipients...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredCustomers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                                No users found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCustomers.map((customer) => {
                                            const isSelected = selectedEmails.includes(customer.email);
                                            return (
                                                <TableRow 
                                                    key={customer.id} 
                                                    className="h-10 cursor-pointer hover:bg-muted/30"
                                                    onClick={() => toggleCustomer(customer.email)}
                                                >
                                                    <TableCell className="p-0 text-center">
                                                        <Checkbox 
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleCustomer(customer.email)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-sm py-2">
                                                        {customer.full_name || customer.display_name || "N/A"}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground py-2">
                                                        {customer.email}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] capitalize",
                                                            customer.role === 'admin' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                                        )}>
                                                            {customer.role}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t">
                    <div className="flex w-full items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">
                            Sending from <span className="font-semibold">sales@livwellresearchlabs.com</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSend} 
                                disabled={loading || selectedEmails.length === 0} 
                                className="gap-2 shadow-md"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send to {selectedEmails.length} Customers
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
