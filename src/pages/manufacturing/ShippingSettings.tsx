import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Package, Save, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressAutocomplete } from "@/components/shipping/AddressAutocomplete";

interface CarrierSettings {
    id: string;
    carrier: string;
    is_active: boolean;
    is_production: boolean;
    client_id: string | null;
    client_secret: string | null;
    account_number: string | null;
    api_key: string | null;
    meter_number: string | null;
    api_url: string | null;
    tracking_client_id: string | null;
    tracking_client_secret: string | null;
    default_service_code: string | null;
    default_package_type: string | null;
    shipper_name: string | null;
    shipper_address: any;
    shipper_phone: string | null;
    shipper_email: string | null;
    config: any;
}

const ShippingSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [carriers, setCarriers] = useState<CarrierSettings[]>([]);
    const [selectedCarrier, setSelectedCarrier] = useState<string>("UPS");
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchCarriers();
    }, []);

    const fetchCarriers = async () => {
        try {
            const { data, error } = await supabase
                .from("carrier_settings")
                .select("*")
                .order("carrier");

            if (error) throw error;
            setCarriers((data as unknown as CarrierSettings[]) || []);
        } catch (error: any) {
            console.error("Error fetching carriers:", error);
            toast.error("Failed to load carrier settings");
        } finally {
            setLoading(false);
        }
    };

    const updateCarrier = async (carrier: string, updates: Partial<CarrierSettings>) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from("carrier_settings")
                .update(updates)
                .eq("carrier", carrier);

            if (error) throw error;

            toast.success(`${carrier} settings updated successfully`);
            fetchCarriers();
        } catch (error: any) {
            console.error("Error updating carrier:", error);
            toast.error("Failed to update carrier settings");
        } finally {
            setSaving(false);
        }
    };

    const toggleCarrierActive = async (carrier: string, isActive: boolean) => {
        await updateCarrier(carrier, { is_active: isActive });
    };

    const toggleProduction = async (carrier: string, isProduction: boolean) => {
        await updateCarrier(carrier, { is_production: isProduction });
    };

    const handleSaveCarrier = async (formData: any) => {
        const { id, created_at, updated_at, carrier: carrierName, ...updates } = formData;
        await updateCarrier(carrierName, updates);
    };

    const initializeShippo = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from("carrier_settings")
                .insert({
                    carrier: "SHIPPO",
                    is_active: true,
                    api_url: "https://api.goshippo.com/",
                    config: {}
                });

            if (error) throw error;

            toast.success("Shippo carrier initialized successfully");
            fetchCarriers();
            setSelectedCarrier("SHIPPO");
        } catch (error: any) {
            console.error("Error initializing Shippo:", error);
            toast.error("Failed to initialize Shippo");
        } finally {
            setSaving(false);
        }
    };

    const CarrierForm = ({ carrier }: { carrier: CarrierSettings }) => {
        const [formData, setFormData] = useState<CarrierSettings>(carrier);

        useEffect(() => {
            setFormData(carrier);
        }, [carrier]);

        const handleChange = (field: keyof CarrierSettings, value: any) => {
            setFormData(prev => ({ ...prev, [field]: value }));
        };

        const handleAddressChange = (field: string | any, value?: string) => {
            if (typeof field === 'object' && !value) {
                // Bulk update from autocomplete
                setFormData(prev => ({
                    ...prev,
                    shipper_address: {
                        ...(prev.shipper_address || {}),
                        ...field
                    }
                }));
                return;
            }

            setFormData(prev => ({
                ...prev,
                shipper_address: {
                    ...(prev.shipper_address || {}),
                    [field]: value
                }
            }));
        };

        return (
            <div className="space-y-6">
                {/* Status Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    {carrier.carrier} Configuration
                                </CardTitle>
                                <CardDescription>
                                    Configure API credentials and settings for {carrier.carrier}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge variant={formData.is_active ? "default" : "secondary"}>
                                    {formData.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant={formData.is_production ? "destructive" : "outline"}>
                                    {formData.is_production ? "Production" : "Sandbox"}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Enable {carrier.carrier}</Label>
                                <p className="text-sm text-muted-foreground">
                                    Activate this carrier for shipping
                                </p>
                            </div>
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(checked) => {
                                    handleChange('is_active', checked);
                                    toggleCarrierActive(carrier.carrier, checked);
                                }}
                            />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Production Mode</Label>
                                <p className="text-sm text-muted-foreground">
                                    Use production API (charges real money)
                                </p>
                            </div>
                            <Switch
                                checked={formData.is_production}
                                onCheckedChange={(checked) => {
                                    handleChange('is_production', checked);
                                    toggleProduction(carrier.carrier, checked);
                                }}
                            />
                        </div>

                        {!formData.is_production && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Sandbox mode is active. No real charges will be made.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* API Credentials */}
                <Card>
                    <CardHeader>
                        <CardTitle>API Credentials</CardTitle>
                        <CardDescription>
                            Enter your {carrier.carrier} API credentials
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            {carrier.carrier !== "SHIPPO" && (
                                <div className="space-y-2">
                                    <Label htmlFor={`${carrier.carrier}_client_id`}>Client ID (Shipping)</Label>
                                    <Input
                                        id={`${carrier.carrier}_client_id`}
                                        name={`${carrier.carrier}_client_id`}
                                        autoComplete="off"
                                        value={formData.client_id || ""}
                                        onChange={(e) => handleChange('client_id', e.target.value)}
                                        placeholder="Enter client ID"
                                    />
                                </div>
                            )}

                            {carrier.carrier !== "SHIPPO" && (
                                <div className="space-y-2">
                                    <Label htmlFor={`${carrier.carrier}_client_secret`}>Client Secret (Shipping)</Label>
                                    <div className="relative">
                                        <Input
                                            id={`${carrier.carrier}_client_secret`}
                                            name={`${carrier.carrier}_client_secret`}
                                            autoComplete="new-password"
                                            type={showSecrets[carrier.carrier] ? "text" : "password"}
                                            value={formData.client_secret || ""}
                                            onChange={(e) => handleChange('client_secret', e.target.value)}
                                            placeholder="Enter client secret"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full"
                                            onClick={() => setShowSecrets(prev => ({
                                                ...prev,
                                                [carrier.carrier]: !prev[carrier.carrier]
                                            }))}
                                        >
                                            {showSecrets[carrier.carrier] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {carrier.carrier === "SHIPPO" && (
                                <div className="space-y-2">
                                    <Label htmlFor={`${carrier.carrier}_api_token`}>Shippo API Token</Label>
                                    <div className="relative">
                                        <Input
                                            id={`${carrier.carrier}_api_token`}
                                            name={`${carrier.carrier}_api_token`}
                                            autoComplete="new-password"
                                            type={showSecrets[carrier.carrier] ? "text" : "password"}
                                            value={formData.api_key || ""}
                                            onChange={(e) => handleChange('api_key', e.target.value)}
                                            placeholder="shippo_test_..."
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full"
                                            onClick={() => setShowSecrets(prev => ({
                                                ...prev,
                                                [carrier.carrier]: !prev[carrier.carrier]
                                            }))}
                                        >
                                            {showSecrets[carrier.carrier] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Use your {formData.is_production ? 'Live' : 'Test'} token from the Shippo dashboard.
                                    </p>
                                </div>
                            )}

                            {carrier.carrier === "FEDEX" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor={`${carrier.carrier}_tracking_client_id`}>Tracking Client ID (Optional)</Label>
                                        <Input
                                            id={`${carrier.carrier}_tracking_client_id`}
                                            name={`${carrier.carrier}_tracking_client_id`}
                                            autoComplete="off"
                                            value={formData.tracking_client_id || ""}
                                            onChange={(e) => handleChange('tracking_client_id', e.target.value)}
                                            placeholder="Enter tracking-specific client ID"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Use this if your tracking credentials are different from shipping
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`${carrier.carrier}_tracking_client_secret`}>Tracking Client Secret (Optional)</Label>
                                        <div className="relative">
                                            <Input
                                                id={`${carrier.carrier}_tracking_client_secret`}
                                                name={`${carrier.carrier}_tracking_client_secret`}
                                                autoComplete="new-password"
                                                type={showSecrets[`${carrier.carrier}_TRACK`] ? "text" : "password"}
                                                value={formData.tracking_client_secret || ""}
                                                onChange={(e) => handleChange('tracking_client_secret', e.target.value)}
                                                placeholder="Enter tracking-specific client secret"
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-full"
                                                onClick={() => setShowSecrets(prev => ({
                                                    ...prev,
                                                    [`${carrier.carrier}_TRACK`]: !prev[`${carrier.carrier}_TRACK`]
                                                }))}
                                            >
                                                {showSecrets[`${carrier.carrier}_TRACK`] ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {carrier.carrier !== "SHIPPO" && (
                                <div className="space-y-2">
                                    <Label htmlFor={`${carrier.carrier}_account_number`}>Account Number</Label>
                                    <Input
                                        id={`${carrier.carrier}_account_number`}
                                        name={`${carrier.carrier}_account_number`}
                                        autoComplete="off"
                                        value={formData.account_number || ""}
                                        onChange={(e) => handleChange('account_number', e.target.value)}
                                        placeholder="Enter account number"
                                    />
                                </div>
                            )}


                            {carrier.carrier === "FEDEX" && (
                                <div className="space-y-2">
                                    <Label htmlFor="meter_number">Meter Number (Optional)</Label>
                                    <Input
                                        id="meter_number"
                                        value={formData.meter_number || ""}
                                        onChange={(e) => handleChange('meter_number', e.target.value)}
                                        placeholder="Enter meter number (not required for modern API)"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Meter number is optional in recent FedEx REST API versions
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="api_url">API URL</Label>
                                <Input
                                    id="api_url"
                                    value={formData.api_url || ""}
                                    onChange={(e) => handleChange('api_url', e.target.value)}
                                    placeholder="https://api.carrier.com"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {formData.is_production ? "Production API URL" : "Sandbox API URL"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Shipper Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Shipper Information</CardTitle>
                        <CardDescription>
                            Your company's shipping address and contact info
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shipper_name">Company Name</Label>
                                <Input
                                    id="shipper_name"
                                    value={formData.shipper_name || ""}
                                    onChange={(e) => handleChange('shipper_name', e.target.value)}
                                    placeholder="Liv Well Research Labs"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address_line1">Address Line 1</Label>
                                <AddressAutocomplete
                                    value={formData.shipper_address?.line1 || ""}
                                    onSelectAddress={(addr) => handleAddressChange(addr)}
                                    placeholder="Start typing your address..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        value={formData.shipper_address?.city || ""}
                                        onChange={(e) => handleAddressChange('city', e.target.value)}
                                        placeholder="Miami"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="state">State</Label>
                                    <Input
                                        id="state"
                                        value={formData.shipper_address?.state || ""}
                                        onChange={(e) => handleAddressChange('state', e.target.value)}
                                        placeholder="FL"
                                        maxLength={2}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="zip">ZIP Code</Label>
                                    <Input
                                        id="zip"
                                        value={formData.shipper_address?.zip || ""}
                                        onChange={(e) => handleAddressChange('zip', e.target.value)}
                                        placeholder="33101"
                                    />
                                </div>

                                <div className="space-y-2 opacity-70">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value="US"
                                        readOnly
                                        className="bg-muted cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shipper_phone">Phone</Label>
                                <Input
                                    id="shipper_phone"
                                    value={formData.shipper_phone || ""}
                                    onChange={(e) => handleChange('shipper_phone', e.target.value)}
                                    placeholder="1234567890"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shipper_email">Email</Label>
                                <Input
                                    id="shipper_email"
                                    type="email"
                                    value={formData.shipper_email || ""}
                                    onChange={(e) => handleChange('shipper_email', e.target.value)}
                                    placeholder="shipping@livwellresearch.com"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Default Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Default Settings</CardTitle>
                        <CardDescription>
                            Default service and package type
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="default_service_code">Default Service Code</Label>
                                <Input
                                    id="default_service_code"
                                    value={formData.default_service_code || ""}
                                    onChange={(e) => handleChange('default_service_code', e.target.value)}
                                    placeholder={carrier.carrier === "UPS" ? "03 (Ground)" : "FDXG"}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {carrier.carrier === "UPS" && "UPS: 01=Next Day, 02=2nd Day, 03=Ground"}
                                    {carrier.carrier === "FEDEX" && "FedEx: FDXG, FDXE, etc."}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="default_package_type">Default Package Type</Label>
                                <Input
                                    id="default_package_type"
                                    value={formData.default_package_type || ""}
                                    onChange={(e) => handleChange('default_package_type', e.target.value)}
                                    placeholder="02 (Package)"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button
                        onClick={() => handleSaveCarrier(formData)}
                        disabled={saving}
                        size="lg"
                    >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save {carrier.carrier} Settings
                    </Button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Shipping Settings</h1>
                <p className="text-muted-foreground">
                    Configure shipping carriers and API credentials
                </p>
            </div>

            <Tabs value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <TabsList className="w-full flex justify-start overflow-x-auto h-auto p-1 gap-1 bg-muted/50">
                    {carriers.map((carrier) => (
                        <TabsTrigger 
                            key={carrier.carrier} 
                            value={carrier.carrier} 
                            className="relative px-6 py-2 flex-shrink-0"
                        >
                            {carrier.carrier}
                            {carrier.is_active && (
                                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            )}
                        </TabsTrigger>
                    ))}

                    {!carriers.some(c => c.carrier === "SHIPPO") && (
                        <TabsTrigger value="SHIPPO" className="relative opacity-60 px-6 py-2 flex-shrink-0">
                            SHIPPO (unlinked)
                        </TabsTrigger>
                    )}

                    <TabsTrigger value="DIAGNOSTICS" className="relative px-6 py-2 flex-shrink-0 border-l ml-1">
                        <AlertCircle className="h-4 w-4 mr-2 text-primary" />
                        Diagnostics
                    </TabsTrigger>
                </TabsList>

                {carriers.map((carrier) => (
                    <TabsContent key={carrier.carrier} value={carrier.carrier}>
                        <CarrierForm carrier={carrier} />
                    </TabsContent>
                ))}

                {!carriers.some(c => c.carrier === "SHIPPO") && (
                    <TabsContent value="SHIPPO">
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/30">
                            <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">Shippo Not Initialized</h3>
                            <p className="text-muted-foreground mb-6 text-center max-w-md">
                                The Shippo integration is ready in the code, but the database configurations haven't been created yet.
                            </p>
                            <Button onClick={initializeShippo} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Initialize Shippo Integration
                            </Button>
                        </div>
                    </TabsContent>
                )}

                <TabsContent value="DIAGNOSTICS">
                    <ShippingDiagnostics carriers={carriers} onRefresh={fetchCarriers} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const ShippingDiagnostics = ({ carriers, onRefresh }: { carriers: CarrierSettings[], onRefresh: () => void }) => {
    const [testResults, setTestResults] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const runTest = async () => {
        setTesting(true);
        setTestResults(null);
        try {
            const { data, error } = await supabase.functions.invoke('calculate-shipping', {
                body: {
                    weight: 1.5,
                    address: {
                        line1: "300 Main St",
                        city: "San Francisco",
                        state: "CA",
                        postal_code: "94105",
                        country: "US"
                    }
                }
            });

            if (error) {
                // Try to parse the error message if it's a stringified JSON
                let detailedError = error.message;
                try {
                    // Supabase FunctionsHttpError often contains the body in a specific way
                    // but we'll try a generic approach first
                    if (error.context && typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        detailedError = body.error || JSON.stringify(body);
                    }
                } catch (e) {
                    console.error("Could not parse error body", e);
                }
                throw new Error(detailedError);
            }
            setTestResults({ success: true, data });
        } catch (error: any) {
            console.error("Test failed:", error);
            setTestResults({ success: false, error: error.message || error });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Database State</CardTitle>
                    <CardDescription>
                        Internal representation of your carrier settings in Supabase
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {carriers.map(c => (
                            <div key={c.carrier} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                <div>
                                    <h4 className="font-semibold">{c.carrier}</h4>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant={c.is_active ? "default" : "secondary"}>
                                            {c.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge variant={c.api_key ? "outline" : "destructive"}>
                                            {c.api_key ? `Token Present (${c.api_key.substring(0, 8)}...)` : "Token Missing"}
                                        </Badge>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={onRefresh}>
                                    Check DB
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Endpoint Connectivity Test</CardTitle>
                    <CardDescription>
                        Directly invokes the 'calculate-shipping' Edge Function to test your credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={runTest} 
                        disabled={testing}
                        className="w-full"
                    >
                        {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                        Run Rate Calculation Test
                    </Button>

                    {testResults && (
                        <div className={`p-4 rounded-lg border ${testResults.success ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold">{testResults.success ? 'SUCCESS' : 'FAILURE'}</span>
                            </div>
                            <pre className="text-xs overflow-auto max-h-64 p-2 bg-black/20 rounded">
                                {JSON.stringify(testResults.data || testResults.error, null, 2)}
                            </pre>
                            {testResults.error && (
                                <p className="mt-2 text-sm text-red-500">
                                    Hint: If you see "Carrier errors: SHIPPO: [Error]", ensure your token is Live/Test matched to your sandbox settings.
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ShippingSettings;
