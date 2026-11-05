"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SlideRow } from "@/lib/admin-repo";
import { btnGhost, inputCls } from "./ui";
import { ImageInput } from "./ImageInput";

const blank: SlideRow = { eyebrow: "", title: "", sub: "", img: "", imgMobile: "", fit: "cover", link: "", dim: true, active: true };

// The rotating banners under the menu. Controlled by the home page editor, which saves them with everything else.
// `onChange` is a state setter: every change is made on the latest list, so a picture that finishes uploading late cannot undo a banner added meanwhile.
export function SlidesEditor({ slides, onChange }: { slides: SlideRow[]; onChange: Dispatch<SetStateAction<SlideRow[]>> }) {
  const set = (i: number, patch: Partial<SlideRow>) => onChange((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => {
    onChange((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const c = [...cur];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  };

  return (
    <div className="space-y-3">
      {slides.map((s, i) => (
        <div key={i} className="border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-sm font-bold">Banner {i + 1}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.active} onChange={(e) => set(i, { active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
            </label>
            <label className="flex items-center gap-2 text-sm" title="Bỏ chọn để ảnh sáng nguyên bản, không phủ lớp tối">
              <input type="checkbox" checked={s.dim} onChange={(e) => set(i, { dim: e.target.checked })} className="size-4 accent-[#de0000]" /> Làm tối ảnh
            </label>
            <label className="flex items-center gap-2 text-sm" title="Lấp đầy: ảnh phủ kín khung cao cố định, phần thừa bị cắt. Vừa ảnh: khung cao theo đúng tỉ lệ ảnh, không cắt gì.">
              Hiển thị ảnh
              <select value={s.fit} onChange={(e) => set(i, { fit: e.target.value === "natural" ? "natural" : "cover" })} className="h-9 border border-neutral-300 bg-white px-2 text-sm">
                <option value="cover">Lấp đầy khung (có thể cắt)</option>
                <option value="natural">Vừa ảnh (không cắt)</option>
              </select>
            </label>
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>Lên</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1} className={btnGhost}>Xuống</button>
              <button type="button" onClick={() => onChange((cur) => cur.filter((_, j) => j !== i))} className={btnGhost}>Xoá</button>
            </span>
          </div>

          <div className="mt-3 grid items-start gap-3 md:grid-cols-3">
            <input aria-label="Dòng nhỏ phía trên" placeholder="Dòng nhỏ" value={s.eyebrow} onChange={(e) => set(i, { eyebrow: e.target.value })} className={inputCls} />
            <input aria-label="Tiêu đề" placeholder="Tiêu đề (có thể để trống)" value={s.title} onChange={(e) => set(i, { title: e.target.value })} className={inputCls} />
            <input aria-label="Mô tả" placeholder="Mô tả ngắn" value={s.sub} onChange={(e) => set(i, { sub: e.target.value })} className={inputCls} />
          </div>

          <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 truncate text-xs font-semibold text-neutral-600">Ảnh máy tính</p>
              <ImageInput value={s.img} onChange={(v) => set(i, { img: v })} />
            </div>
            <div>
              <p className="mb-1 truncate text-xs font-semibold text-neutral-600" title="Để trống thì điện thoại dùng ảnh máy tính. Nên chọn ảnh gần vuông hoặc dọc.">Ảnh điện thoại (trống = dùng ảnh máy tính)</p>
              <ImageInput value={s.imgMobile} onChange={(v) => set(i, { imgMobile: v })} />
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-neutral-600">Link khi bấm vào ảnh (để trống = ảnh không bấm được)</p>
            <input aria-label="Đường dẫn khi bấm" placeholder="/xe-may, /tin-tuc/..., https://..., tel:0789619698, mailto:..." value={s.link} onChange={(e) => set(i, { link: e.target.value })} maxLength={500} className={inputCls} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange((cur) => [...cur, { ...blank }])} disabled={slides.length >= 10} className={btnGhost}>+ Thêm banner</button>
    </div>
  );
}
