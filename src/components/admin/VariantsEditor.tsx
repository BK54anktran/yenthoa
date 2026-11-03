"use client";

import { useState } from "react";
import type { Variant } from "@/lib/products";
import { attributeNames, valueOf } from "@/lib/variants";
import { ImageInput } from "./ImageInput";
import { btnGhost, inputCls } from "./ui";

type Row = { values: string[]; img: string; price: number };

// Any attributes the shop wants (Phiên bản, Màu sắc, Dung tích...). One row per combination, with its own
// photo and price. Serialised into a hidden field on submit.
export function VariantsEditor({ name, defaultValue }: { name: string; defaultValue: Variant[] }) {
  const initialNames = defaultValue.length ? attributeNames(defaultValue) : ["Phiên bản", "Màu sắc"];
  const [names, setNames] = useState<string[]>(initialNames);
  const [rows, setRows] = useState<Row[]>(
    defaultValue.map((v) => ({ values: initialNames.map((n) => valueOf(v, n)), img: v.img ?? "", price: v.price })),
  );

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setValue = (i: number, k: number, v: string) => setRow(i, { values: rows[i].values.map((x, j) => (j === k ? v : x)) });
  const addAttribute = () => {
    setNames((n) => [...n, ""]);
    setRows((r) => r.map((x) => ({ ...x, values: [...x.values, ""] })));
  };
  const removeAttribute = (k: number) => {
    setNames((n) => n.filter((_, j) => j !== k));
    setRows((r) => r.map((x) => ({ ...x, values: x.values.filter((_, j) => j !== k) })));
  };

  const payload: Variant[] = rows.map((r) => ({
    attrs: names.flatMap((n, k) => (n.trim() && r.values[k]?.trim() ? [{ name: n.trim(), value: r.values[k].trim() }] : [])),
    img: r.img.trim() || null,
    price: r.price,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">Thuộc tính (tên các nhóm lựa chọn trên trang xe)</p>
        <div className="flex flex-wrap items-center gap-2">
          {names.map((n, k) => (
            <span key={k} className="flex items-center gap-1">
              <input aria-label={`Tên thuộc tính ${k + 1}`} placeholder="Tên thuộc tính" value={n} onChange={(e) => setNames((x) => x.map((y, j) => (j === k ? e.target.value : y)))} maxLength={60} className={`${inputCls} w-40`} />
              <button type="button" onClick={() => removeAttribute(k)} aria-label={`Xoá thuộc tính ${n || k + 1}`} className={btnGhost}>×</button>
            </span>
          ))}
          <button type="button" onClick={addAttribute} disabled={names.length >= 6} className={btnGhost}>+ Thêm thuộc tính</button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Thuộc tính có chữ &quot;màu&quot; trong tên được hiện thành ô ảnh tròn, các thuộc tính khác hiện thành nút chữ.</p>
      </div>

      {rows.map((r, i) => (
        <div key={i} className="space-y-3 border border-neutral-200 p-3">
          <div className="grid gap-3 md:grid-cols-3">
            {names.map((n, k) => (
              <input key={k} aria-label={n || `Thuộc tính ${k + 1}`} placeholder={n || `Thuộc tính ${k + 1}`} value={r.values[k] ?? ""} onChange={(e) => setValue(i, k, e.target.value)} maxLength={100} className={inputCls} />
            ))}
            <input aria-label="Giá" inputMode="numeric" placeholder="Giá (đồng)" value={r.price || ""} onChange={(e) => setRow(i, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={inputCls} />
          </div>
          <ImageInput value={r.img} onChange={(u) => setRow(i, { img: u })} placeholder="Ảnh của lựa chọn này" />
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className={btnGhost}>Xoá dòng này</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((x) => [...x, { values: names.map(() => ""), img: "", price: 0 }])} disabled={rows.length >= 60} className={btnGhost}>+ Thêm dòng</button>
      <input type="hidden" name={name} value={JSON.stringify(payload)} />
    </div>
  );
}
