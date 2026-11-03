"use client";

import { useActionState, useEffect, useState } from "react";
import { previewCountAction, saveCollectionAction, type CollectionFormState } from "@/app/admin/collection-actions";
import Image from "next/image";
import type { Collection } from "@/lib/collections";
import { BACKDROP_PRESETS } from "@/lib/home-sections";
import { btnCls, btnGhost, inputCls } from "./ui";
import { HtmlEditor } from "./HtmlEditor";
import { ImageInput } from "./ImageInput";

type Opt = { id: string; name: string };
type Product = { slug: string; name: string; brand: string };

export function CollectionForm({ collection, products, brands, types }: { collection: Collection; products: Product[]; brands: Opt[]; types: Opt[] }) {
  const [state, action, pending] = useActionState<CollectionFormState & { saved?: boolean }, FormData>(
    async (prev, f) => {
      const r = await saveCollectionAction(prev, f);
      return { ...r, saved: !r.error };
    },
    {},
  );
  const [c, setC] = useState<Collection>(collection);
  const [count, setCount] = useState<number | null>(null);
  const set = (p: Partial<Collection>) => setC((x) => ({ ...x, ...p }));
  const toggle = (key: "brands" | "types", id: string) => set({ [key]: c[key].includes(id) ? c[key].filter((x) => x !== id) : [...c[key], id] });
  const byslug = new Map(products.map((p) => [p.slug, p]));
  const free = products.filter((p) => !c.slugs.includes(p.slug));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= c.slugs.length) return;
    const s = [...c.slugs];
    [s[i], s[j]] = [s[j], s[i]];
    set({ slugs: s });
  };

  // how many xe the rules match right now
  const rules = JSON.stringify([c.brands, c.types, c.priceMin, c.priceMax]);
  useEffect(() => {
    if (c.mode !== "auto") return;
    let live = true;
    const t = setTimeout(() => {
      previewCountAction({ brands: c.brands, types: c.types, priceMin: Number(c.priceMin) || 0, priceMax: Number(c.priceMax) || 0 }).then((n) => live && setCount(n)).catch(() => live && setCount(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.mode, rules]);

  return (
    <form action={action} className="space-y-4 bg-white p-4">
      <input type="hidden" name="id" value={collection.id} />
      <input type="hidden" name="collection" value={JSON.stringify(c)} />
      <label className="block text-sm font-semibold">
        Tên bộ sưu tập
        <input value={c.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} className={`${inputCls} mt-1 font-normal`} />
        <span className="mt-1 block text-xs font-normal text-neutral-500">Địa chỉ trang: /bo-suu-tap/{collection.id} (không đổi sau khi tạo)</span>
      </label>
      <div>
        <p className="mb-1 text-sm font-semibold">Mô tả ngắn (HTML, hiện dưới tên bộ sưu tập, không bắt buộc)</p>
        <HtmlEditor defaultValue={collection.description} onChange={(v) => set({ description: v })} rows={3} maxLength={5000} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">Mô tả chi tiết (HTML, hiện ở trang bộ sưu tập, có nút Xem thêm)</p>
        <HtmlEditor defaultValue={collection.html} onChange={(v) => set({ html: v })} rows={10} maxLength={200000} />
        <p className="mt-1 text-xs text-neutral-500">Cho phép mọi thẻ HTML, kể cả script, style và iframe. Chỉ dán mã bạn tin tưởng: mã chạy trên mọi trang khách xem. Tab Xem trước chạy trong khung cô lập (không chạy script).</p>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">Ảnh đại diện (hiện nhỏ cạnh tên bộ sưu tập và ở thẻ trong danh sách, không bắt buộc)</p>
        <ImageInput value={c.image} onChange={(v) => set({ image: v })} />
      </div>
      <div>
        <p className="text-sm font-semibold">Ảnh nền khi hiện trên trang chủ (kiểu giới thiệu)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set({ backdrop: "", dark: false })} aria-pressed={!c.backdrop} className={`h-14 w-24 border-2 bg-white text-xs ${!c.backdrop ? "border-[#de0000]" : "border-neutral-300"}`}>Nền trắng</button>
          {BACKDROP_PRESETS.map((p) => (
            <button key={p.src} type="button" onClick={() => set({ backdrop: p.src, dark: p.dark })} aria-pressed={c.backdrop === p.src} title={p.label} className={`relative h-14 w-24 overflow-hidden border-2 ${c.backdrop === p.src ? "border-[#de0000]" : "border-neutral-300"}`}>
              <Image src={p.src} alt={p.label} fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
        <details className="mt-2" open={!!c.backdrop && !BACKDROP_PRESETS.some((p) => p.src === c.backdrop)}>
          <summary className="cursor-pointer text-xs text-neutral-600">Dùng ảnh khác (tải lên hoặc dán link)</summary>
          <div className="mt-2"><ImageInput value={BACKDROP_PRESETS.some((p) => p.src === c.backdrop) ? "" : c.backdrop} onChange={(v) => set({ backdrop: v })} /></div>
        </details>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.dark} onChange={(e) => set({ dark: e.target.checked })} className="size-4 accent-[#de0000]" /> Ảnh nền tối (chữ hiện màu trắng)
        </label>
      </div>
      <div>
        <p className="text-sm font-semibold">Ảnh nền trên điện thoại</p>
        <p className="mt-1 text-xs text-neutral-500">Để trống thì điện thoại giữ nền trắng như trước. Ảnh nằm sau hình xe (khung cao khoảng 260-340px, ảnh được cắt vừa khung).</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set({ backdropMobile: "" })} aria-pressed={!c.backdropMobile} className={`h-14 w-24 border-2 bg-white text-xs ${!c.backdropMobile ? "border-[#de0000]" : "border-neutral-300"}`}>Nền trắng</button>
          {c.backdrop && (
            <button type="button" onClick={() => set({ backdropMobile: c.backdrop })} aria-pressed={c.backdropMobile === c.backdrop} title="Dùng cùng ảnh nền với máy tính" className={`relative h-14 w-24 overflow-hidden border-2 ${c.backdropMobile === c.backdrop ? "border-[#de0000]" : "border-neutral-300"}`}>
              <Image src={c.backdrop} alt="Cùng ảnh nền máy tính" fill sizes="96px" className="object-cover" />
            </button>
          )}
        </div>
        <details className="mt-2" open={!!c.backdropMobile && c.backdropMobile !== c.backdrop}>
          <summary className="cursor-pointer text-xs text-neutral-600">Dùng ảnh khác (tải lên hoặc dán link)</summary>
          <div className="mt-2"><ImageInput value={c.backdropMobile === c.backdrop ? "" : (c.backdropMobile ?? "")} onChange={(v) => set({ backdropMobile: v })} /></div>
        </details>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.active} onChange={(e) => set({ active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
      </label>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Cách chọn xe</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={c.mode === "manual"} onChange={() => set({ mode: "manual" })} className="size-4 accent-[#de0000]" /> Chọn tay từng xe</label>
          <label className="flex items-center gap-2"><input type="radio" checked={c.mode === "auto"} onChange={() => set({ mode: "auto" })} className="size-4 accent-[#de0000]" /> Tự động theo luật</label>
        </div>
      </fieldset>

      {c.mode === "manual" ? (
        <div>
          {c.slugs.length === 0 && <p className="text-sm text-neutral-500">Chưa có xe nào. Chọn xe ở ô bên dưới.</p>}
          <ol className="space-y-1">
            {c.slugs.map((slug, i) => (
              <li key={slug} className="flex items-center gap-2 border border-neutral-200 px-2 py-1 text-sm">
                <span className="w-6 text-right text-xs text-neutral-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{byslug.get(slug)?.name ?? <em className="text-neutral-400">{slug} (không còn hiện)</em>}</span>
                <button type="button" aria-label="Lên" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>↑</button>
                <button type="button" aria-label="Xuống" onClick={() => move(i, 1)} disabled={i === c.slugs.length - 1} className={btnGhost}>↓</button>
                <button type="button" aria-label="Bỏ xe này" onClick={() => set({ slugs: c.slugs.filter((x) => x !== slug) })} className={btnGhost}>✕</button>
              </li>
            ))}
          </ol>
          <select aria-label="Thêm xe vào bộ sưu tập" value="" onChange={(e) => e.target.value && set({ slugs: [...c.slugs, e.target.value] })} className={`${inputCls} mt-2 max-w-sm`}>
            <option value="">+ Thêm xe vào bộ sưu tập...</option>
            {brands.map((b) => {
              const opts = free.filter((p) => p.brand === b.id);
              return opts.length ? <optgroup key={b.id} label={b.name}>{opts.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</optgroup> : null;
            })}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Hãng (không chọn = mọi hãng)</legend>
            <div className="flex flex-wrap gap-4">
              {brands.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.brands.includes(b.id)} onChange={() => toggle("brands", b.id)} className="size-4 accent-[#de0000]" /> {b.name}</label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Loại xe (không chọn = mọi loại)</legend>
            <div className="flex flex-wrap gap-4">
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.types.includes(t.id)} onChange={() => toggle("types", t.id)} className="size-4 accent-[#de0000]" /> {t.name}</label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold">Giá từ (đồng, để 0 = không giới hạn)
              <input inputMode="numeric" value={String(c.priceMin)} onChange={(e) => set({ priceMin: e.target.value as unknown as number })} className={`${inputCls} mt-1 font-normal`} />
            </label>
            <label className="block text-sm font-semibold">Giá đến (đồng, để 0 = không giới hạn)
              <input inputMode="numeric" value={String(c.priceMax)} onChange={(e) => set({ priceMax: e.target.value as unknown as number })} className={`${inputCls} mt-1 font-normal`} />
            </label>
          </div>
          <p className="text-sm text-neutral-600" role="status">{count === null ? "Đang đếm..." : `Hiện có ${count} xe phù hợp luật này. Xe mới thêm sẽ tự vào nếu phù hợp.`}</p>
        </div>
      )}

      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm font-medium text-green-700">Đã lưu.</p>}
      <div><button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu bộ sưu tập"}</button></div>
    </form>
  );
}
