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
        // Handle PKCE flow (token_hash in query params)
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (token_hash && type === "email") {
            const verifyOtp = async () => {
                try {
                    const { data, error } = await supabase.auth.verifyOtp({
                        token_hash,
                        type: "email",
                    });

                    if (error) {
                        setStatus("error");
                        setMessage(error.message);
                    } else if (data?.user) {
                        setStatus("success");
                        setMessage("Email confirmed successfully!");
                        setTimeout(() => navigate("/"), 2000);
                    }
                } catch (error: any) {
                    setStatus("error");
                    setMessage(error.message);
                }
            };
            verifyOtp();
            return;
        }

        // Handle Implicit flow (hash fragments) - handled automatically by Supabase client
        // We just need to listen for the session
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth event:", event);
            if (event === "SIGNED_IN" || session) {
                setStatus("success");
                setMessage("Email confirmed successfully! Redirecting...");
                setTimeout(() => navigate("/"), 2000);
            }
        });

        // Check if we already have a session (in case event fired before we listened)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setStatus("success");
                setMessage("Email confirmed successfully! Redirecting...");
                setTimeout(() => navigate("/"), 2000);
            } else {
                // If no session and no token_hash, wait a bit before showing error
                // because Supabase might still be processing the hash
                setTimeout(() => {
                    if (status === "loading") {
                        setStatus("error");
                        setMessage("Could not verify email. Please try logging in directly.");
                    }
                }, 4000);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
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
