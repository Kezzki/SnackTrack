export type NotificationType = 'order' | 'order_status' | 'payment' | 'stock' | 'promo' | 'system';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    actionUrl?: string;
    /** Optional image URL shown as a header inside the expanded notification */
    imageUrl?: string;
    /** Order ID used for deep-linking to the exact order/transaction */
    orderId?: string;
}

export interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotification: (id: string) => void;
    clearAll: () => void;
    addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
}
