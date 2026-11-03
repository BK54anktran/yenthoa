"use client";

import { createContext, useContext } from "react";
import type { Taxonomy } from "@/lib/taxonomy";

// Brands, product types and news sections are read from the database in the root layout and handed to client components here.
const TaxonomyContext = createContext<Taxonomy | null>(null);

export function TaxonomyProvider({ taxonomy, children }: { taxonomy: Taxonomy; children: React.ReactNode }) {
  return <TaxonomyContext.Provider value={taxonomy}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy(): Taxonomy {
  const t = useContext(TaxonomyContext);
  if (!t) throw new Error("useTaxonomy must be used inside <TaxonomyProvider>");
  return t;
}
