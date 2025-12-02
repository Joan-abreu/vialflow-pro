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
            // Supabase handles email confirmation automatically via the URL
            // We just need to check the auth state after the redirect

            // Get the token from URL - Supabase uses different param names
            const token_hash = searchParams.get("token_hash");
            const type = searchParams.get("type");

            if (!token_hash || type !== "email") {
                setStatus("error");
                setMessage("Invalid confirmation link. Please try again or request a new confirmation email.");
                return;
            }

            try {
                // Verify the OTP token
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

                    // Redirect to home page after a short delay
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
