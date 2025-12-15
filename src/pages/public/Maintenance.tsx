import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Maintenance = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
            <div className="space-y-6 max-w-md">
                <div className="flex justify-center">
                    <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                        <Construction className="h-12 w-12" />
                    </div>
                </div>

                <h1 className="text-4xl font-bold tracking-tight">Under Maintenance</h1>

                <p className="text-muted-foreground text-lg">
                    We are currently performing scheduled maintenance to improve your experience.
                    Please check back later.
                </p>

                <div className="pt-8">
                    <Button
                        variant="outline"
                        onClick={() => navigate("/login")}
                    >
                        Admin Login
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Maintenance;
