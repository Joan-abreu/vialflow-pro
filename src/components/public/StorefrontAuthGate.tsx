import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, ShieldAlert, CheckCircle2, Lock, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface StorefrontAuthGateProps {
    isOpen: boolean;
    onSuccess: () => void;
}

export const StorefrontAuthGate: React.FC<StorefrontAuthGateProps> = ({ isOpen, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<"register" | "login">("register");

    // Login State
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    // Register State
    const [regFullName, setRegFullName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [regResearchStatus, setRegResearchStatus] = useState<string>("");
    const [regAgeConfirmed, setRegAgeConfirmed] = useState(false);
    const [regRuoConfirmed, setRegRuoConfirmed] = useState(false);
    const [regLoading, setRegLoading] = useState(false);

    if (!isOpen) return null;

    // Handle Login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail.trim().toLowerCase(),
                password: loginPassword,
            });

            if (error) {
                if (error.message.includes("Invalid login credentials")) {
                    toast.error("Invalid email or password. Please try again.");
                } else if (error.message.toLowerCase().includes("email not confirmed")) {
                    toast.error("Account email is pending confirmation. Please check your inbox or register directly.");
                } else {
                    toast.error(error.message || "Failed to sign in");
                }
                return;
            }

            if (data.session) {
                sessionStorage.setItem("researcher_gate_cleared", "true");
                sessionStorage.setItem("researcher_verified", "true");
                const userStatus = data.session.user.user_metadata?.research_status || "Verified Researcher";
                sessionStorage.setItem("researcher_status", userStatus);
                toast.success("Welcome back! Research portal access granted.");
                onSuccess();
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred during sign in.");
        } finally {
            setLoginLoading(false);
        }
    };

    // Handle Instant Free Registration (Meets Tagada Pay requirement: "Keep sign-up free and instant, and they're in")
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!regResearchStatus) {
            toast.error("Please select your research status or affiliation.");
            return;
        }

        if (!regAgeConfirmed || !regRuoConfirmed) {
            toast.error("You must confirm both required compliance statements to proceed.");
            return;
        }

        setRegLoading(true);

        try {
            const cleanEmail = regEmail.trim().toLowerCase();

            // 1. Create auto-confirmed user via register-user Edge Function (Admin API bypasses email confirmation barrier)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('register-user', {
                body: {
                    email: cleanEmail,
                    password: regPassword,
                    fullName: regFullName.trim() || "Qualified Researcher",
                    researchStatus: regResearchStatus,
                    autoConfirm: true,
                }
            });

            if (edgeError || edgeData?.error) {
                let errorMessage = edgeData?.error;
                if (edgeError) {
                    try {
                        const errorBody = await edgeError.context?.clone().json();
                        if (errorBody?.error) errorMessage = errorBody.error;
                    } catch (_) {}
                    if (!errorMessage) errorMessage = edgeError.message;
                }

                if (
                    errorMessage?.includes("already registered") ||
                    errorMessage?.includes("email_exists") ||
                    errorMessage?.includes("User already exists") ||
                    errorMessage?.includes("already been registered")
                ) {
                    toast.info("This email is already registered. Please sign in with your password.");
                    setActiveTab("login");
                    setLoginEmail(cleanEmail);
                    return;
                }

                throw new Error(errorMessage || "Registration failed");
            }

            // 2. Immediately establish a live Supabase authenticated session on the client
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: regPassword,
            });

            if (signInError) {
                console.warn("Auto-signin following registration warning:", signInError);
                toast.success("Account created successfully! Please enter your password to sign in.");
                setActiveTab("login");
                setLoginEmail(cleanEmail);
                return;
            }

            // 3. Mark session flags for instant access across the site
            sessionStorage.setItem("researcher_gate_cleared", "true");
            sessionStorage.setItem("researcher_status", regResearchStatus);
            sessionStorage.setItem("researcher_verified", "true");

            toast.success("Research registration approved! Welcome to Liv Well Research Labs.");
            onSuccess();
        } catch (err: any) {
            console.error("Storefront Gate Register Error:", err);
            toast.error(err.message || "Failed to complete research registration. Please try again.");
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-background text-foreground border border-border/80 rounded-2xl shadow-2xl overflow-hidden my-auto relative">
                {/* Top Accent Gradient */}
                <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-teal-500" />

                {/* Header */}
                <div className="p-5 sm:p-6 pb-4 border-b border-border/60 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/20">
                        <FlaskConical className="w-3.5 h-3.5 text-primary" />
                        Authorized Research Facility Portal
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                        Liv Well Research Labs
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Access to high-purity chemical reference standards, peptides, and reconstitution solutions is restricted to qualified research professionals.
                    </p>
                </div>

                {/* Tabs: Free Instant Access vs Sign In */}
                <div className="p-5 sm:p-6 pt-4 space-y-5">
                    <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/60 p-1">
                            <TabsTrigger value="register" className="text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-primary shadow-xs">
                                Instant Research Access
                            </TabsTrigger>
                            <TabsTrigger value="login" className="text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-primary shadow-xs">
                                Sign In
                            </TabsTrigger>
                        </TabsList>

                        {/* --- TAB 1: Instant Registration (Free & Instant, Research Status, 2 Confirmations) --- */}
                        <TabsContent value="register" className="space-y-4 focus-visible:outline-none">
                            <div className="bg-muted/40 border border-border/60 rounded-xl p-3 text-xs space-y-1">
                                <p className="font-bold text-foreground flex items-center gap-1.5">
                                    <ShieldAlert className="w-4 h-4 text-primary" />
                                    <span>Research Gate Verification</span>
                                </p>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    Create your free research account instantly to access the catalog, analytical certificates, and product specifications.
                                </p>
                            </div>

                            <form onSubmit={handleRegister} className="space-y-3.5">
                                <div className="space-y-1.5 text-left">
                                    <Label htmlFor="gate-reg-name" className="text-xs font-semibold">
                                        Researcher Name / Institution
                                    </Label>
                                    <Input
                                        id="gate-reg-name"
                                        placeholder="Dr. Alex Rivera / BioTech Labs"
                                        value={regFullName}
                                        onChange={(e) => setRegFullName(e.target.value)}
                                        className="h-10 text-xs"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <Label htmlFor="gate-reg-email" className="text-xs font-semibold">
                                        Institutional / Professional Email <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="gate-reg-email"
                                        type="email"
                                        placeholder="researcher@organization.com"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        className="h-10 text-xs"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <Label htmlFor="gate-reg-password" className="text-xs font-semibold">
                                        Password <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="gate-reg-password"
                                            type={showRegPassword ? "text" : "password"}
                                            placeholder="Create a secure password"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            className="h-10 text-xs pr-9"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowRegPassword(!showRegPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Research Status (Required by Kashu/Tagada: Nothing pre-selected) */}
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-xs font-semibold flex items-center justify-between">
                                        <span>Research Status / Affiliation <span className="text-destructive">*</span></span>
                                        <span className="text-[10px] text-muted-foreground">Select one</span>
                                    </Label>
                                    <Select value={regResearchStatus || undefined} onValueChange={(val) => setRegResearchStatus(val)}>
                                        <SelectTrigger className="h-10 text-xs bg-background border border-input text-foreground w-full">
                                            <SelectValue placeholder="Select your research affiliation..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[100002] bg-popover text-popover-foreground border shadow-2xl">
                                            <SelectItem value="independent_researcher" className="cursor-pointer text-xs py-2">
                                                Independent Scientific Researcher
                                            </SelectItem>
                                            <SelectItem value="academic_university" className="cursor-pointer text-xs py-2">
                                                Academic / University Research Laboratory
                                            </SelectItem>
                                            <SelectItem value="biotech_pharmaceutical" className="cursor-pointer text-xs py-2">
                                                Biotechnology / Commercial Laboratory
                                            </SelectItem>
                                            <SelectItem value="contract_research_org" className="cursor-pointer text-xs py-2">
                                                Contract Research Organization (CRO)
                                            </SelectItem>
                                            <SelectItem value="analytical_testing" className="cursor-pointer text-xs py-2">
                                                Analytical Chemistry & Quality Testing Lab
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Confirmation 1: 21+ Age */}
                                <div className="p-2.5 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-left">
                                    <div className="flex items-start space-x-2.5">
                                        <Checkbox
                                            id="gate-age-confirm"
                                            checked={regAgeConfirmed}
                                            onCheckedChange={(c) => setRegAgeConfirmed(c === true)}
                                            className="mt-0.5 shrink-0"
                                        />
                                        <Label htmlFor="gate-age-confirm" className="text-[11px] leading-snug cursor-pointer font-normal text-muted-foreground">
                                            I certify that I am at least <strong>21 years of age</strong> and legally authorized to acquire chemical reagents for laboratory research.
                                        </Label>
                                    </div>

                                    {/* Confirmation 2: RUO & No Human Use */}
                                    <div className="flex items-start space-x-2.5 pt-1 border-t border-border/40">
                                        <Checkbox
                                            id="gate-ruo-confirm"
                                            checked={regRuoConfirmed}
                                            onCheckedChange={(c) => setRegRuoConfirmed(c === true)}
                                            className="mt-0.5 shrink-0"
                                        />
                                        <Label htmlFor="gate-ruo-confirm" className="text-[11px] leading-snug cursor-pointer font-normal text-muted-foreground">
                                            <strong>Research use only, not for human consumption.</strong> All products are for in-vitro analytical research and will NOT be used in humans or animals.
                                        </Label>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={regLoading || !regAgeConfirmed || !regRuoConfirmed || !regResearchStatus || !regEmail || !regPassword}
                                    className="w-full h-11 text-xs font-extrabold uppercase tracking-wider shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all gap-1.5"
                                >
                                    {regLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Verifying Access...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Instant Research Access & Enter Store</span>
                                        </>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        {/* --- TAB 2: Existing Researcher Sign In --- */}
                        <TabsContent value="login" className="space-y-4 focus-visible:outline-none">
                            <form onSubmit={handleLogin} className="space-y-3.5 text-left">
                                <div className="space-y-1.5">
                                    <Label htmlFor="gate-login-email" className="text-xs font-semibold">Email Address</Label>
                                    <Input
                                        id="gate-login-email"
                                        type="email"
                                        placeholder="researcher@organization.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="h-10 text-xs"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="gate-login-password" className="text-xs font-semibold">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="gate-login-password"
                                            type={showLoginPassword ? "text" : "password"}
                                            placeholder="Enter your password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            className="h-10 text-xs pr-9"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loginLoading || !loginEmail || !loginPassword}
                                    className="w-full h-11 text-xs font-extrabold uppercase tracking-wider shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all gap-1.5"
                                >
                                    {loginLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Authenticating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            <span>Sign In & Enter Facility</span>
                                        </>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Footer Notice */}
                <div className="p-3 bg-muted/60 text-center border-t border-border/60 text-[11px] text-muted-foreground">
                    By accessing Liv Well Research Labs, you agree to our{" "}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline font-semibold">
                        Terms of Service
                    </Link>{" "}
                    & Research Compliance Policy.
                </div>
            </div>
        </div>
    );
};

export default StorefrontAuthGate;
