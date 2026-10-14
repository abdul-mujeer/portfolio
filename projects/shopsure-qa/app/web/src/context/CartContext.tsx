import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import type { CartPayload } from "../lib/types";
import { useAuth } from "./AuthContext";

interface CartContextValue {
  cart: CartPayload | null;
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartPayload = { items: [], subtotal: 0, discount: 0, shipping: 0, total: 0 };

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      setCart(await api.get<CartPayload>("/cart"));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) console.warn("cart refresh failed", error);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  const addItem = useCallback(async (productId: number, quantity: number) => {
    setCart(await api.post<CartPayload>("/cart/items", { productId, quantity }));
  }, []);

  const updateItem = useCallback(async (itemId: number, quantity: number) => {
    setCart(await api.patch<CartPayload>(`/cart/items/${itemId}`, { quantity }));
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    await api.del(`/cart/items/${itemId}`);
    setCart((current) => {
      if (!current) return current;
      const items = current.items.filter((item) => item.id !== itemId);
      const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
      const discount = subtotal >= 100 ? Number((subtotal * 0.1).toFixed(2)) : 0;
      const shipping = subtotal > 0 && subtotal < 50 ? 5 : 0;
      return { items, subtotal, discount, shipping, total: Number((subtotal - discount + shipping).toFixed(2)) };
    });
  }, []);

  const clear = useCallback(async () => {
    await api.del("/cart");
    setCart(EMPTY_CART);
  }, []);

  const itemCount = useMemo(() => (cart?.items ?? []).reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const value = useMemo(
    () => ({ cart, itemCount, loading, refresh, addItem, updateItem, removeItem, clear }),
    [cart, itemCount, loading, refresh, addItem, updateItem, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
