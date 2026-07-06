import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    X, Send, MessageCircle, Package, ChevronDown,
    Check, CheckCheck, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
    useChat, ChatTab, IncomingPreview,
} from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
    product_name?: string | null;
    product_image?: string | null;
}

interface PendingProduct {
    id?: string;
    name: string;
    image?: string;
}

interface ProductCard {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    stock: number;
}

// ── Product card parser ───────────────────────────────────────────────────
const PRODUCT_JSON_RE = /\[PRODUCTS_JSON\]([\s\S]*?)\[\/PRODUCTS_JSON\]/i;

function parseMessageContent(content: string): { text: string; products: ProductCard[] } {
    const match = content.match(PRODUCT_JSON_RE);
    if (!match) return { text: content, products: [] };
    const text = content.replace(PRODUCT_JSON_RE, "").trim();
    try {
        return { text, products: JSON.parse(match[1]) as ProductCard[] };
    } catch {
        return { text: content, products: [] };
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPING_STOP_DELAY = 2000;

function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return "Status tidak diketahui";
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 5) return "Sedang online";
    if (mins < 60) return `Online ${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Online ${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Online kemarin";
    return `Online ${days} hari lalu`;
}

function formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

// ── IncomingPreviewToast ────────────────────────────────────────────────────

interface PreviewToastProps {
    preview: IncomingPreview | null;
    onClose: () => void;
}

function IncomingPreviewToast({ preview, onClose }: PreviewToastProps) {
    type AnimState = "idle" | "visible" | "leaving";
    const [anim, setAnim] = useState<AnimState>("idle");
    const [current, setCurrent] = useState<IncomingPreview | null>(null);
    const autoTimer = useRef<ReturnType<typeof setTimeout>>();
    const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (!preview) return;

        // Cancel any in-flight timers from a previous preview
        clearTimeout(autoTimer.current);
        clearTimeout(leaveTimer.current);

        setCurrent(preview);
        setAnim("idle");

        // Give one frame for the idle state to apply before animating in
        const enterTimer = setTimeout(() => {
            setAnim("visible");

            autoTimer.current = setTimeout(() => {
                setAnim("leaving");
                leaveTimer.current = setTimeout(() => {
                    setAnim("idle");
                    setCurrent(null);
                    onClose();
                }, 350);
            }, 3000);
        }, 30);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(autoTimer.current);
            clearTimeout(leaveTimer.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preview]);

    const dismiss = () => {
        clearTimeout(autoTimer.current);
        setAnim("leaving");
        leaveTimer.current = setTimeout(() => {
            setAnim("idle");
            setCurrent(null);
            onClose();
        }, 350);
    };

    if (!current || anim === "idle") return null;

    return (
        <div
            className={cn(
                "w-full bg-card border border-border rounded-2xl shadow-2xl",
                "px-3 py-2.5 flex items-center gap-2.5 mb-2",
                "transition-all duration-300 ease-out",
                anim === "visible"
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6 pointer-events-none"
            )}
        >
            {current.avatar ? (
                <img
                    src={current.avatar}
                    alt={current.senderName}
                    className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                />
            ) : (
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white">
                    {getInitials(current.senderName)}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                    {current.senderName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                    {current.text}
                </p>
            </div>
            <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={dismiss}
            >
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
}

// ── ChatTabPane ────────────────────────────────────────────────────────────────

interface ChatTabPaneProps {
    tab: ChatTab;
    isActive: boolean;
    isMinimized: boolean;
}

function ChatTabPane({ tab, isActive, isMinimized }: ChatTabPaneProps) {
    const { user } = useAuth();
    const { closeTab, markTabRead, registerTabConversation, setIsMinimized } = useChat();

    const [conversationId, setConversationId] = useState<string | null>(
        tab.target.conversationId ?? null
    );
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sellerLastSeen, setSellerLastSeen] = useState<string | null>(null);
    const [otherTyping, setOtherTyping] = useState(false);
    const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);

    const bottomRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    // Keep own last_seen fresh while this pane is visible
    useEffect(() => {
        if (!user || !isActive || isMinimized) return;
        const update = () =>
            supabase
                .from("profiles")
                .update({ last_seen: new Date().toISOString() })
                .eq("id", user.id)
                .then(() => {});
        update();
        const id = setInterval(update, 30_000);
        return () => clearInterval(id);
    }, [user, isActive, isMinimized]);

    // Pending product: initialise once from tab target (on mount only)
    useEffect(() => {
        if (tab.target.isProductInquiry && tab.target.productName) {
            setPendingProduct({
                id: tab.target.productId,
                name: tab.target.productName,
                image: tab.target.productImage,
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Initialize conversation once on mount
    useEffect(() => {
        if (!user) return;

        (async () => {
            let convId = tab.target.conversationId ?? null;

            if (!convId) {
                // Buyer initiating: find or create
                const { data: existing } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("buyer_id", user.id)
                    .eq("seller_id", tab.target.sellerId)
                    .eq("store_id", tab.target.storeId)
                    .maybeSingle();

                if (existing) {
                    convId = existing.id;
                } else {
                    const { data: created, error } = await supabase
                        .from("conversations")
                        .insert({
                            buyer_id: user.id,
                            seller_id: tab.target.sellerId,
                            store_id: tab.target.storeId,
                            product_id: tab.target.productId ?? null,
                            product_name: tab.target.productName ?? null,
                            product_image: tab.target.productImage ?? null,
                            last_message: "",
                            last_message_at: new Date().toISOString(),
                        })
                        .select("id")
                        .single();

                    if (error || !created) return;
                    convId = created.id;
                }
            }

            setConversationId(convId);
            registerTabConversation(tab.tabId, convId);

            // Load message history
            const { data: msgs } = await supabase
                .from("messages")
                .select("id, sender_id, content, created_at, read_at, product_name, product_image")
                .eq("conversation_id", convId)
                .order("created_at", { ascending: true });
            setMessages(msgs ?? []);

            // Fetch other party's last_seen
            let otherPartyId: string | null =
                user.id !== tab.target.sellerId ? tab.target.sellerId : null;
            if (!otherPartyId) {
                const { data: conv } = await supabase
                    .from("conversations")
                    .select("buyer_id")
                    .eq("id", convId)
                    .single();
                otherPartyId = (conv as any)?.buyer_id ?? null;
            }
            if (otherPartyId) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("last_seen")
                    .eq("id", otherPartyId)
                    .single();
                setSellerLastSeen((profile as any)?.last_seen ?? null);
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Real-time subscription
    useEffect(() => {
        if (!conversationId || !user) return;

        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const channel = supabase
            .channel(`chat:${conversationId}:${tab.tabId}`, {
                config: { broadcast: { self: false } },
            })
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages((prev) =>
                        prev.some((m) => m.id === newMsg.id)
                            ? prev
                            : [...prev, newMsg]
                    );
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const updated = payload.new as Message;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === updated.id
                                ? { ...m, read_at: updated.read_at }
                                : m
                        )
                    );
                }
            )
            .on("broadcast", { event: "typing" }, (payload) => {
                if (payload.payload?.user_id === user.id) return;
                setOtherTyping(!!payload.payload?.typing);
            })
            .subscribe();

        channelRef.current = channel;
        return () => {
            supabase.removeChannel(channel);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        };
    }, [conversationId, user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mark incoming messages as read when pane is active + expanded
    useEffect(() => {
        if (!conversationId || !user || !isActive || isMinimized) return;
        const unread = messages.filter(
            (m) => m.sender_id !== user.id && !m.read_at
        );
        if (unread.length === 0) return;

        markTabRead(tab.tabId);
        const ids = unread.map((m) => m.id);
        const now = new Date().toISOString();
        setMessages((prev) =>
            prev.map((m) => (ids.includes(m.id) ? { ...m, read_at: now } : m))
        );
        supabase
            .from("messages")
            .update({ read_at: now })
            .in("id", ids)
            .then(() => {});
    }, [messages, conversationId, user, isActive, isMinimized]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll on new messages / typing
    useEffect(() => {
        if (isActive && !isMinimized) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isActive, isMinimized, otherTyping]);

    const broadcastTyping = useCallback(
        (typing: boolean) => {
            if (!channelRef.current) return;
            channelRef.current.send({
                type: "broadcast",
                event: "typing",
                payload: { user_id: user?.id, typing },
            });
        },
        [user]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            broadcastTyping(true);
        }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            isTypingRef.current = false;
            broadcastTyping(false);
        }, TYPING_STOP_DELAY);
    };

    const sendMessage = async () => {
        if (!input.trim() || !conversationId || !user || sending) return;
        const content = input.trim();
        const attachedProduct = pendingProduct;
        setInput("");
        setPendingProduct(null);
        setSending(true);

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        isTypingRef.current = false;
        broadcastTyping(false);

        const { error } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            product_id: attachedProduct?.id ?? null,
            product_name: attachedProduct?.name ?? null,
            product_image: attachedProduct?.image ?? null,
        });
        if (!error) {
            await supabase
                .from("conversations")
                .update({
                    last_message: content,
                    last_message_at: new Date().toISOString(),
                })
                .eq("id", conversationId);

            // Fire-and-forget AI auto-reply when a buyer messages a store
            if (user.id !== tab.target.sellerId) {
                supabase.auth.getSession().then(({ data }) => {
                    const token = data.session?.access_token;
                    if (!token) { console.warn("[auto-reply] No session token — skipping."); return; }
                    if (!tab.target.storeId) { console.warn("[auto-reply] Missing storeId — skipping."); return; }
                    fetch("/api/auto-reply", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            store_id: tab.target.storeId,
                            conversation_id: conversationId,
                            buyer_message: content,
                        }),
                    })
                    .then(async (res) => {
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                            console.error("[auto-reply] API error:", res.status, json);
                        } else if (json.skipped) {
                            console.info("[auto-reply] Skipped — auto_reply_enabled is off for this store.");
                        } else if (json.success) {
                            console.info("[auto-reply] AI reply sent.");
                        }
                    })
                    .catch((err) => console.error("[auto-reply] Fetch failed (check if /api/auto-reply is reachable):", err));
                });
            }
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const storeInitials = getInitials(tab.target.storeName);
    const hasUnread = tab.unreadCount > 0;

    return (
        <div className={isActive ? "flex flex-col flex-1 min-h-0" : "hidden"}>
            {/* Header */}
            <div
                className={cn(
                    "flex items-center gap-3 px-4 py-3 gradient-primary text-white flex-shrink-0",
                    hasUnread && isMinimized && "ring-2 ring-inset ring-warning/60"
                )}
            >
                {tab.target.storeAvatar ? (
                    <img
                        src={tab.target.storeAvatar}
                        alt={tab.target.storeName}
                        className="w-9 h-9 rounded-full object-cover border-2 border-white/30 flex-shrink-0"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 border-white/30">
                        {storeInitials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate leading-tight">
                        {tab.target.storeName}
                    </p>
                    <p className="text-[11px] text-white/70 truncate">
                        {otherTyping ? (
                            <span className="italic">sedang mengetik…</span>
                        ) : (
                            formatLastSeen(sellerLastSeen)
                        )}
                    </p>
                </div>
                {/* Unread badge in header (visible when minimized) */}
                {hasUnread && isMinimized && (
                    <span className="min-w-[20px] h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white px-1 flex-shrink-0 animate-pulse">
                        {tab.unreadCount > 9 ? "9+" : tab.unreadCount}
                    </span>
                )}
                <div className="flex items-center gap-0.5">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:bg-white/15 rounded-full"
                        onClick={() => setIsMinimized(!isMinimized)}
                        title={isMinimized ? "Buka" : "Kecilkan"}
                    >
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 transition-transform duration-200",
                                isMinimized && "rotate-180"
                            )}
                        />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:bg-white/15 rounded-full"
                        onClick={() => closeTab(tab.tabId)}
                        title="Tutup"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Body — hidden when minimized */}
            {!isMinimized && (
                <>
                    {/* Messages */}
                    <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1 min-h-0 sm:flex-none sm:h-[320px] bg-background/95">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground select-none">
                                <MessageCircle className="h-8 w-8 opacity-25" />
                                <p className="text-sm text-center">
                                    Mulai percakapan dengan
                                    <br />
                                    <span className="font-medium text-foreground">
                                        {tab.target.storeName}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMine = msg.sender_id === user?.id;
                                const isRead = !!msg.read_at;
                                const { text: msgText, products: msgProducts } = parseMessageContent(msg.content);
                                return (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex",
                                            isMine ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug break-words",
                                                isMine
                                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                                    : "bg-muted text-foreground rounded-bl-sm"
                                            )}
                                        >
                                            {msg.product_name && (
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-2 mb-1.5 p-1.5 rounded-lg border",
                                                        isMine
                                                            ? "bg-white/10 border-white/20"
                                                            : "bg-background/60 border-border"
                                                    )}
                                                >
                                                    {msg.product_image ? (
                                                        <img
                                                            src={msg.product_image}
                                                            alt={msg.product_name}
                                                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p
                                                            className={cn(
                                                                "text-[10px] leading-none mb-0.5",
                                                                isMine
                                                                    ? "text-primary-foreground/60"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            Tanya tentang produk
                                                        </p>
                                                        <p className="text-xs font-medium truncate">
                                                            {msg.product_name}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="whitespace-pre-wrap">{msgText}</p>
                                            {msgProducts.length > 0 && (
                                                <div className="mt-2 flex flex-col gap-1.5">
                                                    {msgProducts.map((p) => (
                                                        <Link
                                                            key={p.id}
                                                            to={`/produk/${p.id}`}
                                                            className={cn(
                                                                "flex items-center gap-2.5 p-2 rounded-xl border transition-colors",
                                                                isMine
                                                                    ? "bg-white/10 border-white/20 hover:bg-white/20"
                                                                    : "bg-background border-border hover:bg-accent"
                                                            )}
                                                        >
                                                            {p.image_url ? (
                                                                <img
                                                                    src={p.image_url}
                                                                    alt={p.name}
                                                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold truncate">{p.name}</p>
                                                                <p className={cn(
                                                                    "text-[11px] truncate",
                                                                    isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                                                                )}>
                                                                    Rp{p.price.toLocaleString("id-ID")} &middot; Stok: {p.stock}
                                                                </p>
                                                            </div>
                                                            <ExternalLink className={cn(
                                                                "h-3 w-3 flex-shrink-0",
                                                                isMine ? "text-primary-foreground/50" : "text-muted-foreground"
                                                            )} />
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1 mt-0.5",
                                                    isMine ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "text-[10px]",
                                                        isMine
                                                            ? "text-primary-foreground/60"
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    {formatTime(msg.created_at)}
                                                </span>
                                                {isMine &&
                                                    (isRead ? (
                                                        <CheckCheck className="h-3 w-3 text-primary-foreground/80 flex-shrink-0" />
                                                    ) : (
                                                        <Check className="h-3 w-3 text-primary-foreground/40 flex-shrink-0" />
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Typing indicator */}
                        {otherTyping && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Pending product inquiry strip */}
                    {pendingProduct && (
                        <div className="flex items-center gap-2 mx-3 mb-1 px-2 py-1.5 rounded-lg bg-primary/10 border-l-2 border-primary">
                            {pendingProduct.image ? (
                                <img
                                    src={pendingProduct.image}
                                    alt={pendingProduct.name}
                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                            ) : (
                                <Package className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-primary font-medium leading-none mb-0.5">
                                    Tanya tentang produk
                                </p>
                                <p className="text-xs truncate text-foreground">
                                    {pendingProduct.name}
                                </p>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground flex-shrink-0"
                                onClick={() => setPendingProduct(null)}
                                title="Hapus lampiran"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* Input bar */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-background flex-shrink-0">
                        <Input
                            placeholder="Ketik pesan..."
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            className="flex-1 h-9 text-sm"
                            maxLength={500}
                            autoComplete="off"
                        />
                        <Button
                            size="icon"
                            className="h-9 w-9 flex-shrink-0"
                            onClick={sendMessage}
                            disabled={!input.trim() || sending}
                            title="Kirim"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

// ── ChatOverlay (main export) ────────────────────────────────────────────────

export function ChatOverlay() {
    const {
        chatTabs, activeTabId, isMinimized, setIsMinimized,
        closeTab, setActiveTab,
        incomingPreview, clearIncomingPreview,
    } = useChat();
    const isMobile = useIsMobile();

    // Mobile dock drag state — must be declared before any early returns
    const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(null);
    const dockDragRef = useRef<{
        startPointerX: number;
        startPointerY: number;
        startPosX: number;
        startPosY: number;
    } | null>(null);
    const dockWasDragged = useRef(false);

    useEffect(() => {
        setDockPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    }, []);

    if (chatTabs.length === 0) return null;

    const totalUnread = chatTabs.reduce((sum, t) => sum + t.unreadCount, 0);

    // ── Mobile minimized: draggable floating avatar dock ─────────────────────
    if (isMobile && isMinimized) {
        const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dockWasDragged.current = false;
            dockDragRef.current = {
                startPointerX: e.clientX,
                startPointerY: e.clientY,
                startPosX: dockPos?.x ?? window.innerWidth - 80,
                startPosY: dockPos?.y ?? window.innerHeight - 80,
            };
        };
        const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
            if (!dockDragRef.current) return;
            const dx = e.clientX - dockDragRef.current.startPointerX;
            const dy = e.clientY - dockDragRef.current.startPointerY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dockWasDragged.current = true;
            setDockPos({
                x: Math.max(8, Math.min(window.innerWidth - 64, dockDragRef.current.startPosX + dx)),
                y: Math.max(8, Math.min(window.innerHeight - 64, dockDragRef.current.startPosY + dy)),
            });
        };
        const handlePointerUp = () => { dockDragRef.current = null; };

        return (
            <div
                className="fixed z-[100] flex flex-col items-end gap-2 touch-none select-none"
                style={dockPos ? { left: dockPos.x, top: dockPos.y } : { bottom: 16, right: 16 }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <IncomingPreviewToast preview={incomingPreview} onClose={clearIncomingPreview} />
                <div className="flex flex-row-reverse items-end gap-2">
                    {[...chatTabs].reverse().slice(0, 4).map((tab) => {
                        const initials = getInitials(tab.target.storeName);
                        return (
                            <button
                                key={tab.tabId}
                                onClick={() => {
                                    if (dockWasDragged.current) { dockWasDragged.current = false; return; }
                                    setActiveTab(tab.tabId);
                                }}
                                className="relative w-13 h-13 rounded-full shadow-2xl border-2 border-background focus:outline-none active:scale-95 transition-transform"
                                title={tab.target.storeName}
                            >
                                {tab.target.storeAvatar ? (
                                    <img
                                        src={tab.target.storeAvatar}
                                        className="w-12 h-12 rounded-full object-cover"
                                        alt={tab.target.storeName}
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-base">
                                        {initials.charAt(0)}
                                    </div>
                                )}
                                {tab.unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-background px-0.5">
                                        {tab.unreadCount > 9 ? "9+" : tab.unreadCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Mobile expanded: bottom sheet ─────────────────────────────────────────
    if (isMobile && !isMinimized) {
        return (
            <>
                {/* Backdrop — tap to minimize back to dock */}
                <div
                    className="fixed inset-0 z-[99] bg-black/60"
                    onClick={() => setIsMinimized(true)}
                />

                {/* Bottom sheet */}
                <div
                    className="fixed inset-x-0 bottom-0 z-[100] flex flex-col bg-background rounded-t-3xl shadow-2xl overflow-hidden"
                    style={{ maxHeight: "90dvh" }}
                >
                    {/* Drag handle */}
                    <div
                        className="flex items-center justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer"
                        onClick={() => setIsMinimized(true)}
                    >
                        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>

                    {/* Tab strip — shown when 2+ tabs */}
                    {chatTabs.length > 1 && (
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto flex-shrink-0 border-b border-border"
                            style={{ scrollbarWidth: "none" }}
                        >
                            {chatTabs.map((tab) => {
                                const isTabActive = tab.tabId === activeTabId;
                                const initials = getInitials(tab.target.storeName);
                                return (
                                    <button
                                        key={tab.tabId}
                                        onClick={() => setActiveTab(tab.tabId)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium",
                                            "transition-colors shrink-0 max-w-[140px] border",
                                            isTabActive
                                                ? "bg-primary/10 text-primary border-primary/30"
                                                : "bg-muted text-muted-foreground border-transparent"
                                        )}
                                    >
                                        {tab.target.storeAvatar ? (
                                            <img src={tab.target.storeAvatar} className="w-5 h-5 rounded-full flex-shrink-0 object-cover" alt="" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                                                {initials.charAt(0)}
                                            </div>
                                        )}
                                        <span className="truncate">{tab.target.storeName.split(" ")[0]}</span>
                                        {tab.unreadCount > 0 && (
                                            <span className="min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0 px-0.5">
                                                {tab.unreadCount > 9 ? "9+" : tab.unreadCount}
                                            </span>
                                        )}
                                        <span
                                            role="button"
                                            aria-label="Tutup tab"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); closeTab(tab.tabId); }}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); closeTab(tab.tabId); } }}
                                            className="ml-0.5 w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/40 flex items-center justify-center flex-shrink-0 transition-colors"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Chat panes — pass isMinimized=false so body always renders */}
                    {chatTabs.map((tab) => (
                        <ChatTabPane
                            key={tab.tabId}
                            tab={tab}
                            isActive={tab.tabId === activeTabId}
                            isMinimized={false}
                        />
                    ))}
                </div>
            </>
        );
    }

    // ── Desktop: floating window ──────────────────────────────────────────────
    return (
        <div className="fixed bottom-0 right-0 z-[100] sm:bottom-4 sm:right-4 w-full sm:w-[350px] md:w-[400px] flex flex-col">
            {/* Incoming message preview — appears above the chat box, slides down into it */}
            <IncomingPreviewToast
                preview={incomingPreview}
                onClose={clearIncomingPreview}
            />

            {/* Chat box */}
            <div
                className={cn(
                    "flex flex-col shadow-2xl overflow-hidden border bg-background",
                    "sm:rounded-2xl rounded-t-2xl animate-fade-in",
                    totalUnread > 0 && isMinimized
                        ? "border-primary/70 ring-2 ring-primary/40"
                        : "border-border"
                )}
            >
                {/* Tab strip — only shown when 2+ tabs are open */}
                {chatTabs.length > 1 && (
                    <div
                        className="flex items-center gap-1 px-2 py-1.5 gradient-primary border-b border-white/10 overflow-x-auto flex-shrink-0"
                        style={{ scrollbarWidth: "none" }}
                    >
                        {chatTabs.map((tab) => {
                            const isTabActive = tab.tabId === activeTabId;
                            const initials = getInitials(tab.target.storeName);
                            return (
                                <button
                                    key={tab.tabId}
                                    onClick={() => setActiveTab(tab.tabId)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium",
                                        "transition-colors shrink-0 max-w-[110px]",
                                        isTabActive
                                            ? "bg-white/25 text-white"
                                            : "bg-background text-foreground/70 hover:text-foreground hover:bg-background/90"
                                    )}
                                >
                                    {tab.target.storeAvatar ? (
                                        <img
                                            src={tab.target.storeAvatar}
                                            className="w-4 h-4 rounded-full flex-shrink-0 object-cover"
                                            alt=""
                                        />
                                    ) : (
                                        <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                                            {initials.charAt(0)}
                                        </div>
                                    )}
                                    <span className="truncate">
                                        {tab.target.storeName.split(" ")[0]}
                                    </span>
                                    {tab.unreadCount > 0 && (
                                        <span className="min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold flex-shrink-0 px-0.5">
                                            {tab.unreadCount > 9 ? "9+" : tab.unreadCount}
                                        </span>
                                    )}
                                    {/* Per-tab close button */}
                                    <span
                                        role="button"
                                        aria-label="Tutup tab"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeTab(tab.tabId);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.stopPropagation();
                                                closeTab(tab.tabId);
                                            }
                                        }}
                                        className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center flex-shrink-0 transition-colors"
                                    >
                                        <X className="w-2 h-2" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Per-tab panes — all mounted (preserves state), only active is visible */}
                {chatTabs.map((tab) => (
                    <ChatTabPane
                        key={tab.tabId}
                        tab={tab}
                        isActive={tab.tabId === activeTabId}
                        isMinimized={isMinimized}
                    />
                ))}
            </div>
        </div>
    );
}
