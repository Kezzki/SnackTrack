import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    stock: number;
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (item: Omit<CartItem, "quantity">) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getStorageKey(userId: string) {
    return `snacktrack_cart_${userId}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [cart, setCart] = useState<CartItem[]>([]);

    // Load cart from localStorage when user changes
    useEffect(() => {
        if (user?.id) {
            try {
                const stored = localStorage.getItem(getStorageKey(user.id));
                if (stored) {
                    setCart(JSON.parse(stored));
                } else {
                    setCart([]);
                }
            } catch {
                setCart([]);
            }
        } else {
            setCart([]);
        }
    }, [user?.id]);

    // Persist cart to localStorage whenever it changes
    useEffect(() => {
        if (user?.id) {
            localStorage.setItem(getStorageKey(user.id), JSON.stringify(cart));
        }
    }, [cart, user?.id]);

    const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.productId === item.productId);
            if (existing) {
                // Don't exceed stock
                if (existing.quantity >= item.stock) return prev;
                return prev.map((c) =>
                    c.productId === item.productId ? { ...c, quantity: c.quantity + 1, stock: item.stock } : c
                );
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    }, []);

    const updateQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart((prev) => prev.filter((c) => c.productId !== productId));
        } else {
            setCart((prev) => prev.map((c) => {
                if (c.productId !== productId) return c;
                // Clamp to stock limit
                const clamped = Math.min(quantity, c.stock);
                return { ...c, quantity: clamped };
            }));
        }
    }, []);

    const clearCart = useCallback(() => setCart([]), []);

    const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, updateQuantity, clearCart, totalItems }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within CartProvider");
    return ctx;
}
