"use client";

import { MAX_DEPTH, type MenuNode } from "@/lib/menu";
import { btnGhost, inputCls } from "./ui";

let counter = 0;
export const newNode = (): MenuNode => ({ id: `n-${Date.now().toString(36)}${++counter}`, label: "", href: "", active: true, source: "", children: [] });

const SOURCES = [
  { value: "", label: "Tự nhập mục con" },
  { value: "brands:xe-may", label: "Mục con: hãng trong menu Xe máy" },
  { value: "brands:xe-dien", label: "Mục con: hãng trong menu Xe điện" },
  { value: "brands:all", label: "Mục con: tất cả hãng" },
  { value: "sections:menu", label: "Mục con: mục tin tức hiện trên menu" },
  { value: "sections:all", label: "Mục con: tất cả mục tin tức" },
  { value: "collections:all", label: "Mục con: các bộ sưu tập xe" },
];

// A menu level and, inside every item, the next level (up to MAX_DEPTH levels).
export function MenuEditor({ nodes, onChange, depth = 1 }: { nodes: MenuNode[]; onChange: (n: MenuNode[]) => void; depth?: number }) {
  const set = (i: number, patch: Partial<MenuNode>) => onChange(nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= nodes.length) return;
    const c = [...nodes];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };

  return (
    <div className={depth > 1 ? "ml-4 border-l-2 border-neutral-200 pl-3" : ""}>
      <ul className="space-y-2">
        {nodes.map((n, i) => (
          <li key={n.id} className="border border-neutral-200 bg-white p-2">
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Tên mục menu" value={n.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={60} placeholder="Tên hiện trên menu" className={`${inputCls} min-w-36 flex-1`} />
              <input
                aria-label="Đường dẫn"
                value={n.href}
                onChange={(e) => set(i, { href: e.target.value })}
                maxLength={500}
                placeholder={n.source.startsWith("brands:") ? "Để trống = tự lọc theo các hãng bên trong" : "/xe-may, https://..., tel:..., để trống = chỉ là nhóm"}
                className={`${inputCls} min-w-48 flex-[2]`}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select aria-label="Nguồn mục con" value={n.source} onChange={(e) => set(i, { source: e.target.value, children: e.target.value ? [] : n.children })} className={`${inputCls} w-auto max-w-full`}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={n.active} onChange={(e) => set(i, { active: e.target.checked })} className="size-4 accent-[#de0000]" /> Đang hiện
              </label>
              <span className="ml-auto flex gap-1">
                {!n.source && depth < MAX_DEPTH && (
                  <button type="button" onClick={() => set(i, { children: [...n.children, newNode()] })} className={btnGhost}>+ Mục con</button>
                )}
                <button type="button" aria-label="Lên" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>↑</button>
                <button type="button" aria-label="Xuống" onClick={() => move(i, 1)} disabled={i === nodes.length - 1} className={btnGhost}>↓</button>
                <button type="button" aria-label="Xoá" onClick={() => onChange(nodes.filter((_, j) => j !== i))} className={btnGhost}>✕</button>
              </span>
            </div>
            {!n.source && n.children.length > 0 && (
              <div className="mt-2">
                <MenuEditor nodes={n.children} onChange={(c) => set(i, { children: c })} depth={depth + 1} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...nodes, newNode()])} className={`${btnGhost} mt-2`}>+ Thêm mục {depth > 1 ? `cấp ${depth}` : ""}</button>
    </div>
  );
}
