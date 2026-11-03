import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { ShopProvider } from "@/components/sites/xemayhoangkim/shop-context";
import { TaxonomyProvider } from "@/components/sites/xemayhoangkim/taxonomy-context";
import { RunContentScripts } from "@/components/sites/xemayhoangkim/RunContentScripts";
import { NavProvider } from "@/components/sites/xemayhoangkim/nav-context";
import { getNav, getTaxonomy } from "@/lib/repo";
import { getShop } from "@/lib/shop";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return {
    title: shop.brand,
    description: `${shop.brand}. Hotline: ${shop.hotlines.join(" - ")}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Shop info and content come from MySQL: render at request time, never at build time.
  await connection();
  const [shop, taxonomy, nav] = await Promise.all([getShop(), getTaxonomy(), getNav()]);
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)] text-[#151515]">
        <ShopProvider shop={shop}><TaxonomyProvider taxonomy={taxonomy}><NavProvider nav={nav}>{children}</NavProvider>
          <RunContentScripts /></TaxonomyProvider></ShopProvider>
      </body>
    </html>
  );
}
