import { Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, Menu, LogOut, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

const CartIcon = () => {
    const { cartCount, isAnimating } = useCart();
    return (
        <Link to="/cart">
            <Button
                variant="ghost"
                size="icon"
                className={`relative transition-transform duration-300 ${isAnimating ? "scale-125 text-primary" : ""
                    }`}
            >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                        {cartCount}
                    </span>
                )}
                <span className="sr-only">Cart</span>
            </Button>
        </Link>
    );
};

const PublicLayoutContent = () => {
    const { session } = useAuth();
    const user = session?.user ?? null;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showFdaDisclaimer, setShowFdaDisclaimer] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdmin = async () => {
            if (user) {
                const { data } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)
                    .single();

                setIsAdmin(data?.role === "admin");
            } else {
                setIsAdmin(false);
            }
        };

        checkAdmin();
    }, [user]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link to="/" className="flex items-center space-x-2">
                            <span className="text-xl font-bold text-primary">Liv Well Research Labs</span>
                        </Link>
                        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                            <Link to="/products" className="transition-colors hover:text-primary">
                                Products
                            </Link>
                            <Link to="/about" className="transition-colors hover:text-primary">
                                About Us
                            </Link>
                            <Link to="/contact" className="transition-colors hover:text-primary">
                                Contact
                            </Link>
                            {isAdmin && (
                                <Link to="/manufacturing" className="transition-colors hover:text-primary font-semibold text-primary">
                                    Manufacturing
                                </Link>
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <CartIcon />

                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="relative">
                                        <User className="h-5 w-5" />
                                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-background"></span>
                                        <span className="sr-only">Account</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link to="/account" className="cursor-pointer">
                                            My Account
                                        </Link>
                                    </DropdownMenuItem>
                                    {isAdmin && (
                                        <DropdownMenuItem asChild>
                                            <Link to="/manufacturing" className="cursor-pointer">
                                                Manufacturing Dashboard
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link to="/login">
                                <Button variant="ghost" size="icon">
                                    <User className="h-5 w-5" />
                                    <span className="sr-only">Login</span>
                                </Button>
                            </Link>
                        )}

                        {/* Mobile Menu */}
                        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                            <SheetTrigger asChild className="md:hidden">
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right">
                                <nav className="flex flex-col gap-4 mt-8">
                                    <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Home
                                    </Link>
                                    <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Products
                                    </Link>
                                    <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        About Us
                                    </Link>
                                    <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Contact
                                    </Link>
                                    <Link to="/cart" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Cart
                                    </Link>
                                    {isAdmin && (
                                        <Link to="/manufacturing" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary">
                                            Manufacturing
                                        </Link>
                                    )}
                                    {user ? (
                                        <>
                                            <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                                My Account
                                            </Link>
                                            <button onClick={handleLogout} className="text-lg font-medium text-left">
                                                Logout
                                            </button>
                                        </>
                                    ) : (
                                        <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                            Login
                                        </Link>
                                    )}
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t bg-muted/50">
                <div className="container py-10 md:py-16">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Liv Well Research Labs</h3>
                            <p className="text-sm text-muted-foreground">
                                Premium research materials for scientific advancement.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">

                                <li><Link to="/products?category=water">Water</Link></li>
                                <li><Link to="/products">All Products</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link to="/about">About Us</Link></li>
                                <li><Link to="/contact">Contact</Link></li>
                                <li><Link to="/terms">Terms of Service</Link></li>
                                <li><Link to="/privacy">Privacy Policy</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Connect</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" target="_blank" rel="noreferrer">Instagram</a></li>
                                <li><a href="#" target="_blank" rel="noreferrer">Twitter</a></li>
                                <li><a href="#" target="_blank" rel="noreferrer">LinkedIn</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Liv Well Research Labs. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* FDA Disclaimer Banner - Bottom Fixed */}
            {showFdaDisclaimer && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-3 text-[10px] md:text-xs text-muted-foreground flex items-start gap-4">
                    <div className="flex-1 max-w-7xl mx-auto flex items-start md:items-center gap-4">
                        <div className="flex-1 text-left sm:text-center pb-2 md:pb-0">
                            <strong className="text-foreground">FDA DISCLAIMER:</strong> These products have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease. This website contains research materials intended strictly for laboratory and educational purposes. All products sold on this website are intended for research and identification purposes only. These products are not intended for human dosing, injection, or ingestion.
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full hover:bg-muted/80 self-start md:self-center absolute right-2 top-2 md:relative md:top-0 md:right-0" onClick={() => setShowFdaDisclaimer(false)}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close disclaimer</span>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const PublicLayout = () => {
    return (
        <CartProvider>
            <PublicLayoutContent />
        </CartProvider>
    );
};

export default PublicLayout;
