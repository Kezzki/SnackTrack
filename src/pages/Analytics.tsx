import React, { useState, useEffect, useCallback } from "react";
import { useForecast } from "@/hooks/useForecast";
import { useSellerStore } from "@/hooks/useSellerStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, RefreshCw, BarChart3, Package, CalendarIcon, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, History } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/contexts/NotificationContext";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Previous-prediction localStorage helpers
// ---------------------------------------------------------------------------
const PREDICTIONS_STORAGE_KEY = "snacktrack_prediction_history";

// ---------------------------------------------------------------------------
// Stock-notification deduplication helpers
// ---------------------------------------------------------------------------
const NOTIFIED_WEEKS_KEY = "snacktrack_stock_notified_weeks";

function getNotifiedWeeks(storeId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`${NOTIFIED_WEEKS_KEY}_${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function markWeekAsNotified(storeId: string, forecastWeek: string) {
  const existing = getNotifiedWeeks(storeId);
  if (!existing.includes(forecastWeek)) {
    existing.push(forecastWeek);
    sessionStorage.setItem(`${NOTIFIED_WEEKS_KEY}_${storeId}`, JSON.stringify(existing.slice(-12)));
  }
}

interface StoredPrediction {
  forecast_week: string;
  forecasts: Record<string, number>;
  saved_at: string;
}

function loadPreviousPredictions(storeId: string): StoredPrediction[] {
  try {
    const raw = localStorage.getItem(`${PREDICTIONS_STORAGE_KEY}_${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePrediction(storeId: string, forecastWeek: string, forecasts: Record<string, number>) {
  const existing = loadPreviousPredictions(storeId);
  // Don't duplicate the same week
  if (existing.some(p => p.forecast_week === forecastWeek)) return;
  existing.push({ forecast_week: forecastWeek, forecasts, saved_at: new Date().toISOString() });
  // Keep last 12 predictions max
  const trimmed = existing.slice(-12);
  localStorage.setItem(`${PREDICTIONS_STORAGE_KEY}_${storeId}`, JSON.stringify(trimmed));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Analytics() {
    const { data: forecastData, isLoading, error, fetchForecast } = useForecast();
    const { data: sellerStore } = useSellerStore();
    const storeId = sellerStore?.id ?? null;
    const { toast } = useToast();
    const { addNotification } = useNotification();

    // Editable buffer state: product -> user-adjusted buffer value
    const [bufferOverrides, setBufferOverrides] = useState<Record<string, number>>({});
    // Missing-days banner expand state
    const [missingDaysExpanded, setMissingDaysExpanded] = useState(false);
    // Previous predictions from localStorage
    const [previousPredictions, setPreviousPredictions] = useState<StoredPrediction[]>([]);
    // Toggle for showing previous predictions on chart
    const [showPrevPredictions, setShowPrevPredictions] = useState(true);

    useEffect(() => {
        if (storeId) fetchForecast(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId]);

    // When forecastData arrives, save the prediction & load history
    useEffect(() => {
        if (!forecastData || !storeId) return;
        savePrediction(storeId, forecastData.forecast_week, forecastData.forecasts);
        setPreviousPredictions(loadPreviousPredictions(storeId));
        // Reset buffer overrides when new data arrives
        setBufferOverrides({});
    }, [forecastData, storeId]);

    // -----------------------------------------------------------------------
    // Stock-vs-recommendation check: fire notifications when current stock
    // is below AI-recommended levels for the forecasted week.
    // Runs once per forecast_week (deduplicated via localStorage).
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!forecastData || !storeId) return;
        if (getNotifiedWeeks(storeId).includes(forecastData.forecast_week)) return;

        async function checkStockAndNotify() {
            const { data: products } = await supabase
                .from("products")
                .select("name, stock")
                .eq("store_id", storeId)
                .eq("is_active", true);

            if (!products?.length) {
                markWeekAsNotified(storeId!, forecastData!.forecast_week);
                return;
            }

            for (const rec of forecastData!.recommendations) {
                // Normalise forecast product name for fuzzy matching
                const normalised = rec.product.replace(/Sales/gi, "").trim().toLowerCase();
                const matched = products.find(p =>
                    p.name.toLowerCase().includes(normalised) ||
                    normalised.includes(p.name.toLowerCase())
                );

                if (matched && matched.stock < rec.recommended_stock) {
                    await addNotification({
                        type: "stock",
                        title: "Stok di bawah rekomendasi AI",
                        message: `${matched.name}: stok saat ini ${matched.stock} unit, AI merekomendasikan ${rec.recommended_stock} unit untuk minggu ${forecastData!.forecast_week}.`,
                        actionUrl: "/products",
                    });
                }
            }

            markWeekAsNotified(storeId!, forecastData!.forecast_week);
        }

        checkStockAndNotify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forecastData, storeId]);

    // -------------------------------------------------------------------
    // Chart data: bar chart
    // -------------------------------------------------------------------
    const getEffectiveBuffer = useCallback((product: string, originalBuffer: number) => {
        return bufferOverrides[product] ?? originalBuffer;
    }, [bufferOverrides]);

    const getEffectiveStock = useCallback((forecastedSales: number, product: string, originalBuffer: number) => {
        const buffer = getEffectiveBuffer(product, originalBuffer);
        return Math.ceil(forecastedSales + buffer);
    }, [getEffectiveBuffer]);

    const chartData = forecastData?.recommendations.map(r => ({
        name: r.product.replace(/Sales/i, "").trim().toUpperCase(),
        "Prediksi Penjualan": r.forecasted_sales,
        "Stok Direkomendasikan": getEffectiveStock(r.forecasted_sales, r.product, r.safety_buffer)
    })) || [];

    // -------------------------------------------------------------------
    // Chart data: line chart (historical + prediction + prev predictions)
    // -------------------------------------------------------------------
    const historyData = React.useMemo(() => {
        if (!forecastData?.historical_dates) return [];
        
        const data = forecastData.historical_dates.map((date, index) => {
            const dataPoint: any = { name: date };
            Object.keys(forecastData.historical_sales).forEach(product => {
                const prodName = product.replace(/Sales/i, "").trim().toUpperCase();
                dataPoint[prodName] = forecastData.historical_sales[product][index];
            });

            // Check if this week has missing days
            const missingCount = forecastData.missing_days_by_week?.[date] || 0;
            if (missingCount > 0) {
                dataPoint._missingDays = missingCount;
            }

            return dataPoint;
        });

        // Bridge: last historical point also starts the prediction line
        if (data.length > 0) {
           const lastHistoryItem = data[data.length - 1];
           Object.keys(forecastData.historical_sales).forEach(product => {
               const prodName = product.replace(/Sales/i, "").trim().toUpperCase();
               lastHistoryItem[`${prodName}_Pred`] = lastHistoryItem[prodName];
           });
        }

        // Add the current predicted week
        const predictionPoint: any = { name: forecastData.forecast_week + " (Pred)" };
        Object.keys(forecastData.forecasts).forEach(product => {
            const prodName = product.replace(/Sales/i, "").trim().toUpperCase();
            predictionPoint[`${prodName}_Pred`] = forecastData.forecasts[product];
        });
        data.push(predictionPoint);

        // Overlay previous predictions as separate series points
        if (showPrevPredictions && previousPredictions.length > 0) {
            // Only show predictions that aren't the current one
            const pastPreds = previousPredictions.filter(p => p.forecast_week !== forecastData.forecast_week);
            for (const pred of pastPreds) {
                // Find if this week already exists in data
                const existingIdx = data.findIndex(d => d.name === pred.forecast_week);
                if (existingIdx >= 0) {
                    // Attach previous prediction values to this data point
                    Object.keys(pred.forecasts).forEach(product => {
                        const prodName = product.replace(/Sales/i, "").trim().toUpperCase();
                        data[existingIdx][`${prodName}_PrevPred`] = pred.forecasts[product];
                    });
                }
            }
        }

        return data;
    }, [forecastData, previousPredictions, showPrevPredictions]);

    const productKeys = forecastData ? Object.keys(forecastData.forecasts).map(p => p.replace(/Sales/i, "").trim().toUpperCase()) : [];
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

    const totalPredictedSales = forecastData?.recommendations.reduce((sum, item) => sum + item.forecasted_sales, 0) || 0;
    const avgMape = forecastData && Object.keys(forecastData.model_metrics).length > 0 
        ? Object.values(forecastData.model_metrics).reduce((s:number, m:any) => s + (m.mape || 0), 0) / Object.keys(forecastData.model_metrics).length 
        : 0;
    const avgR2 = forecastData && Object.keys(forecastData.model_metrics).length > 0
        ? Object.values(forecastData.model_metrics).reduce((s:number, m:any) => s + (m.r2 || 0), 0) / Object.keys(forecastData.model_metrics).length
        : 0;
    // Accuracy is expressed as (100 - MAPE), the standard way to report forecast
    // accuracy. R2 is kept above for reference but is a poor "accuracy" metric on
    // noisy, mean-reverting demand series (it can be ~0 even when forecasts are close).
    const avgAccuracy = Math.max(0, Math.min(100, (1 - avgMape) * 100));
    const accuracyLabel =
        avgAccuracy >= 90 ? "Pipeline Sangat Akurat"
        : avgAccuracy >= 80 ? "Pipeline Akurat"
        : avgAccuracy >= 60 ? "Pipeline Cukup Akurat"
        : "Akurasi Terbatas — perlu lebih banyak data";

    // Missing-days info
    const missingWeeks = forecastData?.missing_days_by_week ? Object.entries(forecastData.missing_days_by_week) : [];
    const totalMissingDays = missingWeeks.reduce((sum, [, count]) => sum + count, 0);
    // Only show weeks that overlap with the displayed historical range
    const displayedWeeks = new Set(forecastData?.historical_dates || []);
    const visibleMissingWeeks = missingWeeks.filter(([week]) => displayedWeeks.has(week));

    // Time range subtitle
    const timeRangeLabel = forecastData?.historical_dates && forecastData.historical_dates.length > 0
        ? `${forecastData.historical_dates[0]} → ${forecastData.forecast_week}`
        : "";

    // Has any buffer been overridden?
    const hasOverrides = Object.keys(bufferOverrides).length > 0;

    // Previous predictions that are different from the current one
    const pastPredCount = previousPredictions.filter(p => p.forecast_week !== forecastData?.forecast_week).length;

    return (<>
        <div className="mb-6 sm:mb-12 space-y-4 sm:space-y-8 animate-fade-in">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                        AI Analitik & Tren
                    </h1>
                    <p className="text-muted-foreground mt-0.5 sm:mt-1 text-xs sm:text-sm">
                        Prediksi tingkat enterprise didukung XGBoost Machine Learning
                    </p>
                </div>
                {storeId && (
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => fetchForecast(storeId, true)} 
                            disabled={isLoading}
                            variant="outline"
                            className="shadow-sm border-primary/20 hover:bg-primary/5"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                            Perbarui Model
                        </Button>
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                (() => {
                    const isInsufficientData = error.toLowerCase().includes("not enough") || error.toLowerCase().includes("historical data") || error.toLowerCase().includes("history");
                    return isInsufficientData ? (
                        <div className="bg-muted border rounded-xl p-8 flex flex-col items-center text-center gap-4 shadow-sm">
                            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                                <BarChart3 className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground text-lg">Data riwayat belum cukup</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                    Model XGBoost membutuhkan setidaknya beberapa minggu riwayat penjualan untuk membuat prediksi.
                                    Hubungi admin untuk mengimpor data historis ke toko Anda.
                                </p>
                            </div>
                            <Button
                                onClick={() => storeId && fetchForecast(storeId, true)}
                                variant="outline"
                                size="sm"
                                disabled={isLoading}
                                className="border-primary/20 hover:bg-primary/5"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Coba Lagi
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-md flex items-center shadow-sm">
                            <AlertCircle className="w-5 h-5 mr-3" />
                            <div>
                                <p className="font-bold">Error pipeline model</p>
                                <p className="text-sm opacity-90">{error}</p>
                            </div>
                        </div>
                    );
                })()
            )}

            {/* Loading Skeletons */}
            {isLoading && !forecastData && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-32 w-full rounded-xl" />
                        <Skeleton className="h-32 w-full rounded-xl" />
                        <Skeleton className="h-32 w-full rounded-xl" />
                    </div>
                    <Skeleton className="h-96 w-full rounded-xl" />
                </div>
            )}

            {/* Dashboard Content */}
            {!isLoading && forecastData && (
                <div className="space-y-4 sm:space-y-6">

                    {/* ============================================================ */}
                    {/* FEATURE 2: Missing-Days Notification Banner                  */}
                    {/* ============================================================ */}
                    {totalMissingDays > 0 && (
                        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
                            <CardContent className="py-4">
                                <button
                                    className="w-full flex items-center justify-between text-left"
                                    onClick={() => setMissingDaysExpanded(prev => !prev)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground text-sm">
                                                {totalMissingDays} hari dengan data penjualan kosong terdeteksi
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Di {missingWeeks.length} minggu dalam rentang data Anda — ini dapat mempengaruhi akurasi prediksi
                                            </p>
                                        </div>
                                    </div>
                                    {missingDaysExpanded 
                                        ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> 
                                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                </button>

                                {missingDaysExpanded && (
                                    forecastData.missing_dates && forecastData.missing_dates.length > 0 ? (
                                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                                            <p className="text-xs text-muted-foreground mb-3">Tanggal dengan data penjualan kosong:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                {[...forecastData.missing_dates]
                                                    .sort()
                                                    .map(date => (
                                                        <div
                                                            key={date}
                                                            className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs"
                                                        >
                                                            <CalendarIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                            <span className="font-mono text-foreground">{date}</span>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                Klik "Perbarui Model" untuk melihat tanggal yang hilang secara individual.
                                            </p>
                                        </div>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                        <Card className="shadow-sm border-t-2 sm:border-t-4 border-t-primary">
                            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
                                <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground flex items-center">
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Jendela Prediksi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{forecastData.forecast_week}</div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Prediksi 7 Hari ke Depan</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-t-2 sm:border-t-4 border-t-primary">
                            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
                                <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground flex items-center">
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Total Volume Prediksi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{totalPredictedSales.toLocaleString()} Units</div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Gabungan semua varian aktif</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-t-2 sm:border-t-4 border-t-primary col-span-2 sm:col-span-2 lg:col-span-1">
                            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
                                <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground flex items-center">
                                    <Package className="w-4 h-4 mr-2" />
                                    Akurasi Model (Berdasarkan MAPE)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold flex items-baseline">
                                    {avgAccuracy.toFixed(1)}
                                    <span className="text-base sm:text-lg opacity-70 ml-1">%</span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-green-600 mt-0.5 sm:mt-1 dark:text-green-400 font-medium">{accuracyLabel}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chart Visualization */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Permintaan vs Stok yang Direkomendasikan</CardTitle>
                            <CardDescription>Korelasi visual antara prediksi permintaan ML dan stok yang disesuaikan keamanannya.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-56 sm:h-80 w-full mt-2 sm:mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                        <XAxis dataKey="name" tick={{fill: 'currentColor'}} opacity={0.7} />
                                        <YAxis tick={{fill: 'currentColor'}} opacity={0.7} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                                        <Bar dataKey="Prediksi Penjualan" fill="var(--color-primary, hsl(var(--primary)))" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Stok Direkomendasikan" fill="hsl(var(--warning))" opacity={0.85} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ============================================================ */}
                    {/* FEATURE 1 & 4: Line Chart with missing-day markers,          */}
                    {/*   extended timeline, and previous predictions                */}
                    {/* ============================================================ */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <CardTitle>Tren Historis & Prediksi</CardTitle>
                                    <CardDescription>
                                        {timeRangeLabel 
                                            ? <>Menampilkan data mingguan dari <span className="font-mono text-foreground/80">{timeRangeLabel}</span></> 
                                            : "Grafik garis penjualan aktual beberapa minggu terakhir hingga prediksi permintaan AI."}
                                    </CardDescription>
                                </div>
                                {pastPredCount > 0 && (
                                    <Button
                                        variant={showPrevPredictions ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setShowPrevPredictions(prev => !prev)}
                                        className="text-xs gap-1.5"
                                    >
                                        <History className="w-3.5 h-3.5" />
                                        {showPrevPredictions ? "Sembunyikan" : "Tampilkan"} Prediksi Lama ({pastPredCount})
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 sm:h-96 w-full mt-2 sm:mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{fill: 'currentColor', fontSize: 11}} 
                                            opacity={0.7} 
                                            angle={-30}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{fill: 'currentColor'}} opacity={0.7} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            content={({ active, payload, label }) => {
                                                if (!active || !payload?.length) return null;
                                                const dataPoint = payload[0]?.payload;
                                                const hasMissing = dataPoint?._missingDays > 0;
                                                return (
                                                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                                                        <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
                                                        {hasMissing && (
                                                            <p className="text-xs text-amber-500 font-medium mb-2 flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                {dataPoint._missingDays} hari data kosong minggu ini
                                                            </p>
                                                        )}
                                                        {payload.filter((p: any) => !p.dataKey.startsWith('_')).map((p: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                                                                <span className="text-muted-foreground">{p.dataKey.replace('_Pred', ' (Prediksi)').replace('_PrevPred', ' (Pred Lama)')}</span>
                                                                <span className="ml-auto font-mono font-medium text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }}/>

                                        {/* FEATURE 1: Reference lines for weeks with missing data */}
                                        {visibleMissingWeeks.map(([week, count]) => (
                                            <ReferenceLine 
                                                key={`missing-${week}`}
                                                x={week} 
                                                stroke="#f59e0b" 
                                                strokeDasharray="4 4" 
                                                strokeWidth={2}
                                                label={{
                                                    value: `⚠ ${count}h kosong`,
                                                    position: 'top',
                                                    fill: '#f59e0b',
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                }}
                                            />
                                        ))}

                                        {/* Actual sales lines */}
                                        {productKeys.map((key, index) => (
                                            <React.Fragment key={key}>
                                                <Line 
                                                    type="monotone" 
                                                    dataKey={key} 
                                                    stroke={colors[index % colors.length]} 
                                                    strokeWidth={3}
                                                    activeDot={{ r: 8 }} 
                                                    connectNulls={true}
                                                    dot={(props: any) => {
                                                        const { cx, cy, payload } = props;
                                                        const hasMissing = payload?._missingDays > 0;
                                                        if (hasMissing) {
                                                            return (
                                                                <g key={`dot-${key}-${props.index}`}>
                                                                    <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                                                                    <circle cx={cx} cy={cy} r={3} fill="#fff" />
                                                                </g>
                                                            );
                                                        }
                                                        return <circle key={`dot-${key}-${props.index}`} cx={cx} cy={cy} r={4} fill={colors[index % colors.length]} stroke="#fff" strokeWidth={2} />;
                                                    }}
                                                />
                                                {/* Current prediction dashed line */}
                                                <Line 
                                                    type="monotone" 
                                                    dataKey={`${key}_Pred`} 
                                                    stroke={colors[index % colors.length]} 
                                                    strokeWidth={3}
                                                    strokeDasharray="5 5"
                                                    activeDot={{ r: 8 }} 
                                                    connectNulls={true}
                                                    legendType="none"
                                                />
                                                {/* FEATURE 4: Previous prediction dots */}
                                                {showPrevPredictions && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey={`${key}_PrevPred`}
                                                        stroke={colors[index % colors.length]}
                                                        strokeWidth={0}
                                                        connectNulls={false}
                                                        legendType="none"
                                                        dot={(props: any) => {
                                                            const { cx, cy, value } = props;
                                                            if (value == null || isNaN(cx) || isNaN(cy)) return <g key={`prevdot-${key}-${props.index}`} />;
                                                            return (
                                                                <g key={`prevdot-${key}-${props.index}`}>
                                                                    <polygon
                                                                        points={`${cx},${cy - 7} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}`}
                                                                        fill={colors[index % colors.length]}
                                                                        opacity={0.45}
                                                                        stroke={colors[index % colors.length]}
                                                                        strokeWidth={1.5}
                                                                    />
                                                                </g>
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend footnote for special markers */}
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground border-t pt-3">
                                {visibleMissingWeeks.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                                        <span>Minggu data tidak lengkap</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: colors[0] }} />
                                    <span>Prediksi saat ini</span>
                                </div>
                                {showPrevPredictions && pastPredCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span style={{ fontSize: '10px' }}>▲</span>
                                        <span>Prediksi sebelumnya (segitiga semi-transparan)</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ============================================================ */}
                    {/* FEATURE 3: Editable Safety Buffer Table                      */}
                    {/* ============================================================ */}
                    <Card className="shadow-sm shadow-primary/5">
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <CardTitle>Rekomendasi Rantai Pasokan Detail</CardTitle>
                                    <CardDescription>Data tabel dengan detail buffer keamanan dan margin kesalahan per produk.</CardDescription>
                                </div>
                                {hasOverrides && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setBufferOverrides({})}
                                        className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Reset ke Algoritma
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-semibold">Klasifikasi Produk</TableHead>
                                            <TableHead className="text-right font-semibold">Permintaan Diprediksi</TableHead>
                                            <TableHead className="text-right font-semibold hidden md:table-cell">Margin Model (MAPE)</TableHead>
                                            <TableHead className="text-right font-semibold hidden sm:table-cell">
                                                <div className="flex items-center justify-end gap-1">
                                                    Buffer Algoritma
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal border-primary/30 text-primary">
                                                        dapat diubah
                                                    </Badge>
                                                </div>
                                            </TableHead>
                                            <TableHead className="text-right font-semibold text-primary">Target Stok Ulang</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {forecastData.recommendations.map((rec, i) => {
                                            const currentBuffer = getEffectiveBuffer(rec.product, rec.safety_buffer);
                                            const currentStock = getEffectiveStock(rec.forecasted_sales, rec.product, rec.safety_buffer);
                                            const isOverridden = bufferOverrides[rec.product] !== undefined;
                                            return (
                                                <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                                    <TableCell className="font-medium">
                                                        {rec.product.replace(/Sales/i, "").trim().toUpperCase()}
                                                    </TableCell>
                                                    <TableCell className="text-right">{rec.forecasted_sales.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right hidden md:table-cell">
                                                        <Badge variant="secondary" className="font-mono bg-background">
                                                            ±{rec.mape}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right hidden sm:table-cell">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-muted-foreground text-xs">+</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.5}
                                                                value={currentBuffer}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (!isNaN(val) && val >= 0) {
                                                                        setBufferOverrides(prev => ({ ...prev, [rec.product]: val }));
                                                                    }
                                                                }}
                                                                className={`w-24 h-8 text-right text-sm font-mono ${isOverridden ? 'border-primary/50 bg-primary/5' : ''}`}
                                                            />
                                                            {isOverridden && (
                                                                <button
                                                                    onClick={() => setBufferOverrides(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[rec.product];
                                                                        return next;
                                                                    })}
                                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                                    title="Reset to algorithm value"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge className={`px-3 py-1 font-bold text-sm shadow-none ${isOverridden ? 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:text-amber-400 hover:bg-amber-500/25' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'}`}>
                                                            {currentStock.toLocaleString()}
                                                            {isOverridden && <span className="ml-1 text-[9px] font-normal opacity-70">diubah</span>}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            {hasOverrides && (
                                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Anda telah mengubah nilai buffer. Grafik di atas diperbarui otomatis. Perubahan bersifat lokal dan tidak mempengaruhi model.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    </>
    );
}

