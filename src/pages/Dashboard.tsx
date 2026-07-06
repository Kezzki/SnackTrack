import { Package, AlertTriangle, DollarSign, ShoppingCart, Store, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSellerStore, useInvalidateSellerStore } from "@/hooks/useSellerStore";
import { ShopProfileCard } from "@/components/dashboard/ShopProfileCard";
import { formatCurrency } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  todaySales: number;
  todayOrders: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { data: shopInfo } = useSellerStore();
  const invalidateStore = useInvalidateSellerStore();
  
  const storeId = shopInfo?.id ?? null;
  const [timeRange, setTimeRange] = useState("daily");

  // Single cached query for all dashboard data — stale for 5 minutes.
  // Avoids 3 separate DB round-trips on every route navigation back to "/".
  const { data: dashData } = useQuery({
    queryKey: ['dashboard-data', storeId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [productsRes, todayOrdersRes, historyRes] = await Promise.all([
        supabase.from('products').select('stock').eq('store_id', storeId!),
        supabase.from('orders').select('total_amount').eq('store_id', storeId!).gte('created_at', today.toISOString()),
        supabase.from('orders').select('total_amount, created_at').eq('store_id', storeId!).gte('created_at', thirtyDaysAgo.toISOString()).order('created_at', { ascending: true }),
      ]);

      const productsData = productsRes.data || [];
      const todayOrdersData = todayOrdersRes.data || [];
      const historyOrders = historyRes.data || [];

      return {
        stats: {
          totalProducts: productsData.length,
          lowStockCount: productsData.filter(p => p.stock < 30).length,
          todayOrders: todayOrdersData.length,
          todaySales: todayOrdersData.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0),
        } as DashboardStats,
        chartData: historyOrders,
      };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const stats = dashData?.stats ?? { totalProducts: 0, lowStockCount: 0, todaySales: 0, todayOrders: 0 };
  const chartData = dashData?.chartData ?? [];

  const aggregatedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
        // Fallback realistic empty state if no data
        return Array.from({length: 7}).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                name: d.toLocaleDateString("id-ID", { weekday: 'short' }),
                total: 0
            };
        });
    }

    const groups: Record<string, number> = {};
    
    chartData.forEach(order => {
        const date = new Date(order.created_at);
        let key = "";
        
        if (timeRange === "daily") {
            key = date.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
        } else if (timeRange === "weekly") {
            // Rough week grouping
            const weekNum = Math.ceil(date.getDate() / 7);
            key = `Minggu ${weekNum} ${date.toLocaleDateString("id-ID", { month: 'short' })}`;
        } else {
            key = date.toLocaleDateString("id-ID", { month: 'long', year: 'numeric' });
        }

        groups[key] = (groups[key] || 0) + (Number(order.total_amount) || 0);
    });

    return Object.entries(groups).map(([name, total]) => ({ name, total }));
  }, [chartData, timeRange]);

  const statsDisplay = [
    { title: "Total Produk", value: stats.totalProducts.toString(), icon: Package, iconColor: "text-primary" },
    { title: "Stok Rendah", value: stats.lowStockCount.toString(), icon: AlertTriangle, iconColor: "text-warning" },
    { title: "Penjualan Hari Ini", value: formatCurrency(stats.todaySales), icon: ShoppingCart, iconColor: "text-primary" },
    { title: "Pesanan Hari Ini", value: stats.todayOrders.toString(), icon: DollarSign, iconColor: "text-primary" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Page Header */}
      <div className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground">Ringkasan Dashboard</h1>
        {shopInfo && (
            <div className="flex items-center gap-2 bg-card px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-border shadow-sm w-fit">
              {shopInfo.image_url ? (
                <img src={shopInfo.image_url} alt="Shop" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
              <div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">{shopInfo.name}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Toko Aktif</p>
              </div>
            </div>
        )}
      </div>

      <ShopProfileCard onUpdate={invalidateStore} />

      {/* Stats Grid */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-8">
        {statsDisplay.map((stat) => (
          <div
            key={stat.title}
            className="rounded-lg sm:rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm flex flex-col gap-1.5 sm:gap-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] sm:text-sm text-muted-foreground leading-tight">{stat.title}</p>
              <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Sales Chart Section */}
      <div className="rounded-lg sm:rounded-xl border border-border bg-card shadow-sm mb-4 sm:mb-8">
        <div className="p-3 sm:p-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-sm sm:text-lg font-semibold text-foreground">Grafik Penjualan</h2>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Pilih rentang waktu" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="daily">Harian</SelectItem>
                <SelectItem value="weekly">Mingguan</SelectItem>
                <SelectItem value="monthly">Bulanan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="p-3 sm:p-6">
            <div className="h-[200px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={aggregatedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            tickFormatter={(value) => `Rp ${value.toLocaleString('id-ID')}`}
                            width={80}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                            itemStyle={{ color: "hsl(var(--foreground))" }}
                            formatter={(value: number) => [formatCurrency(value), "Penjualan"]}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="total" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorSales)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
