import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  Truck, 
  LogOut,
  Menu,
  Shield,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
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

    fetchUserProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Production", href: "/production", icon: Package },
    { name: "Shipments", href: "/shipments", icon: Truck },
    { name: "Inventory", href: "/inventory", icon: Boxes },
  ];

  const adminNavigation = [
    { name: "Users", href: "/users", icon: Shield },
  ];

  const navigation = isAdmin 
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  const NavigationLinks = () => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

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

      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-card md:block">
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
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
