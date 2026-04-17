import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Truck, AlertTriangle, DollarSign, ShoppingCart, Users, UserPlus, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, subDays, format, eachDayOfInterval } from "date-fns";
import { Link } from "react-router-dom";
import { DateRangeFilter, DateRange } from "@/components/shared/DateRangeFilter";
import OrderStatusChart from "@/components/dashboard/OrderStatusChart";
import RevenueTrendChart from "@/components/dashboard/RevenueTrendChart";
import TopProductsList from "@/components/dashboard/TopProductsList";
import TopCustomersList from "@/components/dashboard/TopCustomersList";
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
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; orderCount: number; totalSpent: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const startDateTime = `${dateRange.startDate}T00:00:00.000Z`;
      const endDateTime = `${dateRange.endDate}T23:59:59.999Z`;

      const [batches, materials, shipments, profiles, ordersResp, orderShipmentsResp] = await Promise.all([
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
          .select("id, user_id, full_name, email"),
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
          .neq("status", "refunded")
      ]);

      const lowStock = materials.data?.filter(
        (item) => item.current_stock < item.min_stock_level
      ) || [];

      const orders = ordersResp.data || [];
      const orderShipments = orderShipmentsResp.data || [];

      // Valid orders for revenue calculation (any order that is paid and not cancelled)
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

      const uniqueClients = new Set(orders.map((o: any) => o.user_id).filter(Boolean)).size;

      // Fulfillment specific metrics
      const pendingFulfillment = orders.filter((o: any) => o.status === "processing" || o.status === "ready_to_ship").length;
      const awaitingPickup = orders.filter((o: any) => o.status === "label_created" || o.status === "pickup_scheduled").length;

      setStats({
        activeBatches: batches.count || 0,
        lowStockItems: lowStock.length,
        activeShipments: shipments.count || 0,
        totalRevenue,
        productRevenue,
        shippingCollected,
        shippingPaid,
        netRevenue,
        totalOrders: orders.length,
        totalPurchasingClients: uniqueClients,
        totalRegisteredUsers: profiles.data?.length || 0,
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

      // 2. Revenue Trend (Dynamic)
      const dailyRevenue: Record<string, number> = {};
      const intervalDays = eachDayOfInterval({ 
          start: new Date(dateRange.startDate + "T00:00:00"), 
          end: new Date(dateRange.endDate + "T23:59:59") 
      });

      intervalDays.forEach(d => {
        dailyRevenue[format(d, 'MMM dd')] = 0;
      });

      validOrders.forEach((o: any) => {
        const date = format(new Date(o.created_at), 'MMM dd');
        if (dailyRevenue[date] !== undefined) {
          dailyRevenue[date] += Number(o.total_amount);
        } else {
            dailyRevenue[date] = Number(o.total_amount);
        }
      });

      // Maintain chronological order without sorting manually because object iteration is sufficient for pre-filled dates
      const revenueDataArray = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue }));
      
      // If we're showing a massive timeframe (e.g. all time), we might have too many data points.
      // Recharts handles it gracefully by skipping labels anyway.
      setRevenueData(revenueDataArray);

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
               <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Net Revenue</h3>
               <div className="flex items-baseline gap-2">
                 <span className={cn(
                   "text-4xl font-extrabold transition-colors duration-500",
                   stats.netRevenue < 0 ? "text-rose-600 dark:text-rose-500" : "text-green-600 dark:text-green-500"
                 )}>
                    ${stats.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </span>
               </div>
               <p className="text-sm text-slate-500 mt-2 max-w-xs">
                 Actual margin after separating gross product sales entirely from your shipping carrier costs and collected shipping fees.
               </p>
             </div>

             {/* Breakdown Metrics */}
             <div className="flex-2 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Gross Sales</p>
                  <p className="text-lg font-semibold">${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Products (No Ship)</p>
                  <p className="text-lg font-semibold">${stats.productRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Ship Collected</p>
                  <p className="text-lg font-semibold">${stats.shippingCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase opacity-80">Ship Labels Paid</p>
                  <p className="text-lg font-semibold text-rose-500">-${stats.shippingPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Group 1: E-Commerce Sales */}
      <div className="space-y-4 pt-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">E-Commerce Activity</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Orders Placed</CardTitle>
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalOrders}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Purchasing Customers</CardTitle>
                    <Users className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalPurchasingClients}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Out of {stats.totalRegisteredUsers} registered
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Registered (No Purchase)</CardTitle>
                    <UserPlus className="h-5 w-5 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{Math.max(0, stats.totalRegisteredUsers - stats.totalPurchasingClients)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Opportunities to convert</p>
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
      <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200 mt-8">Analytics & Leaderboards</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueTrendChart data={revenueData} />
        <OrderStatusChart data={statusData} />
        <TopProductsList products={topProducts} />
        <TopCustomersList customers={topCustomers} />
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
