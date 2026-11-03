import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { ProductDetail } from "@/components/sites/xemayhoangkim/ProductDetail";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { priceLabel } from "@/lib/products";
import { getProductBySlug, getRelatedProducts } from "@/lib/repo";
import { getShop } from "@/lib/shop";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  const shop = await getShop();
  return {
    title: `${product.name} - ${shop.brand}`,
    description: `${product.name}, giá ${priceLabel(product)}. Liên hệ hotline ${shop.hotlines.join(" - ")} để nhận báo giá.`,
    openGraph: product.img ? { images: [product.img] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product.brand, product.slug, 5);
  return (
    <>
      <Header />
      <main>
        <ProductDetail product={product} related={related} />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
