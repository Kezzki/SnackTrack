import { Package, CreditCard, AlertTriangle, Tag, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";
import { formatDistanceToNow, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface NotificationItemProps {
    notification: Notification;
    onClick: () => void;
}

const iconMap = {
    order: Package,
    payment: CreditCard,
    stock: AlertTriangle,
    promo: Tag,
    system: Bell,
};

const colorMap = {
    order: "text-blue-600 bg-blue-50",
    payment: "text-emerald-600 bg-emerald-50",
    stock: "text-orange-600 bg-orange-50",
    promo: "text-purple-600 bg-purple-50",
    system: "text-gray-600 bg-gray-50",
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const Icon = iconMap[notification.type];
    const colors = colorMap[notification.type];

    const timeAgo = formatDistanceToNow(parseISO(notification.timestamp), {
        addSuffix: true,
        locale: idLocale,
    });

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                !notification.read && "bg-primary/5"
            )}
        >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", colors)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-medium", !notification.read && "font-semibold")}>{notification.title}</p>
                    {!notification.read && <span className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
            </div>
        </button>
    );
}
