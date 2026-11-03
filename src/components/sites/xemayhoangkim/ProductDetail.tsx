"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Phone, MessageCircle } from "lucide-react";
import { telHref } from "./data";
import { SpecAccordion } from "./SpecAccordion";
import { ThumbStrip } from "./ThumbStrip";
import { useShop } from "./shop-context";
import { useTaxonomy } from "./taxonomy-context";
import { brandName as brandLabel, typeName } from "@/lib/taxonomy";
import { formatVnd, priceLabel, productHref, type ProductDetailData, type ProductSummary, type Variant } from "@/lib/products";
import { attributeNames, isAvailable, isColorAttribute, optionsOf, pickClosest, pickOption, valueOf } from "@/lib/variants";

const benefits = [
  "Hỗ trợ làm giấy tờ, đăng ký xe",
  "Bảo hành theo chính sách nhà sản xuất",
  "Hỗ trợ trả góp, thủ tục gọn",
  "Giá niêm yết gồm VAT, chưa gồm phí trước bạ và biển số",
];

const COLLAPSED = 480;

export function ProductDetail({ product, related }: { product: ProductDetailData; related: ProductSummary[] }) {
  const { hotlines: HOTLINES, facebook: FACEBOOK } = useShop();
  const taxonomy = useTaxonomy();
  const brandName = (id: string) => brandLabel(taxonomy, id);
  const [view, setView] = useState(0);
  const [sel, setSel] = useState<Variant | null>(null);
  const tabs = [...(product.html ? ["Thông tin sản phẩm"] : []), ...(product.specs.length ? ["Thông số kỹ thuật"] : [])];
  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [fullH, setFullH] = useState(COLLAPSED);
  const content = useRef<HTMLDivElement>(null);
  const base = product.gallery.length ? product.gallery : product.img ? [product.img] : [];
  const variants = product.variants;
  // every photo of the car: the default ones first, then one per colour (no repeats)
  const gallery = [...new Set([...base, ...variants.map((v) => v.img).filter((u): u is string => !!u)])];
  const names = attributeNames(variants); // e.g. Phiên bản, Màu sắc, Dung tích: whatever the shop defined
  const thumbOf = (name: string, value: string) => variants.find((v) => valueOf(v, name) === value && v.img)?.img ?? null;

  // selecting a variant also shows its photo; clicking a photo selects the variant it belongs to
  const choose = (v: Variant | null) => {
    if (!v) return;
    setSel(v);
    const k = v.img ? gallery.indexOf(v.img) : -1;
    if (k >= 0) setView(k);
  };
  const showPhoto = (k: number) => {
    setView(k);
    const v = pickClosest(variants, variants.filter((x) => x.img === gallery[k]), sel);
    if (v) setSel(v);
  };

  // offer "Xem thêm" only when the description is taller than the collapsed box
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const update = () => {
      setCanExpand(el.scrollHeight > COLLAPSED + 4);
      setFullH(el.scrollHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  const typeLabel = product.types[0] ? typeName(taxonomy, product.types[0]) || null : null;

  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <Link href={`/xe-may?nhom=${product.brand}`} className="hover:text-[#de0000]">{brandName(product.brand)}</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">{product.name}</span>
        </nav>

        <div className="grid gap-8 bg-white p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-6">
          <div className="min-w-0">
            <div className="relative aspect-[7/4] overflow-hidden bg-white">
              {gallery[view] && (
                <Image
                  src={gallery[view]}
                  alt={`${product.name} - ảnh ${view + 1}`}
                  fill
                  priority
                  sizes="(min-width: 768px) 600px, 100vw"
                  className="object-contain"
                />
              )}
            </div>
            {gallery.length > 1 && <ThumbStrip images={gallery} active={view} onSelect={showPhoto} />}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {brandName(product.brand)}
              {typeLabel ? ` · ${typeLabel}` : ""}
            </p>
            <h1 className="mt-1 text-2xl font-semibold uppercase md:text-3xl">{product.name}</h1>
            {product.code && <p className="mt-1 text-xs text-neutral-500">Mã: {product.code}</p>}
            <p className="mt-3 text-3xl font-bold text-[#de0000]" data-testid="price">{sel ? formatVnd(sel.price) : priceLabel(product)}</p>
            <p className="text-xs text-neutral-500">Giá tham khảo, vui lòng liên hệ để nhận báo giá chính xác.</p>

            {names.map((name, idx) => {
              const options = optionsOf(variants, name);
              if (options.length === 0) return null;
              const swatches = isColorAttribute(name);
              const chosen = sel ? valueOf(sel, name) : "";
              return (
                <div key={name} className="mt-5">
                  <p className="text-sm font-semibold uppercase">
                    {name}: <span data-testid={`attr-${idx}`} className="font-normal">{chosen || "Chọn"}</span>
                  </p>
                  <div role="radiogroup" aria-label={`Chọn ${name.toLowerCase()}`} className={`mt-2 flex flex-wrap ${swatches ? "gap-3" : "gap-2"}`}>
                    {options.map((value) => {
                      const on = chosen === value;
                      const dim = isAvailable(variants, name, value, sel) ? "" : "opacity-40";
                      const thumb = swatches ? thumbOf(name, value) : null;
                      return swatches ? (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`${name} ${value}`}
                          title={value}
                          onClick={() => choose(pickOption(variants, name, value, sel))}
                          className={`relative size-11 overflow-hidden rounded-full border-2 bg-white transition ${on ? "border-[#de0000] ring-2 ring-[#de0000]/30" : "border-neutral-300 hover:border-black"} ${dim}`}
                        >
                          {thumb ? (
                            <Image src={thumb} alt="" fill sizes="44px" className="scale-[1.6] object-contain" />
                          ) : (
                            <span className="grid size-full place-items-center px-1 text-[9px] leading-tight">{value}</span>
                          )}
                        </button>
                      ) : (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => choose(pickOption(variants, name, value, sel))}
                          className={`border px-3 py-1.5 text-sm ${on ? "border-black font-semibold" : "border-neutral-300 text-neutral-700 hover:border-black"} ${dim}`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {variants.length === 0 && product.colors.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold">Màu sắc</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <li key={c} className="border border-neutral-300 px-3 py-1 text-xs">{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {product.shortHtml && <div className="prose-content mt-5 text-sm" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: product.shortHtml }} />}

            <ul className="mt-5 space-y-2 text-sm">
              {benefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-green-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {HOTLINES.map((n) => (
                <a key={n} href={telHref(n)} className="flex items-center justify-center gap-2 bg-[#de0000] px-4 py-3 text-sm font-bold text-white hover:bg-[#b80000]">
                  <Phone size={16} /> Gọi {n}
                </a>
              ))}
              <a
                href={FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#0a7cff] px-4 py-3 text-sm font-bold text-white hover:bg-[#0866d4] sm:col-span-2"
              >
                <MessageCircle size={16} /> Nhắn tin Facebook
              </a>
            </div>
          </div>
        </div>

        {tabs.length > 0 && (
          <section className="mt-6 bg-white" aria-label="Chi tiết sản phẩm">
            <div role="tablist" aria-label="Chi tiết sản phẩm" className="flex overflow-x-auto bg-[#2b2b2b] text-sm font-semibold uppercase text-white [scrollbar-width:none]">
              {tabs.map((t, k) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`detail-tab-${k}`}
                  aria-selected={k === tab}
                  aria-controls="detail-panel"
                  onClick={() => setTab(k)}
                  className={`shrink-0 border-b-4 px-6 py-4 ${k === tab ? "border-[#de0000]" : "border-transparent text-neutral-400 hover:text-white"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div id="detail-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`}>
              {tabs[tab] === "Thông tin sản phẩm" && (
                <div className="p-5 md:p-8">
                  <div ref={content} className="relative overflow-hidden transition-[max-height] duration-500" style={{ maxHeight: expanded ? fullH : COLLAPSED }}>
                    <div className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: product.html }} />
                    {canExpand && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />}
                  </div>
                  {canExpand && (
                    <button
                      onClick={() => setExpanded((e) => !e)}
                      aria-expanded={expanded}
                      className="mx-auto mt-3 flex items-center gap-1 text-sm font-semibold text-[#de0000] hover:underline"
                    >
                      {expanded ? "Thu gọn" : "Xem thêm"} <ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
                    </button>
                  )}
                </div>
              )}
              {tabs[tab] === "Thông số kỹ thuật" && <SpecAccordion groups={product.specs} />}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-6 bg-white p-5 md:p-8" aria-label="Xe tham khảo thêm">
            <h2 className="mb-5 text-lg font-semibold uppercase">Xe {brandName(product.brand)} khác</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {related.map((m) => (
                <Link key={m.slug} href={productHref(m.slug)} className="group block text-center">
                  <div className="relative aspect-[4/3] overflow-hidden bg-white">
                    <Image src={m.img!} alt={m.name} fill sizes="(min-width: 1024px) 220px, 50vw" className="object-contain transition duration-500 group-hover:scale-105" />
                  </div>
                  <p className="mt-2 text-sm font-semibold uppercase">{m.name}</p>
                  <p className="text-xs text-neutral-500">{priceLabel(m)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
