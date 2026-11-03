import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NewsSidebar } from "./NewsSidebar";
import { formatDate, postHref, type PostSummary } from "@/lib/posts";
import { getTaxonomy } from "@/lib/repo";
import { activeOnly, sectionName, type Taxonomy } from "@/lib/taxonomy";
import { getPostSections, getPostsPage } from "@/lib/repo";

const href = (muc: string | null, trang: number) => {
  const q = new URLSearchParams();
  if (muc) q.set("muc", muc);
  if (trang > 1) q.set("trang", String(trang));
  const s = q.toString();
  return s ? `/tin-tuc?${s}` : "/tin-tuc";
};

// compact page list: 1 … 4 5 [6] 7 8 … 40
function pageWindow(cur: number, total: number): (number | "…")[] {
  const keep = new Set([1, total, cur - 2, cur - 1, cur, cur + 1, cur + 2].filter((n) => n >= 1 && n <= total));
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

function Card({ a, priority, taxonomy }: { a: PostSummary; priority?: boolean; taxonomy: Taxonomy }) {
  return (
    <li className="flex flex-col bg-white">
      <Link href={postHref(a.slug)} className="group block" tabIndex={-1} aria-hidden>
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
          {a.img ? (
            <Image
              src={a.img}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <Image src="/sites/xemayhoangkim/logo.jpg" alt="" fill sizes="300px" className="bg-white object-contain p-8" />
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs">
          <span className="bg-[#e32020] px-2 py-1 font-semibold uppercase text-white">{sectionName(taxonomy, a.section)}</span>
          <span className="ml-3 text-neutral-500">{formatDate(a.date)}</span>
        </p>
        <h3 className="mt-3 text-base font-semibold uppercase leading-snug">
          <Link href={postHref(a.slug)} className="hover:text-[#de0000]">{a.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{a.excerpt}</p>
      </div>
    </li>
  );
}

export async function NewsList({ section, page }: { section: string | null; page: number }) {
  const { items: shown, total, pages, page: cur } = await getPostsPage(section, page);
  const taxonomy = await getTaxonomy();
  const usedSections = new Set(await getPostSections());
  const filters = [{ slug: null as string | null, name: "Tất cả" }, ...activeOnly(taxonomy.sections).filter((s) => usedSections.has(s.id) || s.id === section).map((s) => ({ slug: s.id as string | null, name: s.name }))];

  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">Tin tức</span>
        </nav>

        <h1 className="text-2xl font-semibold uppercase md:text-3xl">Tin tức</h1>

        <div aria-label="Chuyên mục" className="mt-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.slug ?? "all"}
              href={href(f.slug, 1)}
              aria-current={f.slug === section ? "page" : undefined}
              className={`px-4 py-2 text-xs font-bold uppercase ${
                f.slug === section ? "bg-[#de0000] text-white" : "bg-white text-neutral-700 hover:text-[#de0000]"
              }`}
            >
              {f.name}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          {total} bài viết · trang {cur}/{pages}
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]">
          <section aria-label="Danh sách bài viết">
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((a, i) => (
                <Card key={a.slug} a={a} priority={i < 3} taxonomy={taxonomy} />
              ))}
            </ul>

            {pages > 1 && (
              <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {cur > 1 && (
                  <Link href={href(section, cur - 1)} aria-label="Trang trước" className="grid size-9 place-items-center bg-white text-sm">‹</Link>
                )}
                {pageWindow(cur, pages).map((p, i) =>
                  p === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-neutral-400">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={href(section, p)}
                      aria-current={p === cur ? "page" : undefined}
                      className={`grid size-9 place-items-center text-sm font-semibold ${p === cur ? "bg-[#de0000] text-white" : "bg-white hover:text-[#de0000]"}`}
                    >
                      {p}
                    </Link>
                  ),
                )}
                {cur < pages && (
                  <Link href={href(section, cur + 1)} aria-label="Trang sau" className="grid size-9 place-items-center bg-white text-sm">›</Link>
                )}
              </nav>
            )}
          </section>

          <NewsSidebar />
        </div>
      </div>
    </div>
  );
}
