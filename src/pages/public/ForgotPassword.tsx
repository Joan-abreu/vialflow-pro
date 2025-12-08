import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setEmailSent(true);
            toast.success("Password reset email sent! Check your inbox.");
        } catch (error: any) {
            toast.error(error.message || "Error sending reset email");
        } finally {
            setLoading(false);
        }
    };

    if (emailSent) {
        return (
            <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold">Check Your Email</h1>
                        <p className="text-muted-foreground mt-2">
                            We've sent a password reset link to <strong>{email}</strong>
                        </p>
                    </div>

                    <div className="bg-card border rounded-lg p-8 shadow-sm space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Click the link in the email to reset your password. The link will expire in 1 hour.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Didn't receive the email? Check your spam folder or{" "}
                            <button
                                onClick={() => setEmailSent(false)}
                                className="text-primary hover:underline font-medium"
                            >
                                try again
                            </button>
                        </p>
                    </div>

                    <div className="text-center">
                        <Link to="/login" className="inline-flex items-center text-sm text-primary hover:underline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Forgot Password?</h1>
                    <p className="text-muted-foreground mt-2">
                        Enter your email and we'll send you a reset link
                    </p>
                </div>

                <form onSubmit={handleResetRequest} className="bg-card border rounded-lg p-8 shadow-sm space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <Button className="w-full" type="submit" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                </form>

                <div className="text-center">
                    <Link to="/login" className="inline-flex items-center text-sm text-primary hover:underline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
