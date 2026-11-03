"use client";

import { MAX_CARDS, type CornerCard, type HomeSection } from "@/lib/home-sections";
import { btnGhost, inputCls } from "./ui";
import { ImageInput } from "./ImageInput";

type Mode = NonNullable<HomeSection["cardsMode"]>;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "auto", label: "Tự động", hint: "hai bài viết mới nhất" },
  { id: "custom", label: "Tự tạo", hint: `tối đa ${MAX_CARDS} thẻ, bạn chọn ảnh, tiêu đề, đường dẫn` },
  { id: "off", label: "Ẩn", hint: "không hiện thẻ nào" },
];

// The small cards in the bottom-right corner of the banner (tablet and desktop only).
export function SlideCardsEditor({ mode, cards, onChange }: { mode: Mode; cards: CornerCard[]; onChange: (p: { cardsMode?: Mode; cards?: CornerCard[] }) => void }) {
  const set = (i: number, patch: Partial<CornerCard>) => onChange({ cards: cards.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    const c = [...cards];
    [c[i], c[j]] = [c[j], c[i]];
    onChange({ cards: c });
  };

  return (
    <div className="mt-6 border-t border-neutral-200 pt-4">
      <p className="text-sm font-semibold">Thẻ nhỏ ở góc phải dưới banner</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {MODES.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="cards-mode" checked={mode === m.id} onChange={() => onChange({ cardsMode: m.id })} className="size-4 accent-[#de0000]" />
            <span><b>{m.label}</b> <span className="text-neutral-500">({m.hint})</span></span>
          </label>
        ))}
      </div>
      {mode === "custom" && (
        <div className="mt-3 space-y-3">
          {cards.map((c, i) => (
            <div key={i} className="grid gap-3 border border-neutral-200 p-3 md:grid-cols-2">
              <input aria-label="Tiêu đề thẻ" placeholder="Tiêu đề thẻ (bắt buộc)" value={c.title} onChange={(e) => set(i, { title: e.target.value })} maxLength={80} className={inputCls} />
              <ImageInput value={c.img} onChange={(v) => set(i, { img: v })} />
              <div className="md:col-span-2">
                <input aria-label="Đường dẫn của thẻ" placeholder="Đường dẫn khi bấm thẻ, ví dụ /xe/ten-xe, /tin-tuc, https://..., tel:0789619698" value={c.link} onChange={(e) => set(i, { link: e.target.value })} maxLength={500} className={inputCls} />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>Trái</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === cards.length - 1} className={btnGhost}>Phải</button>
                <button type="button" onClick={() => onChange({ cards: cards.filter((_, j) => j !== i) })} className={btnGhost}>Xoá thẻ</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ cards: [...cards, { title: "", img: "", link: "" }] })} disabled={cards.length >= MAX_CARDS} className={btnGhost}>+ Thêm thẻ ({cards.length}/{MAX_CARDS})</button>
        </div>
      )}
    </div>
  );
}
