import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, FileSpreadsheet, Download, AlertCircle, Store } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';

interface SellerStore {
    id: string;
    name: string;
    seller_id: string;
    seller_name: string;
}

export default function AdminImportData() {
    const { toast } = useToast();
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // Load all seller stores with their owner profiles
    const { data: stores, isLoading: storesLoading } = useQuery<SellerStore[]>({
        queryKey: ['admin-seller-stores'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stores')
                .select('id, name, seller_id, profiles!stores_seller_id_fkey(name)')
                .order('name');
            if (error) throw error;
            return (data ?? []).map((s: any) => ({
                id: s.id,
                name: s.name,
                seller_id: s.seller_id,
                seller_name: s.profiles?.name ?? 'Unknown',
            }));
        },
    });

    const selectedStore = stores?.find(s => s.id === selectedStoreId) ?? null;

    const parseYYYYMMDD = (dateString: string) => {
        return new Date(dateString).toISOString();
    };

    const processDeveloperHistoricalSales = async (file: File) => {
        if (!selectedStoreId || !selectedStore) {
            toast({ title: "Error", description: "Please select a seller store first.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        setProgress(0);
        setStatusMessage("Parsing CSV file...");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[];
                if (rows.length === 0) {
                    setIsUploading(false);
                    return toast({ title: "Error", description: "CSV is empty." });
                }

                try {
                    setStatusMessage("Ensuring demo products exist...");
                    setProgress(10);

                    const storeId = selectedStoreId;
                    const sellerId = selectedStore.seller_id;

                    const targetProducts = ['original pie sales', 'choco pie sales', 'keju pie sales'];
                    const { data: existingProducts } = await supabase
                        .from('products')
                        .select('id, name')
                        .eq('store_id', storeId);

                    const productMap: Record<string, string> = {};

                    const toCreate: { id: string; target: string; cleanName: string }[] = [];
                    for (const target of targetProducts) {
                        const cleanName = target.replace(" sales", "");
                        const existing = existingProducts?.find(p => p.name.toLowerCase() === cleanName);
                        if (existing) {
                            productMap[target] = existing.id;
                        } else {
                            const newId = crypto.randomUUID();
                            toCreate.push({ id: newId, target, cleanName });
                            productMap[target] = newId;
                        }
                    }
                    if (toCreate.length > 0) {
                        await supabase.from('products').insert(
                            toCreate.map(({ id, cleanName }) => ({
                                id,
                                store_id: storeId,
                                name: cleanName,
                                category: "Pie",
                                price: 25000,
                                stock: 9999,
                            }))
                        );
                    }

                    setProgress(30);
                    setStatusMessage("Preparing massive DB injection...");

                    const ordersToInsert: any[] = [];
                    const orderItemsToInsert: any[] = [];
                    const transactionsToInsert: any[] = [];

                    // Use seller's own ID as the buyer for simulation
                    const simulatedBuyerId = sellerId;

                    rows.forEach((row) => {
                        const dailyDate = parseYYYYMMDD(row.date);
                        const orderId = crypto.randomUUID();

                        let orderTotal = 0;
                        const itemsForThisOrder = [];

                        for (const targetKey of targetProducts) {
                            const quantitySold = parseInt(row[targetKey]);
                            if (!isNaN(quantitySold) && quantitySold > 0) {
                                orderTotal += quantitySold * 25000;
                                itemsForThisOrder.push({
                                    id: crypto.randomUUID(),
                                    order_id: orderId,
                                    product_id: productMap[targetKey],
                                    quantity: quantitySold,
                                    unit_price: 25000,
                                    created_at: dailyDate,
                                });
                            }
                        }

                        if (itemsForThisOrder.length > 0) {
                            ordersToInsert.push({
                                id: orderId,
                                buyer_id: simulatedBuyerId,
                                store_id: storeId,
                                status: "selesai",
                                total_amount: orderTotal,
                                delivery_type: "ambil_sendiri",
                                created_at: dailyDate,
                                updated_at: dailyDate,
                            });
                            orderItemsToInsert.push(...itemsForThisOrder);
                            transactionsToInsert.push({
                                id: crypto.randomUUID(),
                                order_id: orderId,
                                buyer_id: simulatedBuyerId,
                                seller_id: sellerId,
                                payment_method: "simulation",
                                payment_status: "paid",
                                amount: orderTotal,
                                transaction_date: dailyDate,
                                created_at: dailyDate,
                                updated_at: dailyDate,
                            });
                        }
                    });

                    setProgress(50);
                    setStatusMessage(`Bulk inserting ${ordersToInsert.length} orders...`);

                    const BATCH_SIZE = 500;
                    for (let i = 0; i < ordersToInsert.length; i += BATCH_SIZE) {
                        const { error: ordErr } = await supabase.from('orders').insert(ordersToInsert.slice(i, i + BATCH_SIZE));
                        if (ordErr) throw ordErr;
                        setProgress(50 + (i / ordersToInsert.length) * 15);
                    }

                    setStatusMessage(`Bulk inserting ${orderItemsToInsert.length} pie sales...`);
                    for (let i = 0; i < orderItemsToInsert.length; i += BATCH_SIZE) {
                        const { error: itemErr } = await supabase.from('order_items').insert(orderItemsToInsert.slice(i, i + BATCH_SIZE));
                        if (itemErr) throw itemErr;
                        setProgress(65 + (i / orderItemsToInsert.length) * 15);
                    }

                    setStatusMessage(`Bulk inserting ${transactionsToInsert.length} transaction records...`);
                    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
                        const { error: txErr } = await supabase.from('transactions').insert(transactionsToInsert.slice(i, i + BATCH_SIZE));
                        if (txErr) throw txErr;
                        setProgress(80 + (i / transactionsToInsert.length) * 15);
                    }

                    setProgress(100);
                    setStatusMessage("Sales Successfully Simulated! Ready for Forecasting.");
                    toast({
                        title: "Massive Injection Complete",
                        description: `Loaded ${ordersToInsert.length} simulated daily orders into "${selectedStore.name}".`,
                    });
                } catch (err: any) {
                    console.error("Injection error:", err);
                    toast({ title: "Failed to inject data", description: err.message, variant: "destructive" });
                    setStatusMessage("Injection failed. Review console for details.");
                } finally {
                    setTimeout(() => setIsUploading(false), 2000);
                }
            },
        });
    };

    return (
        <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
                <p className="text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Load bulk historical data or products into any seller account.
                </p>
            </div>

            {/* Account Selector */}
            <Card className="border-t-4 border-t-primary shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Store className="w-4 h-4 text-primary" />
                        Target Seller Store
                    </CardTitle>
                    <CardDescription>
                        Select which seller account the data will be imported into.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select
                        value={selectedStoreId}
                        onValueChange={setSelectedStoreId}
                        disabled={storesLoading}
                    >
                        <SelectTrigger className="w-full max-w-md">
                            <SelectValue placeholder={storesLoading ? "Loading stores..." : "Select a seller store…"} />
                        </SelectTrigger>
                        <SelectContent>
                            {stores?.map(store => (
                                <SelectItem key={store.id} value={store.id}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{store.name}</span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                            {store.seller_name}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedStore && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Importing into: <span className="font-semibold text-foreground">{selectedStore.name}</span> (owned by {selectedStore.seller_name})
                        </p>
                    )}
                </CardContent>
            </Card>

            <Tabs defaultValue="developer" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="developer">Developer: SnackTrack ML</TabsTrigger>
                    <TabsTrigger value="products">Catalog Products</TabsTrigger>
                </TabsList>

                {/* Developer Form for processed pie data */}
                <TabsContent value="developer">
                    <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center text-primary">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                ML Pipeline Initializer
                            </CardTitle>
                            <CardDescription>
                                Upload the <code className="text-xs bg-muted px-1 rounded">snacktrack_processed_data.csv</code> to inject 800+ days of
                                historical sales (Original Pie, Choco Pie, Keju Pie) into the selected store.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!selectedStoreId && (
                                <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Select a seller store above before uploading.
                                </div>
                            )}

                            <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${selectedStoreId ? 'border-primary/20 bg-primary/5' : 'border-muted-foreground/20 bg-muted/30'}`}>
                                <UploadCloud className={`w-12 h-12 mx-auto mb-4 animate-bounce ${selectedStoreId ? 'text-primary' : 'text-muted-foreground'}`} />
                                <h3 className="text-lg font-semibold mb-2">Drop Processed Sales CSV Here</h3>
                                <p className="text-sm text-muted-foreground mb-6">File should contain original pie sales, choco pie sales, keju pie sales, and date columns.</p>
                                <Input
                                    type="file"
                                    accept=".csv"
                                    className="max-w-xs mx-auto file:bg-primary file:text-primary-foreground file:border-none file:mr-4 file:px-4 file:py-2 file:rounded-md cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            processDeveloperHistoricalSales(e.target.files[0]);
                                        }
                                    }}
                                    disabled={isUploading || !selectedStoreId}
                                />
                            </div>

                            {isUploading && (
                                <div className="space-y-2 pt-4 bg-background p-4 rounded-lg border">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>{statusMessage}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2 w-full animate-pulse" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Standard Catalog Import */}
                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk Upload Products</CardTitle>
                            <CardDescription>
                                Add hundreds of new catalog listings to the selected store using our standard template format.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center space-x-4 bg-muted p-4 rounded-lg border">
                                <Download className="w-6 h-6 text-muted-foreground" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium">1. Download Blank Template</h4>
                                    <p className="text-xs text-muted-foreground">Contains exactly the headers required (name, price, etc.)</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => window.open("/templates/bulk_products_template.csv", "_blank")}>
                                    Download CSV
                                </Button>
                            </div>

                            <div className="border-2 border-dashed rounded-xl p-12 text-center">
                                <UploadCloud className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">2. Upload Filled Template</h3>
                                <Input
                                    type="file"
                                    accept=".csv"
                                    className="max-w-xs mx-auto cursor-pointer"
                                    disabled={true}
                                />
                                <p className="text-xs text-muted-foreground mt-4">(Standard Product uploader is currently locked in preview mode)</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
