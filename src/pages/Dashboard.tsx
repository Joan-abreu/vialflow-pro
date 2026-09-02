import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Boxes, Truck, AlertTriangle, DollarSign, ShoppingCart, Users, UserPlus, FileText, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, subDays, format, eachDayOfInterval, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { DateRangeFilter, DateRange } from "@/components/shared/DateRangeFilter";
import OrderStatusChart from "@/components/dashboard/OrderStatusChart";
import RevenueTrendChart from "@/components/dashboard/RevenueTrendChart";
import OrderVolumeTrendChart from "@/components/dashboard/OrderVolumeTrendChart";
import TopProductsList from "@/components/dashboard/TopProductsList";
import TopCustomersList from "@/components/dashboard/TopCustomersList";
import { UnconvertedUsersDialog, UnconvertedUser } from "@/components/dashboard/UnconvertedUsersDialog";
import EcommerceFunnelChart from "@/components/dashboard/EcommerceFunnelChart";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "batch" | "shipment" | "inventory" | "order" | "label";
  description: string;
  timestamp: string;
  status?: string;
}

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd")
  });
  const [stats, setStats] = useState({
    activeBatches: 0,
    lowStockItems: 0,
    activeShipments: 0,
    totalRevenue: 0,
    productRevenue: 0,
    shippingCollected: 0,
    shippingPaid: 0,
    netRevenue: 0,
    totalOrders: 0,
    totalPurchasingClients: 0,
    totalRegisteredUsers: 0,
    pendingFulfillment: 0,
    awaitingPickup: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);

  // Analytics State
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([]);
  const [orderVolumeData, setOrderVolumeData] = useState<{ date: string; orders: number }[]>([]);
  const [unconvertedUsers, setUnconvertedUsers] = useState<UnconvertedUser[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; orderCount: number; totalSpent: number }[]>([]);
  const [funnelData, setFunnelData] = useState({
    views: 0,
    carts: 0,
    checkouts: 0,
    addresses: 0,
    orders: 0,
  });
  const [abandonedCartsStats, setAbandonedCartsStats] = useState({
    count: 0,
    lostRevenue: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const startDateTime = new Date(`${dateRange.startDate}T00:00:00`).toISOString();
      const endDateTime = new Date(`${dateRange.endDate}T23:59:59.999`).toISOString();

      const [
        batches, 
        materials, 
        shipments, 
        profiles, 
        ordersResp, 
        orderShipmentsResp, 
        allEverOrdersResp, 
        nonCustomerRolesResp,
        productViewsResp,
        cartSessionsResp,
        funnelEventsResp
      ] = await Promise.all([
        supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "in_progress"]),
        supabase
          .from("raw_materials")
          .select("current_stock, min_stock_level"),
        supabase
          .from("shipments")
          .select("*", { count: "exact", head: true })
          .in("status", ["preparing", "shipped"]),
        supabase
          .from("profiles")
          .select("id, user_id, full_name, email, created_at"),
        supabase
          .from("orders" as any)
          .select(`
            id,
            total_amount,
            shipping_cost,
            status,
            created_at,
            user_id,
            shipping_address,
            order_items (
              quantity,
              price_at_time,
              variant:product_variants(product:products(name))
            )
          `)
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime),
        supabase
          .from("order_shipments")
          .select("total_cost, status")
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime)
          .neq("status", "refunded"),
        supabase
          .from("orders" as any)
          .select("id, status, user_id, customer_email"),
        supabase
          .from("user_roles")
          .select("user_id, role"),
        supabase
          .from("analytics_events" as any)
          .select("*", { count: "exact", head: true })
          .eq("event_name", "product_view")
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime),
        supabase
          .from("cart_sessions" as any)
          .select("id, subtotal, status, created_at")
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime),
        supabase
          .from("checkout_funnel_events" as any)
          .select("id, step, created_at")
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime)
      ]);

      const lowStock = materials.data?.filter(
        (item) => item.current_stock < item.min_stock_level
      ) || [];

      const orders = ordersResp.data || [];
      const orderShipments = orderShipmentsResp.data || [];
      const allEverOrders = allEverOrdersResp.data || [];
      const customerUserIds = new Set(
        (nonCustomerRolesResp.data || [])
          .filter((r: any) => r.role === 'customer')
          .map((r: any) => r.user_id)
      );

      // Build lifetime sets of users/emails who have EVER placed a valid order (including guest purchases)
      const validEverOrders = allEverOrders.filter((o: any) =>
        o.status !== "pending" && 
        o.status !== "pending_payment" && 
        o.status !== "cancelled" && 
        o.status !== "failed"
      );
      const everPurchasedUserIds = new Set(validEverOrders.map((o: any) => o.user_id).filter(Boolean));
      const everPurchasedEmails = new Set(validEverOrders.map((o: any) => o.customer_email?.toLowerCase()).filter(Boolean));

      // Filter registered profiles who are customers and have 0 lifetime purchases (checking user_id AND email)
      const unconvertedLeads = (profiles.data || [])
        .filter((p: any) => {
          if (!p.user_id || !customerUserIds.has(p.user_id)) return false;
          const hasBoughtById = everPurchasedUserIds.has(p.user_id);
          const hasBoughtByEmail = Boolean(p.email && everPurchasedEmails.has(p.email.toLowerCase()));
          return !hasBoughtById && !hasBoughtByEmail;
        })
        .map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          created_at: p.created_at
        }));

      setUnconvertedUsers(unconvertedLeads);

      // Valid orders in selected date range for revenue calculation
      const validOrders = orders.filter((o: any) =>
        o.status !== "pending" && 
        o.status !== "pending_payment" && 
        o.status !== "cancelled" && 
        o.status !== "failed"
      );

      const totalRevenue = validOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);
      const shippingCollected = validOrders.reduce((sum: number, order: any) => sum + Number(order.shipping_cost || 0), 0);
      const productRevenue = totalRevenue - shippingCollected;
      
      const shippingPaid = orderShipments.reduce((sum: number, sh: any) => sum + Number(sh.total_cost || 0), 0);
      const netRevenue = productRevenue + (shippingCollected - shippingPaid);

      const uniqueClients = new Set(validOrders.map((o: any) => o.user_id).filter(Boolean)).size;

      // Real-time Fulfillment Operational Queues (Lifetime, independent of date filter, matches Order Management tabs)
      const pendingFulfillment = allEverOrders.filter((o: any) => ["processing", "in_production", "ready_to_ship"].includes(o.status)).length;
      const awaitingPickup = allEverOrders.filter((o: any) => ["label_created", "pickup_scheduled"].includes(o.status)).length;

      // Filter customer profiles (excluding admins/staff)
      const customerProfiles = (profiles.data || []).filter((p: any) => p.user_id && customerUserIds.has(p.user_id));

      setStats({
        activeBatches: batches.count || 0,
        lowStockItems: lowStock.length,
        activeShipments: shipments.count || 0,
        totalRevenue,
        productRevenue,
        shippingCollected,
        shippingPaid,
        netRevenue,
        totalOrders: validOrders.length,
        totalPurchasingClients: uniqueClients,
        totalRegisteredUsers: customerProfiles.length,
        pendingFulfillment,
        awaitingPickup
      });

      // --- Process Analytics Data ---

      // 1. Order Status Distribution
      const statusCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });

      const chartData = [
        { name: 'Pending', value: statusCounts['pending'] || 0, color: '#f59e0b' },
        { name: 'Processing', value: statusCounts['processing'] || 0, color: '#3b82f6' },
        { name: 'Ready To Ship', value: statusCounts['ready_to_ship'] || 0, color: '#0ea5e9' },
        { name: 'Label Created', value: statusCounts['label_created'] || 0, color: '#c026d3' },
        { name: 'Shipped', value: statusCounts['shipped'] || 0, color: '#8b5cf6' },
        { name: 'In Transit', value: (statusCounts['transit'] || 0) + (statusCounts['in_transit'] || 0), color: '#a855f7' },
        { name: 'Out for Delivery', value: statusCounts['out_for_delivery'] || 0, color: '#ec4899' },
        { name: 'Delivered', value: statusCounts['delivered'] || 0, color: '#10b981' },
      ].filter(item => item.value > 0);

      setStatusData(chartData);

      // 2. Revenue & Order Volume Trends (Dynamic)
      const dailyRevenue: Record<string, number> = {};
      const dailyOrders: Record<string, number> = {};
      
      const intervalDays = eachDayOfInterval({ 
          start: new Date(dateRange.startDate + "T00:00:00"), 
          end: new Date(dateRange.endDate + "T23:59:59") 
      });

      intervalDays.forEach(d => {
        const formattedKey = format(d, 'MMM dd');
        dailyRevenue[formattedKey] = 0;
        dailyOrders[formattedKey] = 0;
      });

      validOrders.forEach((o: any) => {
        const date = format(new Date(o.created_at), 'MMM dd');
        if (dailyOrders[date] !== undefined) {
          dailyOrders[date] += 1;
        } else {
          dailyOrders[date] = 1;
        }
      });

      validOrders.forEach((o: any) => {
        const date = format(new Date(o.created_at), 'MMM dd');
        if (dailyRevenue[date] !== undefined) {
          dailyRevenue[date] += Number(o.total_amount);
        } else {
          dailyRevenue[date] = Number(o.total_amount);
        }
      });

      const revenueDataArray = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue }));
      const orderVolumeDataArray = Object.entries(dailyOrders).map(([date, orders]) => ({ date, orders }));
      
      setRevenueData(revenueDataArray);
      setOrderVolumeData(orderVolumeDataArray);

      // 3. Top Products
      const productStats: Record<string, { quantity: number; revenue: number }> = {};
      orders.forEach((order: any) => {
        // Skip cancelled/failed or unpaid
        if (order.status === "cancelled" || order.status === "failed" || order.status === "pending_payment" || order.status === "pending") return;

        if (order.order_items) {
          order.order_items.forEach((item: any) => {
            const productName = item.variant?.product?.name || "Unknown Product";
            if (!productStats[productName]) {
              productStats[productName] = { quantity: 0, revenue: 0 };
            }
            productStats[productName].quantity += item.quantity;
            productStats[productName].revenue += item.quantity * item.price_at_time;
          });
        }
      });

      const topProductsList = Object.entries(productStats)
        .map(([name, pStats]) => ({ name, ...pStats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setTopProducts(topProductsList);

      // 4. Top Customers
      const customerStats: Record<string, { name: string, email: string, orderCount: number; totalSpent: number }> = {};
      
      orders.forEach((order: any) => {
        if (order.status === "cancelled" || order.status === "failed" || order.status === "pending_payment" || order.status === "pending") return;

        let name = "Unknown";
        let email = "";
        let idKey = order.id;

        if (order.user_id) {
            const profile = profiles.data?.find(p => p.user_id === order.user_id || p.id === order.user_id);
            if (profile) {
                name = profile.full_name || order.shipping_address?.name || profile.email?.split("@")[0] || "Unknown Client";
                email = profile.email || "";
                idKey = profile.id;
            } else if (order.shipping_address?.name) {
                name = order.shipping_address.name;
                idKey = order.user_id;
            } else {
                idKey = order.user_id;
            }
        } else if (order.shipping_address?.name) {
            name = order.shipping_address.name;
            idKey = name;
        }

        if (!customerStats[idKey]) {
            customerStats[idKey] = { name, email, orderCount: 0, totalSpent: 0 };
        }
        
        customerStats[idKey].orderCount += 1;
        customerStats[idKey].totalSpent += Number(order.total_amount);
      });

      const topCustomersList = Object.values(customerStats)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      setTopCustomers(topCustomersList);

      // 5. Funnel & Abandoned Cart Metrics
      const totalViews = productViewsResp?.count || 0;
      const cartSessionsList = (cartSessionsResp?.data || []) as any[];
      const funnelEventsList = (funnelEventsResp?.data || []) as any[];

      const totalCarts = cartSessionsList.length;
      const totalCheckouts = funnelEventsList.filter(e => e.step === "begin_checkout").length;
      const totalAddresses = funnelEventsList.filter(e => e.step === "address_entered").length;
      const totalOrdersPlaced = validOrders.length;

      setFunnelData({
        views: totalViews,
        carts: totalCarts,
        checkouts: totalCheckouts,
        addresses: totalAddresses,
        orders: totalOrdersPlaced,
      });

      const abandonedCarts = cartSessionsList.filter(c => c.status === "abandoned" || (c.status === "active" && new Date(c.created_at).getTime() < Date.now() - 3600000));
      const lostRevenue = abandonedCarts.reduce((sum, c) => sum + (Number(c.subtotal) || 0), 0);
      setAbandonedCartsStats({
        count: abandonedCarts.length,
        lostRevenue,
      });
    };

    const fetchActivities = async () => {
      const recentActivities: Activity[] = [];

      const [{ data: batchData }, { data: shipmentData }, { data: orderData }, { data: orderShipments }] = await Promise.all([
        supabase
            .from("production_batches")
            .select("id, batch_number, status, created_at, variant:product_variants!product_id(sale_type, pack_size, vial_type:vial_types(name, capacity_ml, color, shape))")
            .order("created_at", { ascending: false })
            .limit(5),
        supabase
            .from("shipments")
            .select("id, shipment_number, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        supabase
            .from("orders" as any)
            .select("id, total_amount, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        supabase
            .from("order_shipments")
            .select("id, tracking_number, carrier, status, created_at, order_id")
            .order("created_at", { ascending: false })
            .limit(5)
      ]);

      if (batchData) {
        batchData.forEach((batch: any) => {
          recentActivities.push({
            id: batch.id, type: "batch",
            description: `Batch ${batch.batch_number} created`,
            timestamp: batch.created_at, status: batch.status,
          });
        });
      }

      if (shipmentData) {
        shipmentData.forEach((s) => {
          recentActivities.push({
            id: s.id, type: "shipment",
            description: `FBA Shipment ${s.shipment_number} created`,
            timestamp: s.created_at, status: s.status,
          });
        });
      }

      if (orderData) {
        orderData.forEach((o: any) => {
          recentActivities.push({
            id: o.id, type: "order",
            description: `Order #${o.id.slice(0, 8)} received ($${o.total_amount})`,
            timestamp: o.created_at, status: o.status,
          });
        });
      }

      if (orderShipments) {
        orderShipments.forEach((os: any) => {
            recentActivities.push({
                id: os.id, type: "label",
                description: `Shipping Label generated for Order #${os.order_id?.slice(0,8) || ''} (${os.carrier})`,
                timestamp: os.created_at, status: os.status,
            })
        });
      }

      recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(recentActivities.slice(0, 10));
    };

    fetchStats();
    fetchActivities();
  }, [dateRange]);

  const getPeriodLabel = () => {
    if (!dateRange.startDate || !dateRange.endDate) return "Selected Period";
    try {
      const start = new Date(dateRange.startDate + "T00:00:00");
      const end = new Date(dateRange.endDate + "T00:00:00");
      const diffDays = Math.abs(differenceInDays(end, start)) + 1;
      
      if (format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")) {
        return format(start, "MMM d, yyyy");
      }
      
      const isEndingToday = format(end, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
      if (isEndingToday) {
        if (diffDays === 1) return "Today";
        if (diffDays === 7) return "Last 7 Days";
        if (diffDays === 30) return "Last 30 Days";
        if (diffDays === 90) return "Last 90 Days";
        if (diffDays >= 364 && diffDays <= 366) return "This Year";
      }
      
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } catch {
      return "Selected Period";
    }
  };

  const periodLabel = getPeriodLabel();

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Overview of your operations and e-commerce fulfillment
            </p>
          </div>
          <DateRangeFilter initialRange={dateRange} onChange={setDateRange} className="w-full xl:w-auto" />
      </div>

      {/* Financial Overview Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between w-full md:items-center gap-6">
             {/* Net Revenue Highlights */}
             <div className="flex-1">
               <div className="flex items-center gap-2 mb-2">
                 <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Net Revenue</h3>
                 <Badge variant="outline" className="text-[11px] font-semibold bg-white/80 dark:bg-slate-800/80 border-slate-300 text-slate-700 dark:text-slate-200">
                   {periodLabel}
                 </Badge>
               </div>
               <div className="flex items-baseline gap-2">
                 <span className={cn(
                   "text-4xl font-extrabold transition-colors duration-500",
                   stats.netRevenue < 0 ? "text-rose-600 dark:text-rose-500" : "text-green-600 dark:text-green-500"
                 )}>
                    ${stats.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </span>
               </div>
               <p className="text-sm text-slate-500 mt-2 max-w-xs">
                 Actual margin for <strong className="text-slate-700 dark:text-slate-300">{periodLabel}</strong> after separating gross product sales entirely from shipping costs.
               </p>
             </div>

             {/* Breakdown Metrics */}
             <div className="flex-2 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Gross Sales</p>
                  <p className="text-lg font-semibold">${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span className="text-[10px] text-muted-foreground block">{periodLabel}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Products (No Ship)</p>
                  <p className="text-lg font-semibold">${stats.productRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span className="text-[10px] text-muted-foreground block">{periodLabel}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Ship Collected</p>
                  <p className="text-lg font-semibold">${stats.shippingCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span className="text-[10px] text-muted-foreground block">{periodLabel}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Ship Labels Paid</p>
                  <p className="text-lg font-semibold text-rose-500">-${stats.shippingPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span className="text-[10px] text-muted-foreground block">{periodLabel}</span>
                </div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Group 1: E-Commerce Sales */}
      <div className="space-y-4 pt-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">E-Commerce Activity</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-sm font-medium">Orders Placed</CardTitle>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium block mt-0.5">{periodLabel}</span>
                    </div>
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalOrders}</div>
                </CardContent>
            </Card>

            <Link to="/manufacturing/analytics">
                <Card className="hover:border-destructive/50 transition-colors cursor-pointer group border-destructive/20 bg-destructive/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                          <CardTitle className="text-sm font-medium text-destructive">Abandoned Carts</CardTitle>
                          <span className="text-[11px] text-destructive/80 font-medium block mt-0.5">{periodLabel}</span>
                        </div>
                        <ShoppingCart className="h-5 w-5 text-destructive group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{abandonedCartsStats.count}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ${abandonedCartsStats.lostRevenue.toFixed(2)} lost • View & Recover &rarr;
                        </p>
                    </CardContent>
                </Card>
            </Link>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-sm font-medium">Purchasing Customers</CardTitle>
                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium block mt-0.5">{periodLabel}</span>
                    </div>
                    <Users className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalPurchasingClients}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Out of {stats.totalRegisteredUsers} registered
                    </p>
                </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-sm font-medium">Registered (No Purchase)</CardTitle>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium block mt-0.5">Lifetime Total</span>
                    </div>
                    <UserPlus className="h-5 w-5 text-amber-600" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{unconvertedUsers.length}</div>
                        <UnconvertedUsersDialog users={unconvertedUsers} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Opportunities to convert (0 lifetime purchases)</p>
                </CardContent>
            </Card>
          </div>
      </div>

      {/* Group 2: Fulfillment Operations */}
      <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Fulfillment Operations</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/manufacturing/orders">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Fulfillment (To Pack)</CardTitle>
                        <Package className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingFulfillment}</div>
                        <p className="text-xs text-muted-foreground mt-1 text-amber-600 dark:text-amber-400">Orders waiting to be boxed</p>
                    </CardContent>
                </Card>
            </Link>
            <Link to="/manufacturing/order-labels">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Awaiting Pickup / In Transit</CardTitle>
                        <FileText className="h-5 w-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.awaitingPickup}</div>
                        <p className="text-xs text-muted-foreground mt-1 text-indigo-600 dark:text-indigo-400">Labels created, awaiting carrier</p>
                    </CardContent>
                </Card>
            </Link>
          </div>
      </div>

       {/* Group 3: Manufacturing B2B */}
       <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Manufacturing & Supply (FBA)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
                    <Package className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.activeBatches}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Shipments (FBA)</CardTitle>
                    <Truck className="h-5 w-5 text-secondary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.activeShipments}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                    <AlertTriangle className={`h-5 w-5 ${stats.lowStockItems > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${stats.lowStockItems > 0 ? 'text-destructive' : ''}`}>{stats.lowStockItems}</div>
                    <p className="text-xs text-muted-foreground mt-1">Raw materials below threshold</p>
                </CardContent>
            </Card>
          </div>
      </div>

      {/* Analytics Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mt-8 mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Analytics & Conversion Funnel</h2>
        <Link to="/manufacturing/analytics">
          <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold">
            <BarChart3 className="h-4 w-4" />
            <span>Full Analytics Hub & Recovery &rarr;</span>
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <EcommerceFunnelChart
            viewsCount={funnelData.views}
            cartsCount={funnelData.carts}
            checkoutsCount={funnelData.checkouts}
            addressesCount={funnelData.addresses}
            ordersCount={funnelData.orders}
            periodLabel={periodLabel}
        />
        <RevenueTrendChart data={revenueData} periodLabel={periodLabel} />
        <OrderVolumeTrendChart data={orderVolumeData} periodLabel={periodLabel} />
        <OrderStatusChart data={statusData} />
        <TopProductsList products={topProducts} periodLabel={periodLabel} />
        <TopCustomersList customers={topCustomers} periodLabel={periodLabel} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Unified Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {activity.type === "batch" && <Package className="h-4 w-4 text-primary" />}
                      {activity.type === "shipment" && <Truck className="h-4 w-4 text-secondary" />}
                      {activity.type === "inventory" && <Boxes className="h-4 w-4 text-muted-foreground" />}
                      {activity.type === "order" && <ShoppingCart className="h-4 w-4 text-blue-600" />}
                      {activity.type === "label" && <FileText className="h-4 w-4 text-indigo-500" />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  {activity.status && (
                    <Badge
                      variant={
                        ["completed", "delivered", "transit"].includes(activity.status)
                          ? "secondary"
                          : ["in_progress", "shipped", "processing", "ready_to_ship"].includes(activity.status)
                            ? "default"
                            : "outline"
                      }
                      className="ml-2 flex-shrink-0 capitalize"
                    >
                      {activity.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
