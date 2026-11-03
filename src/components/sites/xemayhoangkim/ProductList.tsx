"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { formatVnd, priceLabel, productHref, type ProductSummary } from "@/lib/products";
import { activeOnly, brandName, typeName } from "@/lib/taxonomy";
import { useTaxonomy } from "./taxonomy-context";

const PAGE_SIZE = 12;

const STEP = 100_000;

const sorts = [
  { id: "default", label: "Mặc định" },
  { id: "asc", label: "Giá thấp đến cao" },
  { id: "desc", label: "Giá cao đến thấp" },
  { id: "name", label: "Tên A đến Z" },
] as const;
type SortId = (typeof sorts)[number]["id"];

export function ProductList({ initialGroups, products }: { initialGroups: string[]; products: ProductSummary[] }) {
  const taxonomy = useTaxonomy();
  const brands = activeOnly(taxonomy.brands);
  const allItems = products;
  const brandCount = (id: string) => allItems.filter((p) => p.brand === id).length;
  const prices = allItems.map((i) => i.price);
  const MIN_PRICE = prices.length ? Math.floor(Math.min(...prices) / STEP) * STEP : 0;
  const MAX_PRICE = Math.max(prices.length ? Math.ceil(Math.max(...prices) / STEP) * STEP : 0, MIN_PRICE + STEP);
  const allGroupIds = brands.map((c) => c.id);
  const [groups, setGroups] = useState<string[]>(initialGroups.length ? initialGroups : allGroupIds);
  const [lo, setLo] = useState(MIN_PRICE);
  const [hi, setHi] = useState(MAX_PRICE);
  const [sort, setSort] = useState<SortId>("default");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const list = allItems.filter((i) => groups.includes(i.brand) && i.price >= lo && i.price <= hi);
    if (sort === "asc") list.sort((a, b) => a.price - b.price);
    if (sort === "desc") list.sort((a, b) => b.price - a.price);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return list;
  }, [allItems, groups, lo, hi, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const toggleGroup = (id: string) => {
    setGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
    setPage(1);
  };
  const reset = () => {
    setGroups(allGroupIds);
    setLo(MIN_PRICE);
    setHi(MAX_PRICE);
    setSort("default");
    setPage(1);
  };
  const dirty = groups.length !== allGroupIds.length || lo !== MIN_PRICE || hi !== MAX_PRICE;

  const pct = (v: number) => ((v - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100;

  const filterPanel = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-wide">Hãng xe</legend>
        <ul className="space-y-2 text-sm">
          {brands.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={groups.includes(c.id)}
                  onChange={() => toggleGroup(c.id)}
                  className="size-4 accent-[#de0000]"
                />
                <span>{c.name}</span>
                <span className="text-neutral-400">({brandCount(c.id)})</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-wide">Giá xe</legend>
        <div className="dual-range relative mx-2 h-6" role="group" aria-label="Khoảng giá">
          <div className="absolute left-0 right-0 top-[11px] h-0.5 bg-neutral-300" />
          <div
            className="absolute top-[11px] h-0.5 bg-[#de0000]"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
          <input
            type="range"
            aria-label="Giá thấp nhất"
            min={MIN_PRICE}
            max={MAX_PRICE}
            step={STEP}
            value={lo}
            onChange={(e) => {
              setLo(Math.min(Number(e.target.value), hi));
              setPage(1);
            }}
          />
          <input
            type="range"
            aria-label="Giá cao nhất"
            min={MIN_PRICE}
            max={MAX_PRICE}
            step={STEP}
            value={hi}
            onChange={(e) => {
              setHi(Math.max(Number(e.target.value), lo));
              setPage(1);
            }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          {formatVnd(lo)} — {formatVnd(hi)}
        </p>
      </fieldset>

      <button
        onClick={reset}
        disabled={!dirty}
        className="w-full border border-neutral-300 px-3 py-2 text-xs font-bold uppercase hover:border-[#de0000] hover:text-[#de0000] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Xoá bộ lọc
      </button>
    </div>
  );

  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">Xe máy</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* filters: always visible on desktop, behind a button on phones */}
          <aside aria-label="Bộ lọc">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="flex w-full items-center justify-center gap-2 bg-white px-4 py-3 text-sm font-bold uppercase lg:hidden"
            >
              <SlidersHorizontal size={16} /> Bộ lọc{dirty ? " (đang lọc)" : ""}
            </button>
            <div className={`${showFilters ? "mt-3 block" : "hidden"} bg-white p-5 lg:block`}>{filterPanel}</div>
          </aside>

          <section aria-label="Danh sách xe">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold uppercase">Bảng giá xe máy</h1>
                <p className="text-sm text-neutral-500" aria-live="polite">
                  {filtered.length ? `Hiển thị ${shown.length} trên ${filtered.length} xe` : "Không có xe nào"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                Sắp xếp:
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortId);
                    setPage(1);
                  }}
                  className="border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                >
                  {sorts.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white p-10 text-center">
                <p className="text-neutral-600">Không có xe phù hợp với bộ lọc hiện tại.</p>
                <button onClick={reset} className="mt-4 bg-[#de0000] px-5 py-2 text-sm font-bold uppercase text-white hover:bg-[#b80000]">
                  Xoá bộ lọc
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((m) => (
                  <li key={m.slug} className="flex flex-col bg-white p-4">
                    <h2 className="text-lg font-semibold uppercase">{m.name}</h2>
                    <p className="text-xs text-neutral-500">
                      {brandName(taxonomy, m.brand)}
                      {m.types[0] && typeName(taxonomy, m.types[0]) ? ` · ${typeName(taxonomy, m.types[0])}` : ""}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="text-xs text-neutral-500">Giá </span>
                      <strong>{priceLabel(m)}</strong>
                    </p>
                    <Link href={productHref(m.slug)} className="group mt-3 block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-white">
                        {m.img && (
                          <Image
                            src={m.img}
                            alt={m.name}
                            fill
                            sizes="(min-width: 1280px) 330px, (min-width: 640px) 45vw, 100vw"
                            className="object-contain transition duration-500 group-hover:scale-105"
                          />
                        )}
                      </div>
                    </Link>
                    <Link
                      href={productHref(m.slug)}
                      className="mt-3 bg-black px-4 py-2.5 text-center text-xs font-bold uppercase text-white hover:bg-[#de0000]"
                    >
                      Xem chi tiết
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(cur - 1)}
                  disabled={cur === 1}
                  className="size-9 bg-white text-sm disabled:opacity-40"
                  aria-label="Trang trước"
                >
                  ‹
                </button>
                {Array.from({ length: pages }, (_, k) => k + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={p === cur ? "page" : undefined}
                    className={`size-9 text-sm font-semibold ${p === cur ? "bg-[#de0000] text-white" : "bg-white hover:text-[#de0000]"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(cur + 1)}
                  disabled={cur === pages}
                  className="size-9 bg-white text-sm disabled:opacity-40"
                  aria-label="Trang sau"
                >
                  ›
                </button>
              </nav>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
