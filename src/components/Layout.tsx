import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  LogOut,
  Menu,
  Shield,
  User,
  Tag,
  ShoppingCart,
  Users,
  Store,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    };

    const fetchPendingOrdersCount = async () => {
      if (isAdmin) {
        const { count } = await supabase
          .from("orders" as any)
          .select("*", { count: "exact", head: true })
          .in("status", ["pending_payment", "pending", "processing"]);

        setPendingOrdersCount(count || 0);
      }
    };

    fetchUserProfile();
    fetchPendingOrdersCount();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingOrdersCount, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const baseNavigation = [
    { name: "Dashboard", href: "/manufacturing", icon: LayoutDashboard },
    { name: "Production", href: "/manufacturing/production", icon: Package },
    { name: "Shipments", href: "/manufacturing/shipments", icon: Truck },
    { name: "Inventory", href: "/manufacturing/inventory", icon: Boxes },
    { name: "Products", href: "/manufacturing/products", icon: Tag },
  ];

  const adminNavigation = [
    { name: "Orders", href: "/manufacturing/orders", icon: ShoppingCart },
    { name: "Customers", href: "/manufacturing/customers", icon: Users },
    { name: "Users", href: "/manufacturing/users", icon: Shield },
    { name: "Communications", href: "/manufacturing/communications", icon: Mail },
  ];

  const navigation = isAdmin
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  const NavigationLinks = () => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        const showBadge = item.name === "Orders" && pendingOrdersCount > 0;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.name}</span>
            {showBadge && (
              <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                {pendingOrdersCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </>
  );

  const DesktopSidebar = () => {
    const { open } = useSidebar();

    return (
      <Sidebar collapsible="icon" className="border-r">
        <SidebarContent>
          <div className="flex h-16 items-center border-b px-6">
            <h1 className={`text-xl font-bold text-primary transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}>
              {open ? 'VialFlow Pro' : ''}
            </h1>
          </div>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-3 py-4">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const showBadge = item.name === "Orders" && pendingOrdersCount > 0;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className={open ? 'flex-1' : 'sr-only'}>{item.name}</span>
                          {showBadge && open && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                              {pendingOrdersCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mt-auto border-t">
            {userName && (
              <div className="px-3 py-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  {open && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="p-3">
              <Button
                variant="ghost"
                className={`w-full ${open ? 'justify-start' : 'justify-center px-2'}`}
                onClick={handleSignOut}
              >
                <LogOut className={`h-5 w-5 ${open ? 'mr-3' : ''}`} />
                {open && 'Sign Out'}
              </Button>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-card px-4 md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold text-primary">VialFlow Pro</h1>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                <NavigationLinks />
              </nav>
              <div className="border-t">
                {userName && (
                  <div className="px-3 py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userName}</p>
                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-xl font-bold text-primary">VialFlow Pro</h1>
      </header>

      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {/* Desktop collapsible sidebar */}
          <div className="hidden md:flex md:flex-col">
            <DesktopSidebar />
          </div>

          {/* Main content with header */}
          <div className="flex-1 flex flex-col">
            <header className="hidden md:flex h-12 items-center justify-between border-b bg-card px-2 sticky top-0 z-50">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
              </div>
              <div className="flex items-center gap-2 px-2">
                <Link to="/" target="_blank" title="Go to Store">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Store className="h-4 w-4" />
                    <span className="sr-only">Go to Store</span>
                  </Button>
                </Link>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto p-4 md:p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default Layout;
