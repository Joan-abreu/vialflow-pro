import { useState, useEffect } from "react";
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
import { Edit2, Loader2, User, Phone } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete } from "./AddressAutocomplete";

interface EditAddressDialogProps {
    orderId: string;
    currentAddress: any;
    onSuccess: () => void;
    trigger?: React.ReactNode;
}

export const EditAddressDialog = ({ orderId, currentAddress, onSuccess, trigger }: EditAddressDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState({
        full_name: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US"
    });

    useEffect(() => {
        if (currentAddress) {
            setAddress({
                full_name: currentAddress.full_name || currentAddress.name || "",
                phone: currentAddress.phone || "",
                line1: currentAddress.line1 || "",
                line2: currentAddress.line2 || "",
                city: currentAddress.city || "",
                state: currentAddress.state || "",
                postal_code: currentAddress.postal_code || currentAddress.zip || "",
                country: currentAddress.country || "US"
            });
        }
    }, [currentAddress, open]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAddress(prev => ({ ...prev, [name]: value }));
    };

    const handleAutocompleteSelect = (addr: any) => {
        setAddress(prev => ({
            ...prev,
            line1: addr.line1,
            city: addr.city,
            state: addr.state,
            postal_code: addr.zip,
            country: addr.country || "US"
        }));
    };

    const handleSave = async () => {
        if (!address.full_name?.trim()) {
            toast.error("Please enter the recipient customer name.");
            return;
        }

        if (!address.line1 || !address.city || !address.state || !address.postal_code) {
            toast.error("Please fill in all required address fields.");
            return;
        }

        setLoading(true);
        try {
            const updatedAddress = {
                ...(typeof currentAddress === "object" && currentAddress !== null ? currentAddress : {}),
                ...address,
                full_name: address.full_name.trim(),
                phone: address.phone?.trim() || null,
            };

            const { error } = await supabase
                .from("orders")
                .update({ 
                    shipping_address: updatedAddress,
                    customer_name: updatedAddress.full_name || undefined
                })
                .eq("id", orderId);

            if (error) throw error;

            toast.success("Shipping address and recipient details updated successfully.");
            setOpen(false);
            onSuccess();
        } catch (error: any) {
            console.error("Error updating address:", error);
            toast.error("Failed to update shipping address: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary">
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Address
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Update Recipient &amp; Shipping Address</DialogTitle>
                    <DialogDescription>
                        Modify the recipient name, phone, and destination address for this order.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Recipient Full Name and Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="full_name" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                                <User className="h-3.5 w-3.5 text-primary" />
                                Recipient Name *
                            </Label>
                            <Input 
                                id="full_name" 
                                name="full_name" 
                                value={address.full_name} 
                                onChange={handleInputChange} 
                                placeholder="e.g. Jane Doe"
                                required
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                                <Phone className="h-3.5 w-3.5 text-primary" />
                                Phone Number
                            </Label>
                            <Input 
                                id="phone" 
                                name="phone" 
                                value={address.phone} 
                                onChange={handleInputChange} 
                                placeholder="e.g. (407) 555-0199"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="line1" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Address Line 1 *</Label>
                        <AddressAutocomplete 
                            value={address.line1}
                            onSelectAddress={handleAutocompleteSelect}
                            onChange={(val) => setAddress(prev => ({ ...prev, line1: val }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="line2" className="text-xs uppercase tracking-wider text-muted-foreground">Suite / Apt (Optional)</Label>
                        <Input 
                            id="line2" 
                            name="line2" 
                            value={address.line2} 
                            onChange={handleInputChange} 
                            placeholder="Apt 501, Suite 200, etc."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="city" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">City *</Label>
                            <Input 
                                id="city" 
                                name="city" 
                                value={address.city} 
                                onChange={handleInputChange} 
                                placeholder="City"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="state" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">State *</Label>
                            <Input 
                                id="state" 
                                name="state" 
                                value={address.state} 
                                onChange={handleInputChange} 
                                placeholder="State (e.g. FL)"
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="postal_code" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">ZIP Code *</Label>
                            <Input 
                                id="postal_code" 
                                name="postal_code" 
                                value={address.postal_code} 
                                onChange={handleInputChange} 
                                placeholder="12345"
                                required
                            />
                        </div>
                        <div className="grid gap-2 opacity-70">
                            <Label htmlFor="country" className="text-xs uppercase tracking-wider text-muted-foreground">Country</Label>
                            <Input 
                                id="country" 
                                value="US" 
                                readOnly 
                                className="bg-muted cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
