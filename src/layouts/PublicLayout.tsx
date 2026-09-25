import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, Menu, LogOut, X, ArrowRight, Sparkles, Search, ChevronLeft, ChevronRight, Tag, Copy, Check } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import GlobalSearchModal from "@/components/public/GlobalSearchModal";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import ResearcherVerificationModal from "@/components/public/ResearcherVerificationModal";
import PromoSplashModal from "@/components/public/PromoSplashModal";
import { usePromoSplashSettings } from "@/hooks/usePromoSplashSettings";
import { shouldShowPromoSplash } from "@/config/promoSplashConfig";

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
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold min-w-[1rem] h-4 px-1 rounded-full flex items-center justify-center">
                        {cartCount}
                    </span>
                )}
                <span className="sr-only">Cart</span>
            </Button>
        </Link>
    );
};

const EXEMPT_PATHS = [
    "/terms",
    "/blog",
];

const checkIsExemptRouteSync = (pathname: string, search: string): boolean => {
    const lowerPath = pathname.toLowerCase();
    if (EXEMPT_PATHS.some(path => lowerPath === path || lowerPath.startsWith(path + "/"))) {
        return true;
    }

    const searchParams = new URLSearchParams(search);
    const categoryParam = searchParams.get("category")?.toLowerCase() || "";

    if (categoryParam.includes("water") || categoryParam.includes("reconstitution")) {
        return true;
    }

    if (pathname.startsWith("/products/") && pathname !== "/products") {
        const idOrSlug = pathname.split("/products/")[1]?.toLowerCase() || "";
        if (
            idOrSlug.includes("water") ||
            idOrSlug.includes("reconstitution") ||
            idOrSlug.includes("bacteriostatic") ||
            idOrSlug.includes("bac-water") ||
            idOrSlug.includes("sterile") ||
            idOrSlug.includes("solution")
        ) {
            return true;
        }
    }

    return false;
};

const PublicLayoutContent = () => {
    const { session } = useAuth();
    const user = session?.user ?? null;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isPromoter, setIsPromoter] = useState(false);
    const [showFdaDisclaimer, setShowFdaDisclaimer] = useState(true);
    const [showPeptideBanner, setShowPeptideBanner] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const [isVerified, setIsVerified] = useState<boolean>(() => {
        return sessionStorage.getItem("researcher_verified") === "true";
    });

    const [isWaterPage, setIsWaterPage] = useState<boolean>(() => {
        return checkIsExemptRouteSync(window.location.pathname, window.location.search);
    });
    const [isCheckingRoute, setIsCheckingRoute] = useState<boolean>(false);

    // Promotional Campaigns & Announcement Settings
    const { data: promoSettings } = usePromoSplashSettings();
    const [isPromoSplashOpen, setIsPromoSplashOpen] = useState(false);
    const hasDismissedPromoRef = useRef(false);

    // Active campaigns eligible for site entry modal
    const activeEntryCampaigns = useMemo(() => {
        return promoSettings?.campaigns 
            ? promoSettings.campaigns.filter(c => c.enabled && (c.triggerPlacement === "entry" || c.triggerPlacement === "both"))
            : (promoSettings?.enabled && (promoSettings.triggerPlacement === "entry" || promoSettings.triggerPlacement === "both"))
                ? [promoSettings as any]
                : [];
    }, [promoSettings]);

    // Active campaigns configured to sync with the top announcement banner
    const bannerCampaigns = useMemo(() => {
        if (!promoSettings) return [];
        const list = promoSettings.campaigns && Array.isArray(promoSettings.campaigns)
            ? promoSettings.campaigns.filter(c => c.enabled && c.syncTopBanner !== false)
            : (promoSettings.enabled && promoSettings.syncTopBanner !== false ? [promoSettings as any] : []);
        return list;
    }, [promoSettings]);

    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [isBannerHovered, setIsBannerHovered] = useState(false);
    const [isBannerInteracting, setIsBannerInteracting] = useState(false);
    const [modalInitialSlide, setModalInitialSlide] = useState(0);
    const [copiedBannerCode, setCopiedBannerCode] = useState<string | null>(null);

    // Banner Touch Drag State
    const [bannerDragOffset, setBannerDragOffset] = useState(0);
    const [isBannerDragging, setIsBannerDragging] = useState(false);
    const bannerTouchStartX = useRef<number | null>(null);
    const bannerTouchStartY = useRef<number | null>(null);
    const bannerTouchDeltaX = useRef<number>(0);
    const hasBannerSwipedRef = useRef(false);
    const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const pauseBannerAutoRotate = () => {
        setIsBannerInteracting(true);
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = setTimeout(() => {
            setIsBannerInteracting(false);
        }, 7000);
    };

    const handleBannerTouchStart = (e: React.TouchEvent) => {
        if (bannerCampaigns.length <= 1) return;
        pauseBannerAutoRotate();
        bannerTouchStartX.current = e.touches[0].clientX;
        bannerTouchStartY.current = e.touches[0].clientY;
        bannerTouchDeltaX.current = 0;
        hasBannerSwipedRef.current = false;
        setIsBannerDragging(true);
    };

    const handleBannerTouchMove = (e: React.TouchEvent) => {
        if (bannerTouchStartX.current === null || bannerTouchStartY.current === null || bannerCampaigns.length <= 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - bannerTouchStartX.current;
        const diffY = currentY - bannerTouchStartY.current;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            bannerTouchDeltaX.current = diffX;
            if (Math.abs(diffX) > 8) {
                hasBannerSwipedRef.current = true;
            }
            setBannerDragOffset(diffX);
        }
    };

    const handleBannerTouchEnd = () => {
        if (bannerCampaigns.length <= 1 || bannerTouchStartX.current === null) {
            setIsBannerDragging(false);
            setBannerDragOffset(0);
            return;
        }

        const diffX = bannerTouchDeltaX.current;
        const threshold = 35; // minimum px to trigger slide switch

        if (diffX < -threshold) {
            // Swiped left -> next promo
            setCurrentBannerIndex((prev) => (prev + 1) % bannerCampaigns.length);
        } else if (diffX > threshold) {
            // Swiped right -> prev promo
            setCurrentBannerIndex((prev) => (prev - 1 + bannerCampaigns.length) % bannerCampaigns.length);
        }

        setBannerDragOffset(0);
        setIsBannerDragging(false);
        bannerTouchStartX.current = null;
        bannerTouchStartY.current = null;
        bannerTouchDeltaX.current = 0;
        setTimeout(() => {
            hasBannerSwipedRef.current = false;
        }, 150);
    };

    // Auto-rotate announcement banner every 4.5 seconds if multiple promotions are active
    useEffect(() => {
        if (bannerCampaigns.length <= 1 || isBannerHovered || isBannerInteracting || isBannerDragging) return;

        const timer = setInterval(() => {
            setCurrentBannerIndex((prev) => (prev + 1) % bannerCampaigns.length);
        }, 4500);

        return () => clearInterval(timer);
    }, [bannerCampaigns.length, isBannerHovered, isBannerInteracting, isBannerDragging]);

    const handleOpenPromoFromBanner = (campaignIndex: number) => {
        const targetCamp = bannerCampaigns[campaignIndex];
        const entryIdx = targetCamp 
            ? activeEntryCampaigns.findIndex(c => c.id === targetCamp.id) 
            : 0;
        setModalInitialSlide(Math.max(0, entryIdx));
        setIsPromoSplashOpen(true);
    };

    useEffect(() => {
        if (!promoSettings || !promoSettings.enabled || activeEntryCampaigns.length === 0) return;
        if (hasDismissedPromoRef.current) return;

        // Avoid triggering if researcher verification is pending
        if (!isVerified && !isWaterPage && !isCheckingRoute) {
            return;
        }

        // Avoid triggering if user is navigating admin or auth routes
        if (location.pathname.startsWith("/manufacturing") || location.pathname.startsWith("/auth")) {
            return;
        }

        if (shouldShowPromoSplash(promoSettings)) {
            const timer = setTimeout(() => {
                if (!hasDismissedPromoRef.current) {
                    setIsPromoSplashOpen(true);
                }
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [promoSettings, activeEntryCampaigns.length, isVerified, isWaterPage, isCheckingRoute, location.pathname]);

    useEffect(() => {
        const checkRolesAndPromoter = async () => {
            if (user) {
                const { data } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)
                    .single();

                setIsAdmin(data?.role === "admin");

                // Check if user is registered in affiliates
                try {
                    const { data: affList } = await supabase
                        .from("affiliates" as any)
                        .select("id")
                        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
                        .limit(1);

                    setIsPromoter((affList || []).length > 0);
                } catch (_) {
                    setIsPromoter(false);
                }
            } else {
                setIsAdmin(false);
                setIsPromoter(false);
            }
        };

        checkRolesAndPromoter();
    }, [user]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        const checkWaterRoute = async () => {
            // Instant synchronous check for exempt pages & water routes
            const isSyncExempt = checkIsExemptRouteSync(location.pathname, location.search);
            if (isSyncExempt) {
                setIsWaterPage(true);
                setIsCheckingRoute(false);
                return;
            }

            // Check if user is on a product details page (/products/:id or /products/:slug)
            if (location.pathname.startsWith("/products/") && location.pathname !== "/products") {
                const idOrSlug = location.pathname.split("/products/")[1];
                if (idOrSlug) {
                    setIsCheckingRoute(true);
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
                    let query = supabase.from("products").select("name, category_id, product_categories(name)" as any);
                    if (isUuid) {
                        query = query.eq("id", idOrSlug);
                    } else {
                        query = query.eq("slug", idOrSlug);
                    }

                    const { data } = await query.maybeSingle();
                    if (data) {
                        const categoryName = (data.product_categories as any)?.name?.toLowerCase() || (data as any)?.category?.toLowerCase() || "";
                        const productName = (data as any)?.name?.toLowerCase() || "";
                        if (
                            categoryName.includes("water") || 
                            categoryName.includes("reconstitution") ||
                            productName.includes("bacteriostatic") ||
                            productName.includes("sterile water") ||
                            productName.includes("reconstitution")
                        ) {
                            setIsWaterPage(true);
                            setIsCheckingRoute(false);
                            return;
                        }
                    }
                    setIsCheckingRoute(false);
                }
            }

            setIsWaterPage(false);
            setIsCheckingRoute(false);
        };

        checkWaterRoute();
    }, [location.pathname, location.search]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Top Announcement Banner (Auto-rotating multi-promotions) */}
            {showPeptideBanner && (() => {
                const currentCampaign = bannerCampaigns.length > 0
                    ? bannerCampaigns[currentBannerIndex % bannerCampaigns.length]
                    : null;

                const hasMultipleBanners = bannerCampaigns.length > 1;

                return (
                    <div 
                        onMouseEnter={() => setIsBannerHovered(true)}
                        onMouseLeave={() => setIsBannerHovered(false)}
                        className="bg-primary text-primary-foreground h-10 sm:h-10.5 w-full max-w-[100vw] text-xs md:text-sm font-medium relative shadow-sm z-50 overflow-hidden flex items-center select-none shrink-0"
                    >
                        {/* Optional Prev Arrow (Desktop / Tablet) */}
                        {hasMultipleBanners && (
                            <button
                                type="button"
                                onClick={() => {
                                    pauseBannerAutoRotate();
                                    setCurrentBannerIndex((prev) => (prev - 1 + bannerCampaigns.length) % bannerCampaigns.length);
                                }}
                                className="absolute left-1.5 sm:left-2 z-20 p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer hidden sm:flex items-center justify-center text-white/80 hover:text-white"
                                aria-label="Previous promotion"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                        )}

                        {/* Transform Slider Track with Fluid Real-Time Touch Swiping */}
                        <div
                            onTouchStart={handleBannerTouchStart}
                            onTouchMove={handleBannerTouchMove}
                            onTouchEnd={handleBannerTouchEnd}
                            onTouchCancel={handleBannerTouchEnd}
                            className="w-full h-full overflow-hidden relative touch-pan-y"
                        >
                            <div
                                className="flex h-full w-full will-change-transform"
                                style={{
                                    transform: `translateX(calc(-${(currentBannerIndex % Math.max(1, bannerCampaigns.length)) * 100}% + ${bannerDragOffset}px))`,
                                    transition: isBannerDragging ? "none" : "transform 350ms cubic-bezier(0.25, 1, 0.5, 1)",
                                }}
                            >
                                {bannerCampaigns.length > 0 ? (
                                    bannerCampaigns.map((camp, idx) => (
                                        <div
                                            key={camp.id || idx}
                                            className="w-full min-w-full max-w-full shrink-0 h-full flex items-center justify-center px-7 sm:px-14 text-center overflow-hidden box-border"
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2 justify-center max-w-full min-w-0 overflow-hidden whitespace-nowrap">
                                                {/* Badge */}
                                                <span
                                                    onClick={() => {
                                                        if (!hasBannerSwipedRef.current) handleOpenPromoFromBanner(idx);
                                                    }}
                                                    className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[9px] sm:text-[10px] uppercase font-black px-1.5 sm:px-2 py-0.5 rounded-full tracking-wider animate-pulse cursor-pointer transition-colors shrink-0"
                                                >
                                                    <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {camp.badgeText || "SPECIAL"}
                                                </span>

                                                {/* Headline - Strictly truncated on 1 line so banner NEVER shifts height or width */}
                                                <span
                                                    onClick={() => {
                                                        if (!hasBannerSwipedRef.current) handleOpenPromoFromBanner(idx);
                                                    }}
                                                    className="cursor-pointer hover:underline truncate max-w-[130px] xs:max-w-[190px] sm:max-w-md md:max-w-lg lg:max-w-xl text-white font-semibold text-xs sm:text-sm shrink min-w-0"
                                                    title={camp.headline}
                                                >
                                                    {camp.headline}
                                                </span>

                                                {/* Coupon Code 1-Click Copy */}
                                                {camp.offerMode === "coupon_code" && camp.couponCode && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (hasBannerSwipedRef.current) return;
                                                            const code = camp.couponCode!.trim().toUpperCase();
                                                            navigator.clipboard.writeText(code);
                                                            localStorage.setItem("vialflow_referral_code", code);
                                                            setCopiedBannerCode(code);
                                                            toast.success(`Promo code "${code}" copied & applied!`);
                                                            setTimeout(() => setCopiedBannerCode(null), 2500);
                                                        }}
                                                        className="hidden xs:inline-flex items-center gap-1 bg-white text-primary hover:bg-white/95 font-mono font-black text-[9px] sm:text-xs px-2 py-0.5 rounded-full border border-white/60 shadow-xs cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
                                                        title="Click to copy promo code"
                                                    >
                                                        <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                        <span>{camp.couponCode}</span>
                                                        {copiedBannerCode === camp.couponCode ? (
                                                            <Check className="h-2.5 w-2.5 text-emerald-600 animate-in zoom-in" />
                                                        ) : (
                                                            <Copy className="h-2 w-2 opacity-70" />
                                                        )}
                                                    </button>
                                                )}

                                                {/* CTA Link */}
                                                <Link
                                                    to={camp.ctaUrl || "/products?category=peptides"}
                                                    onClick={(e) => {
                                                        if (hasBannerSwipedRef.current) e.preventDefault();
                                                    }}
                                                    className="underline underline-offset-4 hover:opacity-90 font-bold inline-flex items-center gap-0.5 sm:gap-1 text-white shrink-0 text-xs sm:text-sm"
                                                >
                                                    <span>{camp.ctaText || "Shop"}</span> <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full min-w-full max-w-full shrink-0 h-full flex items-center justify-center px-8 text-center">
                                        <span className="truncate text-xs sm:text-sm font-semibold">
                                            🧪 <strong>Premium Research Peptides</strong> are officially live in our catalog!
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Controls: Next Arrow & Dismiss Button */}
                        <div className="absolute right-1.5 sm:right-2 z-20 flex items-center gap-1 shrink-0">
                            {hasMultipleBanners && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        pauseBannerAutoRotate();
                                        setCurrentBannerIndex((prev) => (prev + 1) % bannerCampaigns.length);
                                    }}
                                    className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer hidden sm:flex items-center justify-center text-white/80 hover:text-white"
                                    aria-label="Next promotion"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            )}

                            <button 
                                onClick={() => setShowPeptideBanner(false)} 
                                className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
                                title="Dismiss announcement"
                                aria-label="Dismiss announcement"
                            >
                                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                        </div>

                        {/* Subtle Dots Indicator at Bottom Center */}
                        {hasMultipleBanners && (
                            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 pointer-events-auto">
                                {bannerCampaigns.map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pauseBannerAutoRotate();
                                            setCurrentBannerIndex(idx);
                                        }}
                                        className={`rounded-full transition-all cursor-pointer ${
                                            idx === (currentBannerIndex % bannerCampaigns.length)
                                                ? "w-3 sm:w-3.5 h-1 bg-white shadow-xs"
                                                : "w-1 sm:w-1.5 h-1 bg-white/40 hover:bg-white/70"
                                        }`}
                                        aria-label={`Go to promotion ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Promotional Campaigns Modal on Entry */}
            <PromoSplashModal
                isOpen={isPromoSplashOpen}
                onClose={() => {
                    hasDismissedPromoRef.current = true;
                    setIsPromoSplashOpen(false);
                }}
                settings={promoSettings}
                campaigns={activeEntryCampaigns}
                initialSlide={modalInitialSlide}
            />

            <ResearcherVerificationModal
                isOpen={!isVerified && !isWaterPage && !isCheckingRoute}
                onVerify={() => setIsVerified(true)}
            />
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
                            <Link to="/products?category=peptides" className="transition-colors hover:text-primary flex items-center gap-1.5 text-primary font-semibold">
                                <span>Peptides</span>
                                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase leading-none">New</span>
                            </Link>
                            <Link to="/lab-reports" className="transition-colors hover:text-primary">
                                Lab Reports
                            </Link>
                            <Link to="/blog" className="transition-colors hover:text-primary">
                                Blog
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

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSearchOpen(true)}
                            className="relative hover:bg-primary/10 hover:text-primary transition-all duration-200"
                            title="Search products (Ctrl+K or ⌘K)"
                        >
                            <Search className="h-5 w-5" />
                            <span className="sr-only">Search</span>
                        </Button>

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
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem asChild>
                                        <Link to="/account" className="cursor-pointer font-medium flex items-center">
                                            <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                            My Account
                                        </Link>
                                    </DropdownMenuItem>
                                    {isPromoter && (
                                        <DropdownMenuItem asChild>
                                            <Link to="/promoter" className="cursor-pointer font-bold text-primary flex items-center">
                                                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                                                Promoter Hub
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    {isAdmin && (
                                        <DropdownMenuItem asChild>
                                            <Link to="/manufacturing" className="cursor-pointer font-medium flex items-center">
                                                <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                                                Manufacturing Dashboard
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-muted-foreground hover:text-foreground">
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
                                <SheetHeader className="text-left pb-4 border-b">
                                    <SheetTitle className="text-xl font-bold text-primary">Liv Well Research Labs</SheetTitle>
                                    <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
                                </SheetHeader>
                                <nav className="flex flex-col gap-4 mt-6">
                                    <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Home
                                    </Link>
                                    <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Products
                                    </Link>
                                    <Link to="/products?category=peptides" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold text-primary flex items-center gap-2">
                                        <span>Peptides</span>
                                        <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">New</span>
                                    </Link>
                                    <Link to="/lab-reports" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Lab Reports
                                    </Link>
                                    <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Research Blog
                                    </Link>
                                    <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        About Us
                                    </Link>
                                    <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">
                                        Contact
                                    </Link>
                                    <button 
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            setIsSearchOpen(true);
                                        }} 
                                        className="text-lg font-semibold text-left flex items-center gap-2 text-primary"
                                    >
                                        <Search className="h-5 w-5" />
                                        <span>Search Catalog</span>
                                    </button>
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
                                            {isPromoter && (
                                                <Link to="/promoter" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold text-primary flex items-center gap-2">
                                                    <Sparkles className="h-5 w-5 text-primary" />
                                                    <span>Promoter Hub</span>
                                                </Link>
                                            )}
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

                <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t bg-muted/50">
                <div className="container py-10 md:py-16">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                        <div className="space-y-4 md:col-span-1">
                            <h3 className="text-lg font-bold">Liv Well Research Labs</h3>
                            <p className="text-sm text-muted-foreground">
                                Direct laboratory manufacturer of ultra-pure reconstitution solutions and bacteriostatic water, and supplier of research peptides.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link to="/products?category=water">BAC Water & Reconstitution Solutions</Link></li>
                                <li><Link to="/products?category=peptides">Research Peptides</Link></li>
                                <li><Link to="/products?category=Bulk Orders">Wholesale & Bulk Orders</Link></li>
                                <li><Link to="/products">All Products</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link to="/about">About Us</Link></li>
                                <li><Link to="/contact">Contact</Link></li>
                                <li><a href="tel:18004238002" className="hover:text-primary transition-colors font-medium">📞 1-800-423-8002</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Legal & Resources</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link to="/terms">Terms of Service</Link></li>
                                <li><Link to="/privacy">Privacy Policy</Link></li>
                                <li><Link to="/returns">Return Policy</Link></li>
                                <li><Link to="/sds">Safety Data Sheets (SDS)</Link></li>
                                <li><Link to="/lab-reports">Lab Reports (COAs)</Link></li>
                                <li><Link to="/blog">Research Blog & Protocols</Link></li>
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
                            <strong className="text-foreground">FDA DISCLAIMER:</strong> These products have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease. This website contains sterile reconstitution solutions and bacteriostatic water intended strictly for laboratory research and educational purposes. All products sold on this website are intended for reconstitution and laboratory research use only. These products are not intended for human dosing, injection, or ingestion.
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
