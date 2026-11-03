"use client";

import { useActionState, useState } from "react";
import { saveTaxonomyAction, type FormState } from "@/app/admin/actions";
import { BRAND_MENUS, type BrandMenu, type Taxonomy } from "@/lib/taxonomy";
import type { Menu } from "@/lib/menu";
import { btnCls, btnGhost, inputCls } from "./ui";
import { MenuEditor } from "./MenuEditor";

type Row = { id: string; name: string; active: boolean; menu?: BrandMenu | boolean; key: number };
type Key = "brands" | "types" | "sections";
type Usage = Record<Key, Record<string, number>>;

let counter = 0;
const withKeys = (l: { id: string; name: string; active: boolean; menu?: BrandMenu | boolean }[]): Row[] => l.map((x) => ({ ...x, key: ++counter }));

const GROUPS: { key: Key; title: string; hint: string; unit: string; blank: Partial<Row> }[] = [
  { key: "brands", title: "Hãng xe", hint: "Hiện trong bộ lọc, trang chi tiết và menu. Chọn menu để hãng nằm trong nhóm Xe máy hoặc Xe điện ở đầu trang.", unit: "xe", blank: { menu: "xe-may" } },
  { key: "types", title: "Loại xe", hint: "Ví dụ xe số, xe tay ga. Một xe có thể thuộc nhiều loại.", unit: "xe", blank: {} },
  { key: "sections", title: "Mục tin tức", hint: "Chuyên mục của bài viết. Tick \"Hiện trên menu\" để mục xuất hiện trong menu Tin tức.", unit: "bài", blank: { menu: false } },
];

export function TaxonomyForm({ taxonomy, usage, menu: initialMenu }: { taxonomy: Taxonomy; usage: Usage; menu: Menu }) {
  const [state, action, pending] = useActionState<FormState & { saved?: boolean }, FormData>(
    async (prev, f) => {
      const r = await saveTaxonomyAction(prev, f);
      return { ...r, saved: !r.error };
    },
    {},
  );
  const [data, setData] = useState<Record<Key, Row[]>>(() => ({
    brands: withKeys(taxonomy.brands),
    types: withKeys(taxonomy.types),
    sections: withKeys(taxonomy.sections),
  }));
  const [menu, setMenu] = useState<Menu>(initialMenu);
  const setRows = (k: Key, fn: (r: Row[]) => Row[]) => setData((d) => ({ ...d, [k]: fn(d[k]) }));
  const patch = (k: Key, key: number, p: Partial<Row>) => setRows(k, (r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const move = (k: Key, i: number, dir: -1 | 1) =>
    setRows(k, (r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const c = [...r];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const payload = JSON.stringify(Object.fromEntries((Object.keys(data) as Key[]).map((k) => [k, data[k].map((x) => ({ id: x.id, name: x.name, active: x.active, menu: x.menu }))])));

  return (
    <form action={action} className="max-w-4xl space-y-6">
      {GROUPS.map((g) => (
        <details key={g.key} className="group bg-white p-4" aria-label={g.title}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="text-lg font-semibold">{g.title} ({data[g.key].length})</span>
            <span className="text-xs text-neutral-500"><span className="group-open:hidden">Mở rộng ▾</span><span className="hidden group-open:inline">Thu gọn ▴</span></span>
          </summary>
          <p className="mb-3 mt-1 text-xs text-neutral-500">{g.hint}</p>
          <ul className="space-y-2">
            {data[g.key].map((r, i) => {
              const used = usage[g.key][r.id] ?? 0;
              return (
                <li key={r.key} className="flex flex-wrap items-center gap-2 border border-neutral-200 p-2">
                  <input
                    aria-label="Tên"
                    value={r.name}
                    onChange={(e) => patch(g.key, r.key, { name: e.target.value })}
                    maxLength={60}
                    placeholder="Tên (bắt buộc)"
                    className={`${inputCls} min-w-40 flex-1`}
                  />
                  {g.key === "brands" && (
                    <select aria-label="Menu" value={String(r.menu ?? "")} onChange={(e) => patch(g.key, r.key, { menu: e.target.value as BrandMenu })} className={`${inputCls} w-auto`}>
                      {BRAND_MENUS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  )}
                  {g.key === "sections" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!r.menu} onChange={(e) => patch(g.key, r.key, { menu: e.target.checked })} className="size-4 accent-[#de0000]" /> Hiện trên menu
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.active} onChange={(e) => patch(g.key, r.key, { active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
                  </label>
                  <span className="text-xs text-neutral-400" title="Mã dùng trong đường dẫn, không đổi được">{r.id ? `mã: ${r.id}` : "mã tự tạo khi lưu"}{used ? ` · ${used} ${g.unit}` : ""}</span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" aria-label="Lên" onClick={() => move(g.key, i, -1)} disabled={i === 0} className={btnGhost}>↑</button>
                    <button type="button" aria-label="Xuống" onClick={() => move(g.key, i, 1)} disabled={i === data[g.key].length - 1} className={btnGhost}>↓</button>
                    <button
                      type="button"
                      aria-label="Xoá"
                      disabled={used > 0}
                      title={used > 0 ? `Đang có ${used} ${g.unit} dùng, chỉ tắt "Đang hiện" được` : "Xoá"}
                      onClick={() => setRows(g.key, (x) => x.filter((y) => y.key !== r.key))}
                      className={`${btnGhost} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setRows(g.key, (x) => [...x, { id: "", name: "", active: true, ...g.blank, key: ++counter }])} disabled={data[g.key].length >= 60} className={`${btnGhost} mt-3`}>
            + Thêm {g.title.toLowerCase()}
          </button>
        </details>
      ))}
      <details className="group bg-white p-4" aria-label="Menu">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="text-lg font-semibold">Menu đầu trang</span>
          <span className="text-xs text-neutral-500"><span className="group-open:hidden">Mở rộng ▾</span><span className="hidden group-open:inline">Thu gọn ▴</span></span>
        </summary>
        <p className="mb-3 mt-1 text-xs text-neutral-500">Menu nhiều cấp, mỗi mục có đường dẫn tự do (trang trong site, https://, tel:, mailto:). Mục con có thể tự nhập hoặc lấy từ hãng xe, mục tin tức hoặc các bộ sưu tập xe.</p>
        <h3 className="mb-2 text-sm font-semibold">Hàng chính (nền đỏ, bên trái)</h3>
        <MenuEditor nodes={menu.main} onChange={(main) => setMenu((m) => ({ ...m, main }))} />
        <h3 className="mb-2 mt-5 text-sm font-semibold">Hàng phụ (bên phải)</h3>
        <MenuEditor nodes={menu.secondary} onChange={(secondary) => setMenu((m) => ({ ...m, secondary }))} />
      </details>

      <input type="hidden" name="taxonomy" value={payload} />
      <input type="hidden" name="menu" value={JSON.stringify(menu)} />
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm font-medium text-green-700">Đã lưu. Website đã cập nhật.</p>}
      <div><button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu danh mục"}</button></div>
    </form>
  );
}
