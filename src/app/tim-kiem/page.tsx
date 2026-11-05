import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { formatDate, postHref } from "@/lib/posts";
import { priceLabel, productHref } from "@/lib/products";
import { activeOnly, brandName, sectionName } from "@/lib/taxonomy";
import { getTaxonomy } from "@/lib/repo";
import { MAX_POSTS, MAX_PRODUCTS, searchSite } from "@/lib/search";
import { getShop } from "@/lib/shop";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }): Promise<Metadata> {
  const q = one((await searchParams).q);
  const shop = await getShop();
  return { title: `${q ? `Tìm kiếm: ${q.slice(0, 60)}` : "Tìm kiếm"} - ${shop.brand}`, robots: { index: false, follow: true } };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const q = one((await searchParams).q).slice(0, 120);
  const taxonomy = await getTaxonomy();
  const brands = activeOnly(taxonomy.brands);
  const { tokens, products, posts } = await searchSite(q, taxonomy.brands);
  const none = tokens.length > 0 && products.length === 0 && posts.length === 0;

  return (
    <>
      <Header />
      <main>
        <div className="bg-neutral-100 pb-12">
          <div className="mx-auto max-w-[1250px] px-4">
            <h1 className="pt-8 text-2xl font-semibold md:text-3xl">{tokens.length ? <>Kết quả cho &ldquo;{q.trim()}&rdquo;</> : "Tìm kiếm"}</h1>
            {tokens.length > 0 && (
              <p className="mt-2 text-sm text-neutral-500">
                {products.length} xe, {posts.length} bài viết
                {(products.length >= MAX_PRODUCTS || posts.length >= MAX_POSTS) && " (hiển thị tối đa, hãy gõ cụ thể hơn)"}
              </p>
            )}

            {tokens.length === 0 && (
              <div className="mt-6 bg-white p-6 text-sm text-neutral-700">
                <p className="flex items-center gap-2"><Search size={16} /> Gõ tên xe, hãng hoặc nội dung bài viết vào ô tìm kiếm. Có dấu hay không dấu đều được.</p>
                <p className="mt-4 font-semibold">Xem theo hãng</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <li key={b.id}><Link href={`/xe-may?nhom=${b.id}`} className="block bg-neutral-100 px-3 py-1.5 hover:text-[#de0000]">{b.name}</Link></li>
                  ))}
                </ul>
              </div>
            )}

            {none && (
              <div className="mt-6 bg-white p-6 text-sm text-neutral-700">
                <p>Không tìm thấy kết quả nào. Thử gõ ngắn hơn (ví dụ tên dòng xe) hoặc xem theo hãng:</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <li key={b.id}><Link href={`/xe-may?nhom=${b.id}`} className="block bg-neutral-100 px-3 py-1.5 hover:text-[#de0000]">{b.name}</Link></li>
                  ))}
                </ul>
              </div>
            )}

            {products.length > 0 && (
              <section className="mt-6" aria-label="Xe">
                <h2 className="mb-3 text-lg font-semibold uppercase">Xe ({products.length})</h2>
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {products.map((p) => (
                    <li key={p.slug} className="bg-white">
                      <Link href={productHref(p.slug)} className="group block p-4">
                        <div className="relative aspect-[4/3] overflow-hidden bg-white">
                          {p.img && <Image src={p.img} alt="" fill sizes="(min-width: 1024px) 280px, 50vw" className="object-contain transition duration-500 group-hover:scale-105" />}
                        </div>
                        <p className="mt-3 text-sm font-semibold uppercase group-hover:text-[#de0000]">{p.name}</p>
                        <p className="text-xs text-neutral-500">{p.brand ? brandName(taxonomy, p.brand) : ""}</p>
                        <p className="mt-1 text-sm font-semibold text-[#de0000]">{priceLabel(p)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {posts.length > 0 && (
              <section className="mt-8" aria-label="Bài viết">
                <h2 className="mb-3 text-lg font-semibold uppercase">Bài viết ({posts.length})</h2>
                <ul className="grid gap-4 md:grid-cols-2">
                  {posts.map((a) => (
                    <li key={a.slug} className="flex gap-4 bg-white p-4">
                      <Link href={postHref(a.slug)} className="relative block h-24 w-32 shrink-0 overflow-hidden bg-neutral-100" tabIndex={-1} aria-hidden>
                        <Image src={a.img ?? "/sites/yenthoa/logo.png"} alt="" fill sizes="128px" className={a.img ? "object-cover" : "object-contain p-2"} />
                      </Link>
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-500">{sectionName(taxonomy, a.section)} · {formatDate(a.date)}</p>
                        <h3 className="mt-1 text-sm font-semibold leading-snug"><Link href={postHref(a.slug)} className="hover:text-[#de0000]">{a.title}</Link></h3>
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{a.excerpt}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
