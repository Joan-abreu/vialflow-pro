import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const EmailConfirmation = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const confirmEmail = async () => {
            // Supabase can send confirmation in two ways:
            // 1. New format: ?token_hash=xxx&type=email
            // 2. Old format: #access_token=xxx&refresh_token=xxx&type=signup

            // Check for new format first
            const token_hash = searchParams.get("token_hash");
            const type = searchParams.get("type");

            // Check for old format in hash
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const access_token = hashParams.get("access_token");
            const refresh_token = hashParams.get("refresh_token");
            const hashType = hashParams.get("type");

            console.log("Debug EmailConfirmation:", {
                url: window.location.href,
                hash: window.location.hash,
                token_hash,
                type,
                access_token: access_token ? "present" : "missing",
                refresh_token: refresh_token ? "present" : "missing",
                hashType
            });

            // Handle new format
            if (token_hash && type === "email") {
                try {
                    const { data, error } = await supabase.auth.verifyOtp({
                        token_hash,
                        type: "email",
                    });

                    if (error) {
                        console.error("Email confirmation error:", error);
                        setStatus("error");
                        setMessage(error.message || "Failed to confirm email. The link may have expired.");
                        return;
                    }

                    if (data?.user) {
                        setStatus("success");
                        setMessage("Your email has been confirmed successfully! You can now sign in.");
                        toast.success("Email confirmed successfully!");

                        setTimeout(() => {
                            navigate("/");
                        }, 2000);
                    } else {
                        setStatus("error");
                        setMessage("Unable to confirm email. Please try again.");
                    }
                } catch (error: any) {
                    console.error("Confirmation error:", error);
                    setStatus("error");
                    setMessage("An unexpected error occurred. Please try again.");
                }
            }
            // Handle old format (hash-based tokens)
            else if (access_token && refresh_token && hashType === "signup") {
                try {
                    // Set the session using the tokens from the URL
                    const { data, error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });

                    if (error) {
                        console.error("Email confirmation error:", error);
                        setStatus("error");
                        setMessage(error.message || "Failed to confirm email. The link may have expired.");
                        return;
                    }

                    if (data?.user) {
                        setStatus("success");
                        setMessage("Your email has been confirmed successfully! You can now sign in.");
                        toast.success("Email confirmed successfully!");

                        setTimeout(() => {
                            navigate("/");
                        }, 2000);
                    } else {
                        setStatus("error");
                        setMessage("Unable to confirm email. Please try again.");
                    }
                } catch (error: any) {
                    console.error("Confirmation error:", error);
                    setStatus("error");
                    setMessage("An unexpected error occurred. Please try again.");
                }
            }
            // No valid confirmation parameters found
            else {
                setStatus("error");
                setMessage("Invalid confirmation link. Please try again or request a new confirmation email.");
            }
        };

        confirmEmail();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Email Confirmation</CardTitle>
                    <CardDescription>
                        {status === "loading" && "Confirming your email address..."}
                        {status === "success" && "Email confirmed!"}
                        {status === "error" && "Confirmation failed"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    {status === "loading" && (
                        <>
                            <Loader2 className="h-16 w-16 animate-spin text-primary" />
                            <p className="text-center text-muted-foreground">
                                Please wait while we confirm your email address...
                            </p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <p className="text-center">{message}</p>
                            <p className="text-sm text-muted-foreground text-center">
                                Redirecting you to the home page...
                            </p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <XCircle className="h-16 w-16 text-destructive" />
                            <p className="text-center text-destructive">{message}</p>
                            <div className="flex flex-col gap-2 w-full mt-4">
                                <Button onClick={() => navigate("/register")} variant="default" className="w-full">
                                    Go to Register
                                </Button>
                                <Button onClick={() => navigate("/login")} variant="outline" className="w-full">
                                    Go to Login
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EmailConfirmation;
