"use client";

import { useState } from "react";
import type { SpecGroup } from "@/lib/products";
import { btnGhost, inputCls } from "./ui";

// Technical specifications: groups (Động cơ, Khung xe, Kích thước...) of label / value rows.
// Serialised into a hidden field on submit.
export function SpecsEditor({ name, defaultValue }: { name: string; defaultValue: SpecGroup[] }) {
  const [groups, setGroups] = useState<SpecGroup[]>(defaultValue);
  const setGroup = (i: number, patch: Partial<SpecGroup>) => setGroups((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setItem = (i: number, k: number, patch: Partial<SpecGroup["items"][number]>) =>
    setGroup(i, { items: groups[i].items.map((it, j) => (j === k ? { ...it, ...patch } : it)) });

  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <div key={i} className="space-y-3 border border-neutral-200 p-3">
          <div className="flex gap-2">
            <input aria-label={`Tên nhóm ${i + 1}`} placeholder="Tên nhóm (Động cơ, Khung xe...)" value={g.title} onChange={(e) => setGroup(i, { title: e.target.value })} maxLength={80} className={`${inputCls} font-semibold`} />
            <button type="button" onClick={() => setGroups((x) => x.filter((_, j) => j !== i))} className={`${btnGhost} shrink-0`}>Xoá nhóm</button>
          </div>
          {g.items.map((it, k) => (
            <div key={k} className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
              <input aria-label="Tên thông số" placeholder="Tên thông số" value={it.label} onChange={(e) => setItem(i, k, { label: e.target.value })} maxLength={150} className={inputCls} />
              <input aria-label="Giá trị" placeholder="Giá trị" value={it.value} onChange={(e) => setItem(i, k, { value: e.target.value })} maxLength={300} className={inputCls} />
              <button type="button" onClick={() => setGroup(i, { items: g.items.filter((_, j) => j !== k) })} aria-label="Xoá dòng" className={btnGhost}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setGroup(i, { items: [...g.items, { label: "", value: "" }] })} disabled={g.items.length >= 60} className={btnGhost}>+ Thêm dòng</button>
        </div>
      ))}
      <button type="button" onClick={() => setGroups((g) => [...g, { title: "", items: [{ label: "", value: "" }] }])} disabled={groups.length >= 12} className={btnGhost}>+ Thêm nhóm thông số</button>
      <input type="hidden" name={name} value={JSON.stringify(groups)} />
    </div>
  );
}
