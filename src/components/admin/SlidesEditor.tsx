"use client";

import type { SlideRow } from "@/lib/admin-repo";
import { btnGhost, inputCls } from "./ui";
import { ImageInput } from "./ImageInput";

const blank: SlideRow = { eyebrow: "", title: "", sub: "", img: "", link: "", active: true };

// The rotating banners under the menu. Controlled by the home page editor, which saves them with everything else.
export function SlidesEditor({ slides, onChange }: { slides: SlideRow[]; onChange: (s: SlideRow[]) => void }) {
  const set = (i: number, patch: Partial<SlideRow>) => onChange(slides.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const c = [...slides];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };

  return (
    <div className="space-y-4">
      {slides.map((s, i) => (
        <div key={i} className="grid gap-3 border border-neutral-200 p-3 md:grid-cols-2">
          <input aria-label="Dòng nhỏ phía trên" placeholder="Dòng nhỏ phía trên" value={s.eyebrow} onChange={(e) => set(i, { eyebrow: e.target.value })} className={inputCls} />
          <input aria-label="Tiêu đề" placeholder="Tiêu đề (bắt buộc)" value={s.title} onChange={(e) => set(i, { title: e.target.value })} className={inputCls} />
          <input aria-label="Mô tả" placeholder="Mô tả ngắn" value={s.sub} onChange={(e) => set(i, { sub: e.target.value })} className={inputCls} />
          <ImageInput value={s.img} onChange={(v) => set(i, { img: v })} />
          <div className="md:col-span-2">
            <input aria-label="Đường dẫn khi bấm" placeholder="Đường dẫn khi bấm nút (để trống = không hiện nút), ví dụ /xe-may hoặc https://..." value={s.link} onChange={(e) => set(i, { link: e.target.value })} maxLength={500} className={inputCls} />
            <p className="mt-1 text-xs text-neutral-500">Nhập trang trong website (/xe-may, /tin-tuc/...) hoặc bất kỳ link nào: https://..., tel:0789619698, mailto:...</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.active} onChange={(e) => set(i, { active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
            </label>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>Lên</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1} className={btnGhost}>Xuống</button>
            <button type="button" onClick={() => onChange(slides.filter((_, j) => j !== i))} className={btnGhost}>Xoá banner</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...slides, { ...blank }])} disabled={slides.length >= 10} className={btnGhost}>+ Thêm banner</button>
    </div>
  );
}
