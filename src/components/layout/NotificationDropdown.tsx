import { useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotification } from "@/contexts/NotificationContext";
import { NotificationItem } from "./NotificationItem";
import { useNavigate } from "react-router-dom";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleNotificationClick = (notification: typeof notifications[0]) => {
        markAsRead(notification.id);
        if (notification.actionUrl) {
            navigate(notification.actionUrl);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-80 sm:w-96 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Notifikasi</span>
                    {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                        <CheckCheck className="h-3 w-3" />
                        Tandai semua dibaca
                    </button>
                )}
            </div>

            {/* Notifications list */}
            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                        Tidak ada notifikasi
                    </div>
                ) : (
                    notifications.slice(0, 10).map((notification) => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onClick={() => handleNotificationClick(notification)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
