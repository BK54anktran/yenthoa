"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { Menu as GripIcon } from "lucide-react";
import { saveHomeAction, type FormState } from "@/app/admin/actions";
import type { SlideRow } from "@/lib/admin-repo";
import { BACKDROP_PRESETS, type HomeSection } from "@/lib/home-sections";
import type { Collection } from "@/lib/collections";
import { btnCls, btnGhost, inputCls } from "./ui";
import { HtmlEditor } from "./HtmlEditor";
import { ImageInput } from "./ImageInput";
import { SlideCardsEditor } from "./SlideCardsEditor";
import { SlidesEditor } from "./SlidesEditor";

type Brand = { id: string; name: string };
type Product = { slug: string; name: string; brand: string };

export function HomeSectionsForm({ sections: initial, slides: initialSlides, brands, products, collections }: { sections: HomeSection[]; slides: SlideRow[]; brands: Brand[]; products: Product[]; collections: Pick<Collection, "id" | "name">[] }) {
  const [state, action, pending] = useActionState<FormState & { saved?: boolean }, FormData>(
    async (prev, f) => {
      const r = await saveHomeAction(prev, f);
      return { ...r, saved: !r.error };
    },
    {},
  );
  const [list, setList] = useState<HomeSection[]>(initial);
  const [slides, setSlides] = useState<SlideRow[]>(initialSlides);
  const [openId, setOpenId] = useState<string | null>(null); // the block that was just added stays open
  const byslug = new Map(products.map((p) => [p.slug, p]));
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  const add = (kind: HomeSection["kind"]) => {
    const id = `${kind === "banner" ? "banner" : kind === "html" ? "html" : "muc"}-${Date.now().toString(36)}`;
    setList((x) => [...x, { id, kind, image: "", link: "", name: "", collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: true }]);
    setOpenId(id);
  };
  const set = (i: number, patch: Partial<HomeSection>) => setList((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // --- drag to reorder: grab the three-line handle of a block and move it up or down (mouse or finger)
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const pointerY = useRef(0);
  const frame = useRef(0);
  const cards = useRef(new Map<string, HTMLElement>());

  // the block goes to the place where the pointer is: after every other block whose middle is above the pointer
  const placeAt = (id: string, y: number) =>
    setList((cur) => {
      const from = cur.findIndex((x) => x.id === id);
      if (from < 0) return cur;
      const mid = (x: HomeSection) => {
        const r = cards.current.get(x.id)?.getBoundingClientRect();
        return r ? r.top + r.height / 2 : Infinity;
      };
      const to = cur.filter((x) => x.id !== id && mid(x) < y).length;
      if (to === from) return cur;
      const next = cur.filter((x) => x.id !== id);
      next.splice(to, 0, cur[from]);
      return next;
    });

  // near the top or bottom edge of the window the page scrolls by itself, so a block can be taken a long way
  function follow() {
    const id = dragRef.current;
    if (!id) return;
    const y = pointerY.current;
    if (y < 90) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
    placeAt(id, y);
    frame.current = requestAnimationFrame(follow);
  }
  // While a block is held, follow the pointer on the whole window: moving the blocks in the list moves their elements on the
  // page, and the browser lets go of a pointer that was captured by an element that moved
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    const stop = () => {
      dragRef.current = null;
      cancelAnimationFrame(frame.current);
      setDragId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      cancelAnimationFrame(frame.current);
    };
  }, [dragId]);

  const swap = <T,>(arr: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  return (
    <form action={action} data-dragging={dragId ? "1" : undefined} className="max-w-4xl space-y-4 [&[data-dragging]_details>:not(summary)]:hidden">
      {list.map((s, i) => {
        const preset = BACKDROP_PRESETS.find((p) => p.src === s.backdrop);
        const auto = !!s.brand && s.slugs.length === 0;
        const free = products.filter((p) => !s.slugs.includes(p.slug));
        return (
          <details
            key={s.id}
            ref={(el) => {
              if (el) cards.current.set(s.id, el);
              else cards.current.delete(s.id);
            }}
            open={s.id === openId}
            className={`group space-y-4 bg-white p-4 ${dragId === s.id ? "relative z-10 shadow-xl ring-2 ring-[#de0000]" : ""}`}
            aria-label={s.name || `Mục ${i + 1}`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Kéo để đổi vị trí"
                title="Kéo để đổi vị trí (hoặc bấm vào rồi dùng phím mũi tên lên xuống)"
                onClick={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pointerY.current = e.clientY;
                  dragRef.current = s.id;
                  setDragId(s.id);
                  cancelAnimationFrame(frame.current);
                  frame.current = requestAnimationFrame(follow);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    setList((x) => swap(x, i, e.key === "ArrowUp" ? -1 : 1));
                  }
                }}
                className={`grid size-8 shrink-0 touch-none select-none place-items-center text-neutral-400 hover:bg-neutral-100 hover:text-[#de0000] focus-visible:outline-2 focus-visible:outline-[#de0000] ${dragId === s.id ? "cursor-grabbing text-[#de0000]" : "cursor-grab"}`}
              >
                <GripIcon size={18} />
              </button>
              <span className="min-w-0 truncate text-base font-semibold">
                {s.name || (s.kind === "banner" ? "Banner mới" : s.kind === "html" ? "Khối HTML mới" : "Mục mới")}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {s.kind === "html" ? "khối HTML" : s.kind === "slides" ? `${slides.length} ảnh chạy luân phiên` : s.kind === "collections" ? (s.slugs.length ? `${s.slugs.length} bộ sưu tập được chọn` : "tất cả bộ sưu tập") : s.kind === "banner" ? "banner ảnh" : s.brand ? (s.slugs.length ? `${s.slugs.length} xe tự chọn` : `tự động hãng ${brandName(s.brand)}`) : `${s.slugs.length} xe`}{s.active ? "" : " · đang ẩn"}
                </span>
              </span>
              </span>
              <span className="shrink-0 text-xs text-neutral-500"><span className="group-open:hidden">Mở rộng ▾</span><span className="hidden group-open:inline">Thu gọn ▴</span></span>
            </summary>
            {s.kind === "html" ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold">
                  Tên gọi trong admin (không hiện ra trang)
                  <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={80} placeholder="Ví dụ: Giới thiệu cửa hàng" className={`${inputCls} mt-1 font-normal`} />
                </label>
                <div>
                  <p className="mb-1 text-sm font-semibold">Nội dung (HTML)</p>
                  <HtmlEditor defaultValue={s.html ?? ""} onChange={(v) => set(i, { html: v })} rows={12} maxLength={100000} />
                  <p className="mt-1 text-xs text-neutral-500">Hiện nguyên như bài viết ở đúng vị trí của mục này. Cho phép mọi thẻ HTML, kể cả script, style và iframe. Chỉ dán mã bạn tin tưởng: mã chạy trên mọi trang khách xem. Tab Xem trước chạy trong khung cô lập (không chạy script).</p>
                </div>
              </div>
            ) : s.kind === "collections" ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold">
                  Tiêu đề hiện trên trang
                  <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={80} className={`${inputCls} mt-1 font-normal`} />
                </label>
                <label className="block text-sm font-semibold">
                  Kiểu hiển thị
                  <select value={s.display ?? "showcase"} onChange={(e) => set(i, { display: e.target.value as "showcase" | "cards" })} className={`${inputCls} mt-1 font-normal`}>
                    <option value="showcase">Giới thiệu từng bộ sưu tập (ảnh xe lớn có nền, dải xe bên dưới)</option>
                    <option value="cards">Thẻ ảnh (lưới, mỗi bộ một thẻ)</option>
                  </select>
                  <span className="mt-1 block text-xs font-normal text-neutral-500">Kiểu giới thiệu dùng ảnh nền riêng của từng bộ sưu tập (chọn ở trang Bộ sưu tập), tiêu đề bên dưới chỉ dùng cho kiểu thẻ ảnh.</span>
                </label>
                <div>
                  <p className="text-sm font-semibold">Bộ sưu tập hiện ra</p>
                  <p className="mb-2 text-xs text-neutral-500">
                    {s.slugs.length === 0 ? "Đang hiện tất cả bộ sưu tập đang bật và có xe. Chọn ở ô bên dưới để chỉ hiện những cái bạn muốn." : "Chỉ hiện những bộ sưu tập dưới đây, theo thứ tự này (bộ nào đang tắt hoặc chưa có xe thì tự ẩn)."}
                  </p>
                  <ol className="space-y-1">
                    {s.slugs.map((id, k) => (
                      <li key={id} className="flex items-center gap-2 border border-neutral-200 px-2 py-1 text-sm">
                        <span className="w-6 text-right text-xs text-neutral-400">{k + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{collections.find((c) => c.id === id)?.name ?? <em className="text-neutral-400">{id} (đã xoá)</em>}</span>
                        <button type="button" aria-label="Lên" onClick={() => set(i, { slugs: swap(s.slugs, k, -1) })} disabled={k === 0} className={btnGhost}>↑</button>
                        <button type="button" aria-label="Xuống" onClick={() => set(i, { slugs: swap(s.slugs, k, 1) })} disabled={k === s.slugs.length - 1} className={btnGhost}>↓</button>
                        <button type="button" aria-label="Bỏ bộ sưu tập này" onClick={() => set(i, { slugs: s.slugs.filter((x) => x !== id) })} className={btnGhost}>✕</button>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select aria-label="Thêm bộ sưu tập" value="" onChange={(e) => e.target.value && set(i, { slugs: [...s.slugs, e.target.value] })} className={`${inputCls} max-w-sm`}>
                      <option value="">+ Chọn bộ sưu tập để hiện...</option>
                      {collections.filter((c) => !s.slugs.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {s.slugs.length > 0 && <button type="button" onClick={() => set(i, { slugs: [] })} className={btnGhost}>Hiện tất cả</button>}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">Tạo, sửa bộ sưu tập ở trang Bộ sưu tập.</p>
                </div>
              </div>
            ) : s.kind === "slides" ? (
              <div>
                <p className="mb-3 text-sm text-neutral-600">Các ảnh lớn chạy luân phiên, mặc định ngay dưới menu. Bạn có thể kéo mục này xuống vị trí khác bằng Lên/Xuống.</p>
                <SlidesEditor slides={slides} onChange={setSlides} />
                <SlideCardsEditor mode={s.cardsMode ?? "auto"} cards={s.cards ?? []} onChange={(p) => set(i, p)} />
              </div>
            ) : s.kind === "banner" ? (
              <div className="grid gap-3">
                <label className="block text-sm font-semibold">
                  Tên banner (mô tả ảnh, không hiện ra ngoài)
                  <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={80} placeholder="Ví dụ: Khuyến mãi tháng 11" className={`${inputCls} mt-1 font-normal`} />
                </label>
                <div>
                  <p className="mb-1 text-sm font-semibold">Ảnh banner</p>
                  <ImageInput value={s.image} onChange={(v) => set(i, { image: v })} />
                  <p className="mt-1 text-xs text-neutral-500">Ảnh ngang, rộng khoảng 1600px là đẹp. Banner hiện giữa các mục xe, theo đúng thứ tự trong danh sách.</p>
                </div>
                <label className="block text-sm font-semibold">
                  Đường dẫn khi bấm (để trống = không bấm được)
                  <input value={s.link} onChange={(e) => set(i, { link: e.target.value })} maxLength={500} placeholder="/xe-may, https://..., tel:0789619698" className={`${inputCls} mt-1 font-normal`} />
                </label>
              </div>
            ) : (
              <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold">
                Tên mục
                <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={80} placeholder="Ví dụ: Xe tay ga bán chạy" className={`${inputCls} mt-1 font-normal`} />
              </label>
              <label className="block text-sm font-semibold">
                Lấy xe theo hãng
                <select
                  value={s.brand}
                  onChange={(e) => set(i, { brand: e.target.value })}
                  className={`${inputCls} mt-1 font-normal`}
                >
                  <option value="">Không: tự chọn danh sách xe</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold md:col-span-2">
                Hoặc lấy xe từ một bộ sưu tập
                <select value={s.collection} onChange={(e) => set(i, { collection: e.target.value })} className={`${inputCls} mt-1 font-normal`}>
                  <option value="">Không dùng bộ sưu tập</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {s.collection && <span className="mt-1 block text-xs font-normal text-neutral-500">Đang lấy xe từ bộ sưu tập này (bỏ qua hãng và danh sách xe bên dưới), kể cả ảnh nền. Sửa xe và ảnh nền trong trang Bộ sưu tập.</span>}
              </label>
            </div>

            {s.collection && <p className="text-sm text-neutral-600">Ảnh nền của mục này lấy từ bộ sưu tập đã chọn. Đổi ở trang Bộ sưu tập, mục Ảnh nền khi hiện trên trang chủ.</p>}
            <div className={s.collection ? "hidden" : ""}>
              <p className="text-sm font-semibold">Ảnh nền (máy tính bảng và máy tính)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set(i, { backdrop: "", dark: false })} aria-pressed={!s.backdrop} className={`h-14 w-24 border-2 bg-white text-xs ${!s.backdrop ? "border-[#de0000]" : "border-neutral-300"}`}>
                  Nền trắng
                </button>
                {BACKDROP_PRESETS.map((p) => (
                  <button
                    key={p.src}
                    type="button"
                    onClick={() => set(i, { backdrop: p.src, dark: p.dark })}
                    aria-pressed={s.backdrop === p.src}
                    title={p.label}
                    className={`relative h-14 w-24 overflow-hidden border-2 ${s.backdrop === p.src ? "border-[#de0000]" : "border-neutral-300"}`}
                  >
                    <Image src={p.src} alt={p.label} fill sizes="96px" className="object-cover" />
                  </button>
                ))}
              </div>
              <details className="mt-2" open={!!s.backdrop && !preset}>
                <summary className="cursor-pointer text-xs text-neutral-600">Dùng ảnh khác (tải lên hoặc dán link)</summary>
                <div className="mt-2"><ImageInput value={preset ? "" : s.backdrop} onChange={(v) => set(i, { backdrop: v })} /></div>
              </details>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.dark} onChange={(e) => set(i, { dark: e.target.checked })} className="size-4 accent-[#de0000]" /> Ảnh nền tối (chữ hiện màu trắng)
              </label>
            </div>

            <div className={s.collection ? "hidden" : ""}>
              <p className="text-sm font-semibold">Ảnh nền trên điện thoại</p>
              <p className="mt-1 text-xs text-neutral-500">Để trống thì điện thoại giữ nền trắng như trước. Ảnh nằm sau hình xe (khung cao khoảng 260-340px, ảnh được cắt vừa khung).</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set(i, { backdropMobile: "" })} aria-pressed={!s.backdropMobile} className={`h-14 w-24 border-2 bg-white text-xs ${!s.backdropMobile ? "border-[#de0000]" : "border-neutral-300"}`}>Nền trắng</button>
                {s.backdrop && (
                  <button type="button" onClick={() => set(i, { backdropMobile: s.backdrop })} aria-pressed={s.backdropMobile === s.backdrop} title="Dùng cùng ảnh nền với máy tính" className={`relative h-14 w-24 overflow-hidden border-2 ${s.backdropMobile === s.backdrop ? "border-[#de0000]" : "border-neutral-300"}`}>
                    <Image src={s.backdrop} alt="Cùng ảnh nền máy tính" fill sizes="96px" className="object-cover" />
                  </button>
                )}
              </div>
              <details className="mt-2" open={!!s.backdropMobile && s.backdropMobile !== s.backdrop}>
                <summary className="cursor-pointer text-xs text-neutral-600">Dùng ảnh khác (tải lên hoặc dán link)</summary>
                <div className="mt-2"><ImageInput value={s.backdropMobile === s.backdrop ? "" : (s.backdropMobile ?? "")} onChange={(v) => set(i, { backdropMobile: v })} /></div>
              </details>
            </div>

            <div className={s.collection ? "hidden" : ""}>
              <p className="text-sm font-semibold">Danh sách xe</p>
              {auto ? (
                <p className="mt-1 text-sm text-neutral-600">
                  Tự động: hiện tất cả xe hãng {brandName(s.brand)}, xe mới thêm sẽ tự có mặt.{" "}
                  <button type="button" onClick={() => set(i, { slugs: products.filter((p) => p.brand === s.brand).map((p) => p.slug) })} className="underline hover:text-[#de0000]">
                    Chuyển sang tự chọn từng xe
                  </button>
                </p>
              ) : (
                <>
                  {s.slugs.length === 0 && <p className="mt-1 text-sm text-neutral-500">Chưa có xe nào. Chọn xe ở ô bên dưới.</p>}
                  <ol className="mt-2 space-y-1">
                    {s.slugs.map((slug, k) => (
                      <li key={slug} className="flex items-center gap-2 border border-neutral-200 px-2 py-1 text-sm">
                        <span className="w-6 text-right text-xs text-neutral-400">{k + 1}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {byslug.get(slug)?.name ?? <em className="text-neutral-400">{slug} (không còn hiện)</em>}
                          {byslug.get(slug) && <span className="ml-2 text-xs text-neutral-400">{brandName(byslug.get(slug)!.brand)}</span>}
                        </span>
                        <button type="button" aria-label="Lên" onClick={() => set(i, { slugs: swap(s.slugs, k, -1) })} disabled={k === 0} className={btnGhost}>↑</button>
                        <button type="button" aria-label="Xuống" onClick={() => set(i, { slugs: swap(s.slugs, k, 1) })} disabled={k === s.slugs.length - 1} className={btnGhost}>↓</button>
                        <button type="button" aria-label="Bỏ xe này" onClick={() => set(i, { slugs: s.slugs.filter((x) => x !== slug) })} className={btnGhost}>✕</button>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      aria-label="Thêm xe vào danh sách"
                      value=""
                      onChange={(e) => e.target.value && set(i, { slugs: [...s.slugs, e.target.value] })}
                      className={`${inputCls} max-w-sm`}
                    >
                      <option value="">+ Thêm xe vào danh sách...</option>
                      {brands.map((b) => {
                        const opts = free.filter((p) => p.brand === b.id);
                        return opts.length ? <optgroup key={b.id} label={b.name}>{opts.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</optgroup> : null;
                      })}
                    </select>
                    {s.brand && <button type="button" onClick={() => set(i, { slugs: [] })} className={btnGhost}>Quay lại tự động theo hãng {brandName(s.brand)}</button>}
                  </div>
                </>
              )}
            </div>

              </>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.active} onChange={(e) => set(i, { active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
              </label>
              <button type="button" onClick={() => setList((x) => swap(x, i, -1))} disabled={i === 0} className={btnGhost}>Lên</button>
              <button type="button" onClick={() => setList((x) => swap(x, i, 1))} disabled={i === list.length - 1} className={btnGhost}>Xuống</button>
              {s.kind !== "slides" && s.kind !== "collections" && <button type="button" onClick={() => setList((x) => x.filter((_, j) => j !== i))} className={btnGhost}>Xoá mục</button>}
            </div>
          </details>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => add("showcase")} disabled={list.length >= 30} className={btnGhost}>+ Thêm mục xe</button>
        <button type="button" onClick={() => add("banner")} disabled={list.length >= 30} className={btnGhost}>+ Thêm banner</button>
        <button type="button" onClick={() => add("html")} disabled={list.length >= 30} className={btnGhost}>+ Thêm khối HTML</button>
      </div>
      <input type="hidden" name="sections" value={JSON.stringify(list)} />
      <input type="hidden" name="slides" value={JSON.stringify(slides)} />
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm font-medium text-green-700">Đã lưu. Trang chủ đã cập nhật.</p>}
      <div><button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu trang chủ"}</button></div>
    </form>
  );
}
