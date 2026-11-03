import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ExpandableHtml } from "@/components/sites/xemayhoangkim/ExpandableHtml";
import Image from "next/image";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { ProductCards } from "@/components/sites/xemayhoangkim/ProductCards";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { productsOf } from "@/lib/collections";
import { htmlToText } from "@/lib/sanitize";
import { getCollections, getProducts, getTaxonomy } from "@/lib/repo";
import { pageMetadata } from "@/lib/shop";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const c = (await getCollections()).find((x) => x.id === slug && x.active);
  return c ? pageMetadata(c.name, htmlToText(c.description).slice(0, 150) || undefined) : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [collections, products, taxonomy] = await Promise.all([getCollections(), getProducts(), getTaxonomy()]);
  const c = collections.find((x) => x.id === slug && x.active);
  if (!c) notFound();
  const items = productsOf(c, products);
  return (
    <>
      <Header />
      <main className="bg-neutral-100 pb-12">
        <div className="mx-auto max-w-[1250px] px-4">
          <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 py-4 text-xs text-neutral-500">
            <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
            <ChevronRight size={12} />
            <Link href="/bo-suu-tap" className="hover:text-[#de0000]">Bộ sưu tập</Link>
            <ChevronRight size={12} />
            <span className="font-semibold text-neutral-800">{c.name}</span>
          </nav>
          <header className="mb-6 flex flex-wrap items-center gap-6 bg-white p-5 md:p-8">
            {c.image && (
              <div className="relative h-28 w-44 shrink-0 overflow-hidden bg-white">
                <Image src={c.image} alt={c.name} fill sizes="176px" priority className="object-contain" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold uppercase md:text-3xl">{c.name}</h1>
              {c.description &&
                (/<[a-z][\s\S]*>/i.test(c.description) ? (
                  <div className="prose-content mt-2 max-w-3xl text-sm text-neutral-600" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: c.description }} />
                ) : (
                  <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-neutral-600">{c.description}</p>
                ))}
              <p className="mt-2 text-xs text-neutral-500">{items.length} xe</p>
            </div>
          </header>
          {c.html && (
            <section className="mb-6 bg-white p-5 md:p-8" aria-label="Mô tả chi tiết">
              <ExpandableHtml html={c.html} />
            </section>
          )}
          {items.length > 0 ? <ProductCards products={items} taxonomy={taxonomy} /> : <p className="bg-white p-6 text-sm text-neutral-600">Bộ sưu tập này chưa có xe nào.</p>}
        </div>
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
