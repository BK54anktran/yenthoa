"use client";

import { createContext, useContext } from "react";
import type { Nav } from "@/lib/menu";

// The header menu is built from the database in the root layout and handed to the client header here.
const NavContext = createContext<Nav | null>(null);

export function NavProvider({ nav, children }: { nav: Nav; children: React.ReactNode }) {
  return <NavContext.Provider value={nav}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error("useNav must be used inside <NavProvider>");
  return n;
}
