import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Production from "./pages/Production";
import Inventory from "./pages/Inventory";
import Shipments from "./pages/Shipments";
import Users from "./pages/Users";
import BillOfMaterials from "./pages/BillOfMaterials";
import ProductManagement from "./pages/admin/ProductManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import CustomerManagement from "./pages/admin/CustomerManagement";
import NotFound from "./pages/NotFound";
import AccessDenied from "./components/AccessDenied";
import { useUserRole } from "./hooks/useUserRole";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/public/Home";
import Products from "./pages/public/Products";
import ProductDetails from "./pages/public/ProductDetails";
import Cart from "./pages/public/Cart";
import Checkout from "./pages/public/Checkout";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import About from "./pages/public/About";
import Contact from "./pages/public/Contact";
import ComingSoon from "./pages/public/ComingSoon";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { hasAccess, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <Layout>{children}</Layout>;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public E-commerce Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<ComingSoon />} />
              <Route path="/privacy" element={<ComingSoon />} />
              <Route path="/auth" element={<Auth />} />
            </Route>

            {/* Manufacturing Routes */}
            <Route path="/manufacturing">
              {session ? (
                <>
                  <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
                  <Route path="inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                  <Route path="shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                  <Route path="products" element={<ProtectedRoute><ProductManagement /></ProtectedRoute>} />
                  <Route path="orders" element={<ProtectedRoute><OrderManagement /></ProtectedRoute>} />
                  <Route path="customers" element={<ProtectedRoute><CustomerManagement /></ProtectedRoute>} />
                  <Route path="bom/:batchId" element={<BillOfMaterials />} />
                </>
              ) : (
                <Route path="*" element={<Navigate to="/auth" replace />} />
              )}
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
