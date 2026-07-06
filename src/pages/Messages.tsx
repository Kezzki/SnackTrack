import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";

function formatRelativeTime(ts: string): string {
    const diffMs = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} mnt lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Kemarin";
    return `${days} hari lalu`;
}

interface ConversationItem {
    id: string;
    storeId: string;
    sellerId: string;
    storeName: string;
    storeAvatar?: string;
    productId?: string;
    productName?: string;
    productImage?: string;
    lastMessage: string;
    lastMessageAt: string;
}

export default function Messages() {
    const { user, activeRole } = useAuth();
    const { openChat } = useChat();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isBuyer = activeRole === "pembeli";

    const QUERY_KEY = ["conversations", user?.id, activeRole];

    const { data: conversations = [], isLoading } = useQuery<ConversationItem[]>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            if (!user) return [];

            if (isBuyer) {
                const { data, error } = await supabase
                    .from("conversations")
                    .select(
                        "id, store_id, seller_id, product_id, product_name, product_image, last_message, last_message_at, store:stores(name, image_url)"
                    )
                    .eq("buyer_id", user.id)
                    .order("last_message_at", { ascending: false });

                if (error) { console.error(error); return []; }

                return (data ?? []).map((c: any) => ({
                    id: c.id,
                    storeId: c.store_id,
                    sellerId: c.seller_id,
                    storeName: c.store?.name ?? "Toko",
                    storeAvatar: c.store?.image_url ?? undefined,
                    productId: c.product_id ?? undefined,
                    productName: c.product_name ?? undefined,
                    productImage: c.product_image ?? undefined,
                    lastMessage: c.last_message ?? "",
                    lastMessageAt: c.last_message_at,
                }));
            } else {
                // Seller view — fetch conversations, then buyer profiles separately
                // (conversations.buyer_id references auth.users, not profiles,
                //  so a direct join is not possible via PostgREST)
                const { data, error } = await supabase
                    .from("conversations")
                    .select(
                        "id, store_id, buyer_id, product_name, last_message, last_message_at, store:stores(name, image_url)"
                    )
                    .eq("seller_id", user.id)
                    .order("last_message_at", { ascending: false });

                if (error) { console.error(error); return []; }
                if (!data || data.length === 0) return [];

                // Fetch buyer display names / avatars
                const buyerIds = [...new Set((data as any[]).map((c) => c.buyer_id))];
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, name, avatar_url")
                    .in("id", buyerIds);

                const profileMap = Object.fromEntries(
                    (profiles ?? []).map((p: any) => [p.id, p])
                );

                return (data as any[]).map((c) => ({
                    id: c.id,
                    storeId: c.store_id,
                    sellerId: user.id,
                    // For the seller's view, show the buyer's name / avatar
                    buyerId: c.buyer_id,
                    storeName: profileMap[c.buyer_id]?.name ?? "Pembeli",
                    storeAvatar: profileMap[c.buyer_id]?.avatar_url ?? undefined,
                    productId: undefined,
                    productName: c.product_name ?? undefined,
                    productImage: undefined,
                    lastMessage: c.last_message ?? "",
                    lastMessageAt: c.last_message_at,
                })) as ConversationItem[];
            }
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 2, // 2 minutes — Realtime invalidates on changes
    });

    // Real-time: invalidate list whenever a conversation row changes (e.g. last_message)
    useEffect(() => {
        if (!user) return;
        const queryKey = ["conversations", user.id, activeRole];
        const channel = supabase
            .channel(`conversations-list:${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "conversations",
                },
                () => {
                    queryClient.invalidateQueries({ queryKey });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, activeRole]);

    const [search, setSearch] = useState("");
    const needle = search.trim().toLowerCase();
    const filtered = needle
        ? conversations.filter(
              (c) =>
                  c.storeName.toLowerCase().includes(needle) ||
                  c.lastMessage.toLowerCase().includes(needle) ||
                  (c.productName ?? "").toLowerCase().includes(needle)
          )
        : conversations;

    const handleOpen = (conv: ConversationItem & { buyerId?: string }) => {
        openChat({
            conversationId: conv.id,
            storeId: conv.storeId,
            storeName: conv.storeName,
            storeAvatar: conv.storeAvatar,
            sellerId: conv.sellerId,
            productId: conv.productId,
            productName: conv.productName,
            productImage: conv.productImage,
        });
    };

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Pesan</h1>
            </div>
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari percakapan…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    maxLength={100}
                    className="pl-10"
                />
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground opacity-25 mb-4" />
                    <h3 className="font-semibold text-foreground mb-1">Belum ada pesan</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {isBuyer
                            ? "Ketuk ikon chat pada halaman produk untuk bertanya ke penjual."
                            : "Pesan dari pembeli akan muncul di sini."}
                    </p>
                    {isBuyer && (
                        <Button className="mt-4" onClick={() => navigate("/toko")}>
                            <Store className="h-4 w-4 mr-2" />
                            Jelajahi Produk
                        </Button>
                    )}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="h-10 w-10 text-muted-foreground opacity-25 mb-3" />
                    <p className="text-sm text-muted-foreground">Tidak ada percakapan yang cocok.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => handleOpen(conv)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                        >
                            {conv.storeAvatar ? (
                                <img
                                    src={conv.storeAvatar}
                                    alt={conv.storeName}
                                    className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary border border-border">
                                    {conv.storeName.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="font-semibold text-sm truncate">{conv.storeName}</span>
                                    {conv.lastMessageAt && (
                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {formatRelativeTime(conv.lastMessageAt)}
                                        </span>
                                    )}
                                </div>
                                {conv.productName && (
                                    <p className="text-xs text-primary truncate mb-0.5">
                                        📦 {conv.productName}
                                    </p>
                                )}
                                <p className="text-sm text-muted-foreground truncate">
                                    {conv.lastMessage || "Mulai percakapan..."}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
