import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerStore } from '@/hooks/useSellerStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';

export default function ImportData() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: sellerStore } = useSellerStore();
    const storeId = sellerStore?.id ?? null;
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // Format Dates nicely
    const parseYYYYMMDD = (dateString: string) => {
        return new Date(dateString).toISOString();
    }

    const processDeveloperHistoricalSales = async (file: File) => {
        if (!storeId || !user) {
            toast({ title: "Error", description: "You must have an active store to import data.", variant: "destructive" });
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
                    
                    // 1. Ensure basic pie products exist in this store
                    const targetProducts = ['original pie sales', 'choco pie sales', 'keju pie sales'];
                    const { data: existingProducts } = await supabase
                        .from('products')
                        .select('id, name')
                        .eq('store_id', storeId)

                    const productMap: Record<string, string> = {};
                    
                    // Collect products that need to be created, then batch insert
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

                    // Fetch the store's seller_id for transaction records
                    const { data: storeData } = await supabase
                        .from('stores')
                        .select('seller_id')
                        .eq('id', storeId)
                        .single();
                    const sellerId = storeData?.seller_id || user.id;

                    const ordersToInsert: any[] = [];
                    const orderItemsToInsert: any[] = [];
                    const transactionsToInsert: any[] = [];

                    // 2. Loop through all 800+ days in memory
                    rows.forEach((row, i) => {
                        const dailyDate = parseYYYYMMDD(row.date);
                        
                        // We generate our own UUIDs so we can flawlessly attach order_items in one transaction
                        const orderId = crypto.randomUUID();
                        
                        let orderTotal = 0;
                        const itemsForThisOrder = [];

                        for (const targetKey of targetProducts) {
                            const quantitySold = parseInt(row[targetKey]);
                            if (!isNaN(quantitySold) && quantitySold > 0) {
                                orderTotal += (quantitySold * 25000); // 25k per pie logic
                                itemsForThisOrder.push({
                                    id: crypto.randomUUID(),
                                    order_id: orderId,
                                    product_id: productMap[targetKey],
                                    quantity: quantitySold,
                                    unit_price: 25000,
                                    created_at: dailyDate
                                });
                            }
                        }

                        if (itemsForThisOrder.length > 0) {
                            // Create exactly one order for that DAY total — marked as "selesai" (finished)
                            ordersToInsert.push({
                                id: orderId,
                                buyer_id: user.id, // we use ourselves as the buyer for simulation
                                store_id: storeId,
                                status: "selesai",
                                total_amount: orderTotal,
                                delivery_type: "ambil_sendiri",
                                created_at: dailyDate,
                                updated_at: dailyDate
                            });
                            orderItemsToInsert.push(...itemsForThisOrder);

                            // Create a matching transaction row marked as paid
                            transactionsToInsert.push({
                                id: crypto.randomUUID(),
                                order_id: orderId,
                                buyer_id: user.id,
                                seller_id: sellerId,
                                payment_method: "simulation",
                                payment_status: "paid",
                                amount: orderTotal,
                                transaction_date: dailyDate,
                                created_at: dailyDate,
                                updated_at: dailyDate
                            });
                        }
                    });

                    setProgress(50);
                    setStatusMessage(`Bulk inserting ${ordersToInsert.length} orders...`);

                    // 3. Fire to Supabase. Batch size of 500 to avoid timeout limits.
                    const BATCH_SIZE = 500;
                    for (let i = 0; i < ordersToInsert.length; i += BATCH_SIZE) {
                        const orderBatch = ordersToInsert.slice(i, i + BATCH_SIZE);
                        const { error: ordErr } = await supabase.from('orders').insert(orderBatch);
                        if (ordErr) throw ordErr;
                        setProgress(50 + (i / ordersToInsert.length) * 15);
                    }

                    setStatusMessage(`Bulk inserting ${orderItemsToInsert.length} pie sales...`);
                    for (let i = 0; i < orderItemsToInsert.length; i += BATCH_SIZE) {
                        const itemBatch = orderItemsToInsert.slice(i, i + BATCH_SIZE);
                        const { error: itemErr } = await supabase.from('order_items').insert(itemBatch);
                        if (itemErr) throw itemErr;
                        setProgress(65 + (i / orderItemsToInsert.length) * 15);
                    }

                    setStatusMessage(`Bulk inserting ${transactionsToInsert.length} transaction records...`);
                    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
                        const txBatch = transactionsToInsert.slice(i, i + BATCH_SIZE);
                        const { error: txErr } = await supabase.from('transactions').insert(txBatch);
                        if (txErr) throw txErr;
                        setProgress(80 + (i / transactionsToInsert.length) * 15);
                    }

                    setProgress(100);
                    setStatusMessage("Sales Successfully Simulated! Ready for Forecasting.");
                    toast({
                        title: "🚀 Massive Injection Complete",
                        description: `Successfully loaded ${ordersToInsert.length} simulated daily orders for the ML API to digest.`
                    });

                } catch (err: any) {
                    console.error("Injection error:", err);
                    toast({ title: "Failed to Inject data", description: err.message, variant: "destructive" });
                    setStatusMessage("Injection failed. Review console for details.");
                } finally {
                    setTimeout(() => setIsUploading(false), 2000);
                }
            }
        });
    }

    const downloadTemplate = (url: string) => {
        window.open(url, "_blank");
    }

    return (
        <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
                <p className="text-muted-foreground flex items-center">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Instantly load vast amounts of products or historical transactions.
                </p>
            </div>

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
                                Exclusively for testing the XGBoost API. Upload the `snacktrack_processed_data.csv`. 
                                We will automatically spin up "Original Pie", "Choco Pie", and "Keju Pie" and inject all 800+ 
                                days natively into your Supabase node.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            <div className="border-2 border-dashed border-primary/20 rounded-xl p-12 text-center bg-primary/5">
                                <UploadCloud className="w-12 h-12 mx-auto text-primary mb-4 animate-bounce" />
                                <h3 className="text-lg font-semibold mb-2">Drop Processed Sales CSV Here</h3>
                                <p className="text-sm text-muted-foreground mb-6">File should contain original pie sales, dates, etc.</p>
                                
                                <Input 
                                    type="file" 
                                    accept=".csv" 
                                    className="max-w-xs mx-auto file:bg-primary file:text-primary-foreground file:border-none file:mr-4 file:px-4 file:py-2 file:rounded-md cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            processDeveloperHistoricalSales(e.target.files[0]);
                                        }
                                    }}
                                    disabled={isUploading}
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

                {/* Standard Catalog Import for normal users */}
                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk Upload Products</CardTitle>
                            <CardDescription>
                                Add hundreds of new catalog listings to your store instantly using our standard template format.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            <div className="flex items-center space-x-4 bg-muted p-4 rounded-lg border">
                                <Download className="w-6 h-6 text-muted-foreground" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium">1. Download Blank Template</h4>
                                    <p className="text-xs text-muted-foreground">Contains exactly the headers required (name, price, etc.)</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => downloadTemplate("/templates/bulk_products_template.csv")}>
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
