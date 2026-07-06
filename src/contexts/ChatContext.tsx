import {
    createContext, useContext, useState, useEffect,
    useRef, useCallback, ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatTarget {
    /** Pre-existing conversation id (when opening from /pesan) */
    conversationId?: string;
    storeId: string;
    storeName: string;
    storeAvatar?: string;
    /** auth.users id of the seller (store owner) */
    sellerId: string;
    productId?: string;
    productName?: string;
    productImage?: string;
    /** True when opened from a product page — product becomes a pending "inquiry" attached to the next sent message */
    isProductInquiry?: boolean;
}

export interface ChatTab {
    tabId: string;
    target: ChatTarget;
    unreadCount: number;
    previewText?: string;
}

export interface IncomingPreview {
    tabId: string;
    senderName: string;
    text: string;
    avatar?: string;
}

interface ChatContextType {
    chatTabs: ChatTab[];
    activeTabId: string | null;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    openChat: (target: ChatTarget, fromBackground?: boolean) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    registerTabConversation: (tabId: string, convId: string) => void;
    markTabRead: (tabId: string) => void;
    incomingPreview: IncomingPreview | null;
    clearIncomingPreview: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

let _tabCounter = 0;
function nextTabId() {
    return `tab_${++_tabCounter}_${Date.now()}`;
}

function playIncomingSound() {
    try {
        const AudioCtxCtor =
            window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxCtor) return;
        const ctx = new AudioCtxCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch {
        // non-critical
    }
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [chatTabs, setChatTabs] = useState<ChatTab[]>([]);
    const [activeTabId, _setActiveTabId] = useState<string | null>(null);
    const [isMinimized, _setIsMinimized] = useState(false);
    const [incomingPreview, setIncomingPreview] = useState<IncomingPreview | null>(null);

    // Stable refs for Realtime callbacks (avoid stale closures)
    const activeTabIdRef = useRef<string | null>(null);
    const isMinimizedRef = useRef(false);
    const tabConvIdsRef = useRef<Record<string, string>>({});  // tabId → convId

    const setActiveTabId = useCallback((id: string | null) => {
        _setActiveTabId(id);
        activeTabIdRef.current = id;
    }, []);

    const setIsMinimized = useCallback((v: boolean) => {
        _setIsMinimized(v);
        isMinimizedRef.current = v;
    }, []);

    // ── openChat ──────────────────────────────────────────────────────────────
    const openChat = useCallback(
        (target: ChatTarget, fromBackground = false) => {
            const convId = target.conversationId;

            setChatTabs((prev) => {
                // Look for an existing tab with same conversationId or same store+seller
                const existing = prev.find(
                    (t) =>
                        (convId &&
                            (t.target.conversationId === convId ||
                                tabConvIdsRef.current[t.tabId] === convId)) ||
                        (!convId &&
                            t.target.storeId === target.storeId &&
                            t.target.sellerId === target.sellerId)
                );

                if (existing) {
                    if (!fromBackground) {
                        setActiveTabId(existing.tabId);
                        setIsMinimized(false);
                    }
                    return prev;
                }

                const tabId = nextTabId();
                if (convId) tabConvIdsRef.current[tabId] = convId;

                if (!fromBackground) {
                    setActiveTabId(tabId);
                    setIsMinimized(false);
                } else if (prev.length === 0) {
                    // First background tab → show minimized
                    setActiveTabId(tabId);
                    setIsMinimized(true);
                }

                return [
                    ...prev,
                    { tabId, target, unreadCount: fromBackground ? 1 : 0 },
                ];
            });
        },
        [setActiveTabId, setIsMinimized]
    );

    // ── closeTab ──────────────────────────────────────────────────────────────
    const closeTab = useCallback(
        (tabId: string) => {
            delete tabConvIdsRef.current[tabId];
            setChatTabs((prev) => {
                const next = prev.filter((t) => t.tabId !== tabId);
                if (activeTabIdRef.current === tabId) {
                    const newActive =
                        next.length > 0 ? next[next.length - 1].tabId : null;
                    setActiveTabId(newActive);
                    if (!newActive) setIsMinimized(false);
                }
                return next;
            });
        },
        [setActiveTabId, setIsMinimized]
    );

    // ── setActiveTab ──────────────────────────────────────────────────────────
    const setActiveTab = useCallback(
        (tabId: string) => {
            setActiveTabId(tabId);
            setIsMinimized(false);
            setChatTabs((prev) =>
                prev.map((t) =>
                    t.tabId === tabId
                        ? { ...t, unreadCount: 0, previewText: undefined }
                        : t
                )
            );
        },
        [setActiveTabId, setIsMinimized]
    );

    // ── registerTabConversation ───────────────────────────────────────────────
    const registerTabConversation = useCallback(
        (tabId: string, convId: string) => {
            tabConvIdsRef.current[tabId] = convId;
        },
        []
    );

    // ── markTabRead ───────────────────────────────────────────────────────────
    const markTabRead = useCallback((tabId: string) => {
        setChatTabs((prev) =>
            prev.map((t) =>
                t.tabId === tabId
                    ? { ...t, unreadCount: 0, previewText: undefined }
                    : t
            )
        );
    }, []);

    const clearIncomingPreview = useCallback(() => setIncomingPreview(null), []);

    // ── Clear on logout ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) {
            setChatTabs([]);
            setActiveTabId(null);
            tabConvIdsRef.current = {};
            setIncomingPreview(null);
            setIsMinimized(false);
        }
    }, [user, setActiveTabId, setIsMinimized]);

    // ── Background inbox listener ─────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`inbox:${user.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                async (payload) => {
                    const msg = payload.new as {
                        id: string;
                        conversation_id: string;
                        sender_id: string;
                        content: string;
                    };
                    if (msg.sender_id === user.id) return;

                    // Find if an existing tab already handles this conversation
                    const matchingTabId = Object.entries(
                        tabConvIdsRef.current
                    ).find(([, cid]) => cid === msg.conversation_id)?.[0];

                    // Skip if the user is actively watching this tab
                    const isUserLooking =
                        matchingTabId !== undefined &&
                        matchingTabId === activeTabIdRef.current &&
                        !isMinimizedRef.current;
                    if (isUserLooking) return;

                    playIncomingSound();

                    // Fetch conversation info for display
                    const { data: conv } = await supabase
                        .from("conversations")
                        .select(
                            "id, store_id, seller_id, buyer_id, store:stores(name, image_url)"
                        )
                        .eq("id", msg.conversation_id)
                        .maybeSingle();
                    if (!conv) return;

                    let senderName: string =
                        (conv as any).store?.name ?? "Pesan Baru";
                    let senderAvatar: string | undefined =
                        (conv as any).store?.image_url ?? undefined;

                    if (user.id === (conv as any).seller_id) {
                        const { data: bp } = await supabase
                            .from("profiles")
                            .select("name, avatar_url")
                            .eq("id", (conv as any).buyer_id)
                            .single();
                        senderName = (bp as any)?.name ?? "Pembeli";
                        senderAvatar = (bp as any)?.avatar_url ?? undefined;
                    }

                    if (matchingTabId) {
                        // Existing tab → increment unread badge
                        setChatTabs((prev) =>
                            prev.map((t) =>
                                t.tabId === matchingTabId
                                    ? {
                                          ...t,
                                          unreadCount: t.unreadCount + 1,
                                          previewText: msg.content,
                                      }
                                    : t
                            )
                        );
                        setIncomingPreview({
                            tabId: matchingTabId,
                            senderName,
                            text: msg.content,
                            avatar: senderAvatar,
                        });
                    } else {
                        // New conversation → open a new minimized tab
                        const tabId = nextTabId();
                        tabConvIdsRef.current[tabId] = msg.conversation_id;
                        const target: ChatTarget = {
                            conversationId: msg.conversation_id,
                            storeId: (conv as any).store_id,
                            storeName: senderName,
                            storeAvatar: senderAvatar,
                            sellerId: (conv as any).seller_id,
                        };
                        setChatTabs((prev) => {
                            if (prev.length === 0) {
                                setActiveTabId(tabId);
                                setIsMinimized(true);
                            }
                            return [
                                ...prev,
                                { tabId, target, unreadCount: 1, previewText: msg.content },
                            ];
                        });
                        setIncomingPreview({
                            tabId,
                            senderName,
                            text: msg.content,
                            avatar: senderAvatar,
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return (
        <ChatContext.Provider
            value={{
                chatTabs,
                activeTabId,
                isMinimized,
                setIsMinimized,
                openChat,
                closeTab,
                setActiveTab,
                registerTabConversation,
                markTabRead,
                incomingPreview,
                clearIncomingPreview,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error("useChat must be used within ChatProvider");
    return ctx;
}
