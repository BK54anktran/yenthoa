"use client";

import { DEFAULT_FACT_CALL, MAX_FACTS, type FactItem, type HomeSection } from "@/lib/home-sections";
import { btnGhost, inputCls } from "./ui";

const AUTO: { id: FactItem["auto"]; label: string }[] = [
  { id: "products", label: "Tự đếm: số mẫu xe" },
  { id: "brands", label: "Tự đếm: số hãng xe" },
  { id: "branches", label: "Tự đếm: số cửa hàng" },
  { id: "", label: "Tự nhập số" },
];

// The strip of big figures under the banner. Changes are made on the latest block (see SlideCardsEditor).
export function FactsEditor({ items, call, onChange }: { items: FactItem[]; call: string; onChange: (p: (cur: HomeSection) => Partial<HomeSection>) => void }) {
  const setItem = (i: number, patch: Partial<FactItem>) => onChange((cur) => ({ factItems: (cur.factItems ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, d: -1 | 1) =>
    onChange((cur) => {
      const list = cur.factItems ?? [];
      const j = i + d;
      if (j < 0 || j >= list.length) return {};
      const c = [...list];
      [c[i], c[j]] = [c[j], c[i]];
      return { factItems: c };
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">Dải số liệu lớn nền xám đậm ngay dưới banner. Mỗi số tự đếm theo dữ liệu của cửa hàng hoặc bạn tự nhập. Nút gọi lấy số hotline đầu tiên ở mục Thông tin cửa hàng. Mục này tắt được (bỏ chọn Đang hiện) nhưng không xoá được.</p>
      {items.map((x, i) => (
        <div key={i} className="grid items-center gap-3 border border-neutral-200 p-3 md:grid-cols-[1.2fr_0.7fr_1.4fr_auto]">
          <select aria-label="Cách lấy số" value={x.auto} onChange={(e) => setItem(i, { auto: e.target.value as FactItem["auto"] })} className="h-10 border border-neutral-300 bg-white px-2 text-sm">
            {AUTO.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input aria-label="Số" placeholder={x.auto ? "(tự đếm)" : "Số, ví dụ 10+"} value={x.auto ? "" : x.value} disabled={!!x.auto} maxLength={12} onChange={(e) => setItem(i, { value: e.target.value })} className={`${inputCls} disabled:bg-neutral-100`} />
          <input aria-label="Chữ mô tả" placeholder="Chữ mô tả, ví dụ hãng xe" value={x.label} maxLength={40} onChange={(e) => setItem(i, { label: e.target.value })} className={inputCls} />
          <span className="flex gap-2">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>Trái</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className={btnGhost}>Phải</button>
            <button type="button" onClick={() => onChange((cur) => ({ factItems: (cur.factItems ?? []).filter((_, j) => j !== i) }))} className={btnGhost}>Xoá</button>
          </span>
        </div>
      ))}
      <button type="button" onClick={() => onChange((cur) => ({ factItems: [...(cur.factItems ?? []), { label: "", value: "", auto: "products" }] }))} disabled={items.length >= MAX_FACTS} className={btnGhost}>+ Thêm số liệu ({items.length}/{MAX_FACTS})</button>
      <div>
        <p className="mb-1 text-xs font-semibold text-neutral-600">Câu phía trên nút gọi (để trống = không hiện câu)</p>
        <input aria-label="Câu phía trên nút gọi" placeholder={DEFAULT_FACT_CALL} value={call} maxLength={80} onChange={(e) => onChange(() => ({ factCall: e.target.value }))} className={inputCls} />
      </div>
    </div>
  );
}
