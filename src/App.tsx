import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminRoute } from "@/components/layout/AdminRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminFinance from "@/pages/admin/AdminFinance";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminImportData from "@/pages/admin/AdminImportData";

// Pages
import Auth from "@/pages/Auth";
import RoleSelection from "@/pages/RoleSelection";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import StoreSettings from "@/pages/StoreSettings";
import BuyerStore from "@/pages/BuyerStore";
import ProductDetail from "@/pages/ProductDetail";
import BuyerTransactions from "@/pages/BuyerTransactions";
import BuyerOnboarding from "@/pages/BuyerOnboarding";
import SellerOnboarding from "@/pages/SellerOnboarding";
import StoreProfile from "@/pages/StoreProfile";
import NotFound from "@/pages/NotFound";
import Notifications from "@/pages/Notifications";
import PaymentResult from "@/pages/PaymentResult";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import RefundPolicy from "@/pages/RefundPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import Messages from "@/pages/Messages";
import Balance from "@/pages/Balance";
import BuyerBalance from "@/pages/BuyerBalance";
import { ChatProvider } from "@/contexts/ChatContext";
import { ChatOverlay } from "@/components/chat/ChatOverlay";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Disable automatic refetch on window focus — the app uses Supabase
            // realtime subscriptions for live updates, so hammering the DB every
            // time the user alt-tabs is unnecessary and hurts scalability.
            refetchOnWindowFocus: false,
            // Default stale time of 2 minutes. Queries that need fresher data
            // (e.g. orders) can override this individually.
            staleTime: 1000 * 60 * 2,
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <ThemeProvider>
                    <SidebarProvider>
                    <TooltipProvider>
                        <AuthProvider>
                            <NotificationProvider>
                                <CartProvider>
                                    <OnboardingProvider>
                                        <ChatProvider>
                                        <Toaster />
                                        <ChatOverlay />
                                        <Routes>
                                        <Route path="/auth" element={<Auth />} />

                                        {/* Public catalog — no auth required */}
                                        <Route path="/jelajahi" element={<BuyerStore isPublic />} />
                                        <Route path="/produk/:id" element={<ProductDetail />} />
                                        <Route path="/toko/profil/:id" element={<StoreProfile />} />

                                        <Route path="/pilih-peran" element={<ProtectedRoute skipRoleCheck><RoleSelection /></ProtectedRoute>} />

                                        {/* Onboarding routes */}
                                        <Route path="/onboarding/pembeli" element={<ProtectedRoute skipRoleCheck><BuyerOnboarding /></ProtectedRoute>} />
                                        <Route path="/onboarding/penjual" element={<ProtectedRoute skipRoleCheck><SellerOnboarding /></ProtectedRoute>} />

                                        {/* Seller routes */}
                                        <Route path="/" element={<ProtectedRoute requiredRole="penjual"><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<Dashboard />} />
                                            <Route path="products" element={<Products />} />
                                            <Route path="orders" element={<Orders />} />
                            <Route path="orders/:id" element={<OrderDetail />} />
                                            <Route path="analytics" element={<Analytics />} />
                                            <Route path="settings" element={<Settings />} />
                                            <Route path="store-settings" element={<StoreSettings />} />
                                            <Route path="balance" element={<Balance />} />
                                        </Route>

                                        {/* Buyer routes */}
                                        <Route path="/toko" element={<ProtectedRoute requiredRole="pembeli"><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<BuyerStore />} />
                                        </Route>
                                        <Route path="/transaksi" element={<ProtectedRoute requiredRole="pembeli"><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<BuyerTransactions />} />
                                        </Route>
                                        <Route path="/saldo" element={<ProtectedRoute requiredRole="pembeli"><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<BuyerBalance />} />
                                        </Route>
                                        <Route path="/pengaturan" element={<ProtectedRoute requiredRole="pembeli"><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<Settings />} />
                                        </Route>

                                        {/* Payment result (after Duitku redirect) */}
                                        <Route path="/payment/result" element={<PaymentResult />} />

                                        {/* Shared routes */}
                                        <Route path="/notifikasi" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<Notifications />} />
                                        </Route>

                                        <Route path="/pesan" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                                            <Route index element={<Messages />} />
                                        </Route>
                                        
                                        {/* Static Pages */}
                                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                                        <Route path="/refund-policy" element={<RefundPolicy />} />
                                        <Route path="/terms-of-use" element={<TermsOfUse />} />

                                        {/* Admin routes */}
                                        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                                            <Route index element={<Navigate to="/admin/users" replace />} />
                                            <Route path="users" element={<AdminUsers />} />
                                            <Route path="finance" element={<AdminFinance />} />
                                            <Route path="notifications" element={<AdminNotifications />} />
                                            <Route path="import-data" element={<AdminImportData />} />
                                        </Route>

                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                        </ChatProvider>
                                </OnboardingProvider>
                            </CartProvider>
                            </NotificationProvider>
                        </AuthProvider>
                    </TooltipProvider>
                    </SidebarProvider>
                </ThemeProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
