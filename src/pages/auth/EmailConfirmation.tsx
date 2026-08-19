import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ShoppingBag, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

const EmailConfirmation = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { items } = useCart();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    const handleSuccess = () => {
        setStatus("success");
        setMessage("Your account is now verified and active.");
        toast.success("Account verified successfully! Welcome.");
        
        // Auto-redirect after 3.5 seconds
        setTimeout(() => {
            if (items.length > 0) {
                navigate("/checkout");
            } else {
                navigate("/");
            }
        }, 3500);
    };

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
                        handleSuccess();
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || session) {
                handleSuccess();
            }
        });

        // Check if we already have a session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                handleSuccess();
            } else {
                setTimeout(() => {
                    if (status === "loading") {
                        // Check if hash has access_token
                        if (window.location.hash.includes("access_token")) {
                            handleSuccess();
                        } else {
                            setStatus("error");
                            setMessage("Could not verify link or it has expired. Please try logging in directly.");
                        }
                    }
                }, 4000);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [searchParams, navigate]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold">
                        {status === "loading" && "Confirming Account"}
                        {status === "success" && "Account Verified!"}
                        {status === "error" && "Verification Failed"}
                    </CardTitle>
                    <CardDescription>
                        {status === "loading" && "Please wait while we verify your email address..."}
                        {status === "success" && "Welcome to Liv Well Research Labs"}
                        {status === "error" && "We were unable to verify your link"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-5 pt-4">
                    {status === "loading" && (
                        <div className="py-8 flex flex-col items-center gap-3">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground text-center">
                                Activating your account securely...
                            </p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="space-y-6 w-full text-center">
                            <div className="h-16 w-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-base text-foreground">{message}</p>
                                <p className="text-xs text-muted-foreground">
                                    {items.length > 0 
                                        ? "Redirecting you to complete your checkout..." 
                                        : "Redirecting you to the home page..."}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2.5 pt-2">
                                {items.length > 0 ? (
                                    <Link to="/checkout">
                                        <Button className="w-full font-bold shadow-md">
                                            <ShoppingBag className="h-4 w-4 mr-2" /> Proceed to Checkout
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link to="/products">
                                        <Button className="w-full font-bold shadow-md">
                                            <ShoppingBag className="h-4 w-4 mr-2" /> Browse Products
                                        </Button>
                                    </Link>
                                )}
                                <Link to="/account">
                                    <Button variant="outline" className="w-full">
                                        <User className="h-4 w-4 mr-2" /> My Account
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="space-y-6 w-full text-center">
                            <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
                                <XCircle className="h-10 w-10" />
                            </div>
                            <p className="text-sm text-muted-foreground">{message}</p>
                            <div className="flex flex-col gap-2 w-full pt-2">
                                <Button onClick={() => navigate("/login")} variant="default" className="w-full">
                                    Go to Sign In
                                </Button>
                                <Button onClick={() => navigate("/register")} variant="outline" className="w-full">
                                    Create New Account
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EmailConfirmation;
