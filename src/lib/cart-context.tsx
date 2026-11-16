"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MenuItem } from "@/types/database";

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, specialInstructions?: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem("restaurant_cart");
        if (stored) {
          setItems(JSON.parse(stored));
        }
      } catch {
        // Ignore invalid or unavailable saved cart data.
      }
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem("restaurant_cart", JSON.stringify(items));
      } catch {
        // ignore
      }
    }
  }, [items, isHydrated]);

  const addItem = (item: MenuItem, specialInstructions?: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItem.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItem.id === item.id
            ? {
                ...i,
                quantity: Math.min(50, i.quantity + 1),
                specialInstructions: specialInstructions || i.specialInstructions,
              }
            : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1, specialInstructions }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.menuItem.id === itemId
          ? { ...i, quantity: Math.min(50, quantity) }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("restaurant_cart");
    } catch {
      // ignore
    }
  };

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalPaise = items.reduce(
    (sum, i) => sum + i.menuItem.price_paise * i.quantity,
    0
  );
  const taxPaise = 0; // Configurable tax
  const totalPaise = subtotalPaise + taxPaise;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalCount,
        subtotalPaise,
        taxPaise,
        totalPaise,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
