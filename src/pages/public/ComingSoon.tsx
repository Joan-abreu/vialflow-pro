import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ComingSoon = () => {
    return (
        <div className="container flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <h1 className="text-4xl font-bold">Coming Soon</h1>
            <p className="text-xl text-muted-foreground max-w-md">
                We are working hard to bring you this page. Please check back later.
            </p>
            <Link to="/">
                <Button>Return Home</Button>
            </Link>
        </div>
    );
};

export default ComingSoon;
