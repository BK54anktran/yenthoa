"use client";

import { createContext, useContext } from "react";
import type { Shop } from "@/lib/defaults";

// Shop info is read from the database once in the root layout and handed to client components here.
const ShopContext = createContext<Shop | null>(null);

export function ShopProvider({ shop, children }: { shop: Shop; children: React.ReactNode }) {
  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop(): Shop {
  const s = useContext(ShopContext);
  if (!s) throw new Error("useShop must be used inside <ShopProvider>");
  return s;
}
