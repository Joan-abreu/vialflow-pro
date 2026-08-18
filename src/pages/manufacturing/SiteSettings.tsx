import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Settings, Truck, Clock, Save, ShieldCheck } from "lucide-react";
import { DEFAULT_SHIPPING_CONFIG } from "@/config/shippingConfig";

const TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (ET / New York)" },
    { value: "America/Chicago", label: "Central Time (CT / Chicago)" },
    { value: "America/Denver", label: "Mountain Time (MT / Denver)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT / Los Angeles)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const SiteSettings = () => {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [requireResearchAck, setRequireResearchAck] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingResearchAck, setSavingResearchAck] = useState(false);
    const [savingShipping, setSavingShipping] = useState(false);

    // Shipping & Cutoff Settings
    const [cutoffHour, setCutoffHour] = useState<number>(DEFAULT_SHIPPING_CONFIG.cutoffHour);
    const [cutoffMinute, setCutoffMinute] = useState<number>(DEFAULT_SHIPPING_CONFIG.cutoffMinute);
    const [timeZone, setTimeZone] = useState<string>(DEFAULT_SHIPPING_CONFIG.timeZone);
    const [cutoffDisplayLabel, setCutoffDisplayLabel] = useState<string>(DEFAULT_SHIPPING_CONFIG.cutoffDisplayLabel);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(DEFAULT_SHIPPING_CONFIG.freeShippingThreshold);
    const [deliveryMinDays, setDeliveryMinDays] = useState<number>(DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.min);
    const [deliveryMaxDays, setDeliveryMaxDays] = useState<number>(DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.max);
    const [shipsSaturday, setShipsSaturday] = useState<boolean>(DEFAULT_SHIPPING_CONFIG.shipsOnSaturday);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("app_settings" as any)
                .select("*")
                .in("key", [
                    "maintenance_mode", 
                    "require_research_acknowledgment",
                    "shipping_cutoff_hour",
                    "shipping_cutoff_minute",
                    "shipping_timezone",
                    "shipping_cutoff_label",
                    "shipping_free_threshold",
                    "shipping_delivery_min_days",
                    "shipping_delivery_max_days",
                    "shipping_ships_saturday"
                ]);

            if (error) throw error;

            if (data) {
                const maintenance = data.find((s: any) => s.key === "maintenance_mode");
                const researchAck = data.find((s: any) => s.key === "require_research_acknowledgment");
                const hour = data.find((s: any) => s.key === "shipping_cutoff_hour");
                const min = data.find((s: any) => s.key === "shipping_cutoff_minute");
                const tz = data.find((s: any) => s.key === "shipping_timezone");
                const label = data.find((s: any) => s.key === "shipping_cutoff_label");
                const threshold = data.find((s: any) => s.key === "shipping_free_threshold");
                const minDays = data.find((s: any) => s.key === "shipping_delivery_min_days");
                const maxDays = data.find((s: any) => s.key === "shipping_delivery_max_days");
                const sat = data.find((s: any) => s.key === "shipping_ships_saturday");

                if (maintenance) setMaintenanceMode(maintenance.value === "true");
                if (researchAck) setRequireResearchAck(researchAck.value === "true");
                if (hour) setCutoffHour(Number(hour.value));
                if (min) setCutoffMinute(Number(min.value));
                if (tz) setTimeZone(tz.value);
                if (label) setCutoffDisplayLabel(label.value);
                if (threshold) setFreeShippingThreshold(Number(threshold.value));
                if (minDays) setDeliveryMinDays(Number(minDays.value));
                if (maxDays) setDeliveryMaxDays(Number(maxDays.value));
                if (sat) setShipsSaturday(sat.value === "true");
            }
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            toast.error("Failed to load site settings");
        } finally {
            setLoading(false);
        }
    };

    const handleMaintenanceToggle = async (checked: boolean) => {
        setMaintenanceMode(checked);
        setSaving(true);

        try {
            const { error } = await supabase
                .from("app_settings" as any)
                .upsert({
                    key: "maintenance_mode",
                    value: String(checked),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success(`Maintenance mode ${checked ? "enabled" : "disabled"}`);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
            setMaintenanceMode(!checked); // Revert UI on error
        } finally {
            setSaving(false);
        }
    };

    const handleResearchAckToggle = async (checked: boolean) => {
        setRequireResearchAck(checked);
        setSavingResearchAck(true);

        try {
            const { error } = await supabase
                .from("app_settings" as any)
                .upsert({
                    key: "require_research_acknowledgment",
                    value: String(checked),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success(`Research acknowledgment requirement ${checked ? "enabled" : "disabled"}`);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
            setRequireResearchAck(!checked); // Revert UI on error
        } finally {
            setSavingResearchAck(false);
        }
    };

    const updateAutoCutoffLabel = (hour: number, minute: number, tz: string) => {
        const isPM = hour >= 12;
        const displayH = hour % 12 === 0 ? 12 : hour % 12;
        const displayM = minute > 0 ? `:${String(minute).padStart(2, '0')}` : ':00';
        const ampm = isPM ? 'PM' : 'AM';
        
        let tzCode = 'ET';
        if (tz.includes('Central')) tzCode = 'CT';
        else if (tz.includes('Mountain') || tz.includes('Phoenix')) tzCode = 'MT';
        else if (tz.includes('Los_Angeles')) tzCode = 'PT';
        
        setCutoffDisplayLabel(`${displayH}${displayM} ${ampm} ${tzCode}`);
    };

    const handleSaveShippingSettings = async () => {
        setSavingShipping(true);
        const now = new Date().toISOString();

        try {
            const updates = [
                { key: "shipping_cutoff_hour", value: String(cutoffHour), updated_at: now },
                { key: "shipping_cutoff_minute", value: String(cutoffMinute), updated_at: now },
                { key: "shipping_timezone", value: timeZone, updated_at: now },
                { key: "shipping_cutoff_label", value: cutoffDisplayLabel, updated_at: now },
                { key: "shipping_free_threshold", value: String(freeShippingThreshold), updated_at: now },
                { key: "shipping_delivery_min_days", value: String(deliveryMinDays), updated_at: now },
                { key: "shipping_delivery_max_days", value: String(deliveryMaxDays), updated_at: now },
                { key: "shipping_ships_saturday", value: String(shipsSaturday), updated_at: now },
            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            // Invalidate cache so all storefront badges update instantly
            queryClient.invalidateQueries({ queryKey: ['shipping_app_settings'] });

            toast.success("Shipping & Cutoff Time settings saved successfully!");
        } catch (error: any) {
            console.error("Error saving shipping settings:", error);
            toast.error("Failed to save shipping settings");
        } finally {
            setSavingShipping(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Settings className="h-8 w-8 text-primary" />
                Site Settings
            </h1>

            <div className="space-y-8">
                {/* 1. Maintenance Mode */}
                <Card>
                    <CardHeader>
                        <CardTitle>Global Access Controls</CardTitle>
                        <CardDescription>
                            Manage public access to the website.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Maintenance Mode</Label>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, public visitors will see a maintenance page. <br />
                                    <strong>Admin users can still access the Manufacture Dashboard and login page.</strong>
                                </p>
                            </div>
                            <Switch
                                checked={maintenanceMode}
                                onCheckedChange={handleMaintenanceToggle}
                                disabled={saving}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Storefront Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Storefront Compliance</CardTitle>
                        <CardDescription>
                            Configure customer compliance and legal acknowledgment requirements.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Require Research Acknowledgment</Label>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, customers must acknowledge that products are for laboratory research use only (RUO) and agree to the Terms & Conditions before proceeding to checkout and submitting payment.
                                </p>
                            </div>
                            <Switch
                                checked={requireResearchAck}
                                onCheckedChange={handleResearchAckToggle}
                                disabled={savingResearchAck}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Shipping & Cutoff Time Configuration */}
                <Card>
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2 text-primary">
                            <Truck className="h-5 w-5" />
                            <CardTitle className="text-xl">Same-Day Shipping & Cutoff Settings</CardTitle>
                        </div>
                        <CardDescription>
                            Configure same-day fulfillment cutoff times, delivery estimates, and shipping badges displayed on all product pages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Cutoff Time */}
                            <div className="space-y-2">
                                <Label htmlFor="cutoffHour" className="flex items-center gap-1.5 font-semibold">
                                    <Clock className="h-4 w-4 text-emerald-600" />
                                    Same-Day Shipping Cutoff Time
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={String(cutoffHour)}
                                        onValueChange={(val) => {
                                            const newH = Number(val);
                                            setCutoffHour(newH);
                                            updateAutoCutoffLabel(newH, cutoffMinute, timeZone);
                                        }}
                                    >
                                        <SelectTrigger id="cutoffHour">
                                            <SelectValue placeholder="Hour" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="6">6:00 AM</SelectItem>
                                            <SelectItem value="7">7:00 AM</SelectItem>
                                            <SelectItem value="8">8:00 AM</SelectItem>
                                            <SelectItem value="9">9:00 AM</SelectItem>
                                            <SelectItem value="10">10:00 AM</SelectItem>
                                            <SelectItem value="11">11:00 AM</SelectItem>
                                            <SelectItem value="12">12:00 PM (Noon)</SelectItem>
                                            <SelectItem value="13">1:00 PM</SelectItem>
                                            <SelectItem value="14">2:00 PM</SelectItem>
                                            <SelectItem value="15">3:00 PM</SelectItem>
                                            <SelectItem value="16">4:00 PM</SelectItem>
                                            <SelectItem value="17">5:00 PM</SelectItem>
                                            <SelectItem value="18">6:00 PM</SelectItem>
                                            <SelectItem value="19">7:00 PM</SelectItem>
                                            <SelectItem value="20">8:00 PM</SelectItem>
                                            <SelectItem value="21">9:00 PM</SelectItem>
                                            <SelectItem value="22">10:00 PM</SelectItem>
                                            <SelectItem value="23">11:00 PM</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={String(cutoffMinute)}
                                        onValueChange={(val) => {
                                            const newM = Number(val);
                                            setCutoffMinute(newM);
                                            updateAutoCutoffLabel(cutoffHour, newM, timeZone);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Minute" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">:00</SelectItem>
                                            <SelectItem value="15">:15</SelectItem>
                                            <SelectItem value="30">:30</SelectItem>
                                            <SelectItem value="45">:45</SelectItem>
                                            <SelectItem value="59">:59</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Orders placed before this hour will show the live <em>"Order within Xh Ym · ships today"</em> countdown.
                                </p>
                            </div>

                            {/* Timezone */}
                            <div className="space-y-2">
                                <Label htmlFor="timeZone" className="font-semibold">
                                    Fulfillment Time Zone
                                </Label>
                                <Select 
                                    value={timeZone} 
                                    onValueChange={(val) => {
                                        setTimeZone(val);
                                        updateAutoCutoffLabel(cutoffHour, cutoffMinute, val);
                                    }}
                                >
                                    <SelectTrigger id="timeZone">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    The time zone where your shipping facility processes orders.
                                </p>
                            </div>

                            {/* Cutoff Label */}
                            <div className="space-y-2">
                                <Label htmlFor="cutoffDisplayLabel" className="font-semibold">
                                    Cutoff Subtitle Label (Public Badge)
                                </Label>
                                <Input
                                    id="cutoffDisplayLabel"
                                    value={cutoffDisplayLabel}
                                    onChange={(e) => setCutoffDisplayLabel(e.target.value)}
                                    placeholder="e.g. 6:00 PM ET"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Text shown under the countdown (e.g. <em>"Cutoff {cutoffDisplayLabel || '6:00 PM ET'}"</em>).
                                </p>
                            </div>

                            {/* Free Shipping Threshold */}
                            <div className="space-y-2">
                                <Label htmlFor="freeShippingThreshold" className="font-semibold">
                                    Free Shipping Order Threshold ($ USD)
                                </Label>
                                <Input
                                    id="freeShippingThreshold"
                                    type="number"
                                    min="0"
                                    value={freeShippingThreshold}
                                    onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
                                    placeholder="100"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Displayed as <em>"Free standard shipping on orders over ${freeShippingThreshold}"</em>.
                                </p>
                            </div>

                            {/* Estimated Delivery Window */}
                            <div className="space-y-2 md:col-span-2">
                                <Label className="font-semibold">
                                    Estimated Delivery Window (Business Days)
                                </Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Min days:</span>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="10"
                                            className="w-20"
                                            value={deliveryMinDays}
                                            onChange={(e) => setDeliveryMinDays(Number(e.target.value))}
                                        />
                                    </div>
                                    <span className="text-muted-foreground font-bold">–</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Max days:</span>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="15"
                                            className="w-20"
                                            value={deliveryMaxDays}
                                            onChange={(e) => setDeliveryMaxDays(Number(e.target.value))}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        (Calculates dynamic arrival calendar dates on product pages)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/20">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Ship On Saturdays</Label>
                                <p className="text-xs text-muted-foreground">
                                    Enable if your warehouse also processes and ships carrier packages on Saturdays.
                                </p>
                            </div>
                            <Switch
                                checked={shipsSaturday}
                                onCheckedChange={setShipsSaturday}
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={handleSaveShippingSettings}
                                disabled={savingShipping}
                                className="font-bold min-w-[200px]"
                            >
                                {savingShipping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Shipping Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SiteSettings;

