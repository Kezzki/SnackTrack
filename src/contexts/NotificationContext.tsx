import { createContext, useContext, useState, useMemo, useEffect } from "react";
import type { Notification, NotificationContextType } from "@/types/notification";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, activeRole } = useAuth();
    const isSeller = activeRole === "penjual";
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { toast } = useToast();

    const addNotification = async (notif: Omit<Notification, "id" | "timestamp" | "read">) => {
        if (!user) return;
        
        try {
            const { data, error } = await supabase.from("notifications").insert({
                user_id: user.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                action_url: notif.actionUrl,
                image_url: notif.imageUrl ?? null,
                order_id: notif.orderId ?? null,
                is_read: false
            }).select().single();

            if (error) throw error;
            if (data) {
                const newNotif: Notification = {
                    id: data.id,
                    title: data.title,
                    message: data.message,
                    type: data.type as any,
                    read: data.is_read,
                    timestamp: data.created_at,
                    actionUrl: data.action_url || undefined,
                    imageUrl: data.image_url || undefined,
                    orderId: data.order_id || undefined,
                };
                setNotifications((prev) => [newNotif, ...prev]);
                toast({
                    title: notif.title,
                    description: notif.message,
                });
            }
        } catch (err) {
            console.error("Error creating notification:", err);
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        async function loadNotifications() {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false });
                
            if (!error && data) {
                const mapped: Notification[] = data.map((n: any) => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    type: n.type as any,
                    read: n.is_read,
                    timestamp: n.created_at,
                    actionUrl: n.action_url || undefined,
                    imageUrl: n.image_url || undefined,
                    orderId: n.order_id || undefined,
                }));
                setNotifications(mapped);
            }
        }
        
        loadNotifications();

        // Real-time subscription: push new notifications as they arrive (e.g. from Midtrans webhook)
        // This means buyers/sellers get live toasts without refreshing the page
        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on(
                "postgres_changes" as any,
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const n = payload.new;
                    if (!n) return;
                    const newNotif: Notification = {
                        id: n.id,
                        title: n.title,
                        message: n.message,
                        type: n.type as any,
                        read: n.is_read,
                        timestamp: n.created_at,
                        actionUrl: n.action_url || undefined,
                        imageUrl: n.image_url || undefined,
                        orderId: n.order_id || undefined,
                    };
                    setNotifications((prev) => {
                        // Avoid duplicates in case loadNotifications already fetched it
                        if (prev.some((p) => p.id === newNotif.id)) return prev;
                        return [newNotif, ...prev];
                    });
                    toast({ title: n.title, description: n.message });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast]);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    const markAsRead = async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    };

    const markAllAsRead = async () => {
        if (!user) return;
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    };

    const clearNotification = async (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        await supabase.from("notifications").delete().eq("id", id);
    };

    const clearAll = async () => {
        if (!user) return;
        setNotifications([]);
        await supabase.from("notifications").delete().eq("user_id", user.id);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll, addNotification }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
}
