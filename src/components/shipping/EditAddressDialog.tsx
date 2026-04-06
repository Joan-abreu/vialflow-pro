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
import { Edit2, Loader2 } from "lucide-react";
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
                line1: currentAddress.line1 || "",
                line2: currentAddress.line2 || "",
                city: currentAddress.city || "",
                state: currentAddress.state || "",
                postal_code: currentAddress.postal_code || "",
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
            country: addr.country
        }));
    };

    const handleSave = async () => {
        if (!address.line1 || !address.city || !address.state || !address.postal_code) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from("orders")
                .update({ shipping_address: address })
                .eq("id", orderId);

            if (error) throw error;

            toast.success("Shipping address updated successfully.");
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Shipping Address</DialogTitle>
                    <DialogDescription>
                        Modify the destination address for this order.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="line1" className="text-xs uppercase tracking-wider text-muted-foreground">Address Line 1</Label>
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
                            placeholder="Suite 400"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="city" className="text-xs uppercase tracking-wider text-muted-foreground">City</Label>
                            <Input 
                                id="city" 
                                name="city" 
                                value={address.city} 
                                onChange={handleInputChange} 
                                placeholder="City"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="state" className="text-xs uppercase tracking-wider text-muted-foreground">State</Label>
                            <Input 
                                id="state" 
                                name="state" 
                                value={address.state} 
                                onChange={handleInputChange} 
                                placeholder="State"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="postal_code" className="text-xs uppercase tracking-wider text-muted-foreground">ZIP Code</Label>
                            <Input 
                                id="postal_code" 
                                name="postal_code" 
                                value={address.postal_code} 
                                onChange={handleInputChange} 
                                placeholder="12345"
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
