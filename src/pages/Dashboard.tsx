import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Truck, AlertTriangle, DollarSign, ShoppingCart, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, subDays, format } from "date-fns";
import OrderStatusChart from "@/components/dashboard/OrderStatusChart";
import RevenueTrendChart from "@/components/dashboard/RevenueTrendChart";
import TopProductsList from "@/components/dashboard/TopProductsList";

interface Activity {
  id: string;
  type: "batch" | "shipment" | "inventory" | "order";
  description: string;
  timestamp: string;
  status?: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeBatches: 0,
    lowStockItems: 0,
    activeShipments: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalClients: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);

  // Analytics State
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [batches, materials, shipments, orders, clients, orderItems] = await Promise.all([
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
          .from("orders" as any)
          .select("total_amount, status, created_at, user_id"),
        supabase
          .from("orders" as any)
          .select("user_id", { count: "exact", head: true }),
        supabase
          .from("orders" as any)
          .select(`
            status,
            order_items (
              quantity,
              price_at_time,
              variant:product_variants(product:products(name))
            )
          `)
          .gte("created_at", thirtyDaysAgo)
      ]);

      const lowStock = materials.data?.filter(
        (item) => item.current_stock < item.min_stock_level
      ) || [];

      // Calculate Revenue (only for valid orders)
      const validStatuses = ["processing", "shipped", "delivered"];
      const validOrders = orders.data?.filter((o: any) =>
        validStatuses.includes(o.status)
      ) || [];

      const revenue = validOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);

      // Create a set of valid order IDs for filtering items
      const validOrderIds = new Set(validOrders.map((o: any) => o.id));

      const uniqueClients = new Set(orders.data?.map((o: any) => o.user_id).filter(Boolean)).size;

      setStats({
        activeBatches: batches.count || 0,
        lowStockItems: lowStock.length,
        activeShipments: shipments.count || 0,
        totalRevenue: revenue,
        totalOrders: orders.data?.length || 0,
        totalClients: uniqueClients,
      });

      // --- Process Analytics Data ---

      // 1. Order Status Distribution
      const statusCounts: Record<string, number> = {};
      orders.data?.forEach((o: any) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });

      const chartData = [
        { name: 'Pending', value: statusCounts['pending'] || 0, color: '#f59e0b' },
        { name: 'Processing', value: statusCounts['processing'] || 0, color: '#3b82f6' },
        { name: 'Shipped', value: statusCounts['shipped'] || 0, color: '#8b5cf6' },
        { name: 'Delivered', value: statusCounts['delivered'] || 0, color: '#10b981' },
      ].filter(item => item.value > 0);

      setStatusData(chartData);

      // 2. Revenue Trend (Last 30 Days)
      const dailyRevenue: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'MMM dd');
        dailyRevenue[date] = 0;
      }

      validOrders.forEach((o: any) => {
        const date = format(new Date(o.created_at), 'MMM dd');
        if (dailyRevenue[date] !== undefined) {
          dailyRevenue[date] += Number(o.total_amount);
        }
      });

      const revenueTrend = Object.entries(dailyRevenue).map(([date, amount]) => ({
        date,
        revenue: amount
      }));
      setRevenueData(revenueTrend);

      // 3. Top Products
      const productStats: Record<string, { quantity: number; revenue: number }> = {};

      // Use recentOrders (fetched with items)
      const recentOrders = orderItems.data;

      if (recentOrders) {
        recentOrders.forEach((order: any) => {
          // Only process items from valid orders
          if (!validStatuses.includes(order.status)) return;

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
      }

      const topProductsList = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setTopProducts(topProductsList);
    };

    const fetchActivities = async () => {
      const recentActivities: Activity[] = [];

      // Fetch recent batches
      const { data: batchData } = await supabase
        .from("production_batches")
        .select(`
          id, 
          batch_number, 
          status, 
          created_at, 
          variant:product_variants!product_id (
            sale_type,
            pack_size,
            vial_type:vial_types(name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (batchData) {
        batchData.forEach((batch: any) => {
          const vialTypeName = batch.variant?.vial_type?.name || 'Unknown Type';
          const isPack = batch.variant?.sale_type === 'pack';
          const packInfo = isPack ? `Pack ${batch.variant?.pack_size}x` : 'Individual';

          recentActivities.push({
            id: batch.id,
            type: "batch",
            description: `Batch ${batch.batch_number} created - ${vialTypeName} - ${packInfo}`,
            timestamp: batch.created_at,
            status: batch.status,
          });
        });
      }

      // Fetch recent shipments
      const { data: shipmentData } = await supabase
        .from("shipments")
        .select("id, shipment_number, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (shipmentData) {
        shipmentData.forEach((shipment) => {
          recentActivities.push({
            id: shipment.id,
            type: "shipment",
            description: `Shipment ${shipment.shipment_number} created`,
            timestamp: shipment.created_at,
            status: shipment.status,
          });
        });
      }

      // Fetch recent orders
      const { data: orderData } = await supabase
        .from("orders" as any)
        .select("id, total_amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (orderData) {
        orderData.forEach((order: any) => {
          recentActivities.push({
            id: order.id,
            type: "order",
            description: `Order #${order.id.slice(0, 8)} received ($${order.total_amount})`,
            timestamp: order.created_at,
            status: order.status,
          });
        });
      }

      // Sort all activities by timestamp and take the most recent 10
      recentActivities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(recentActivities.slice(0, 10));
    };

    fetchStats();
    fetchActivities();
  }, []);

  const cards = [
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Active Batches",
      value: stats.activeBatches,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Active Shipments",
      value: stats.activeShipments,
      icon: Truck,
      color: "text-secondary",
    },
    {
      title: "Low Stock Alerts",
      value: stats.lowStockItems,
      icon: AlertTriangle,
      color: "text-destructive",
    },
  ];

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Overview of your production and e-commerce operations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RevenueTrendChart data={revenueData} />
        <OrderStatusChart data={statusData} />
        <TopProductsList products={topProducts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
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
                      {activity.type === "batch" && (
                        <Package className="h-4 w-4 text-primary" />
                      )}
                      {activity.type === "shipment" && (
                        <Truck className="h-4 w-4 text-secondary" />
                      )}
                      {activity.type === "inventory" && (
                        <Boxes className="h-4 w-4 text-muted-foreground" />
                      )}
                      {activity.type === "order" && (
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                      )}
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
                        activity.status === "completed" || activity.status === "delivered"
                          ? "secondary"
                          : activity.status === "in_progress" || activity.status === "shipped" || activity.status === "processing"
                            ? "default"
                            : "outline"
                      }
                      className="ml-2 flex-shrink-0 capitalize"
                    >
                      {activity.status.replace("_", " ")}
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
