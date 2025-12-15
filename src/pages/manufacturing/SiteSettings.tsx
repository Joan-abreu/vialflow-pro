import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";

const SiteSettings = () => {
    const [loading, setLoading] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("app_settings" as any)
                .select("*")
                .eq("key", "maintenance_mode")
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found

            if (data) {
                setMaintenanceMode((data as any).value === "true");
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

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Settings className="h-8 w-8" />
                Site Settings
            </h1>

            <div className="grid gap-6">
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
            </div>
        </div>
    );
};

export default SiteSettings;
