import { Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartProvider, useCart } from "@/contexts/CartContext";

const CartIcon = () => {
    const { cartCount } = useCart();
    return (
        <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <CartIcon />
                        <Link to="/login">
                            <Button variant="ghost" size="icon">
                                <User className="h-5 w-5" />
                                <span className="sr-only">Account</span>
                            </Button>
                        </Link>

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
                                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Login
                                    </Link>
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
                                Premium peptides and research materials for scientific advancement.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link to="/products?category=peptides">Peptides</Link></li>
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
