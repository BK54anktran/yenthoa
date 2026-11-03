"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SpecGroup } from "@/lib/products";

// Technical specifications: one collapsible group per heading (Động cơ, Khung xe, Kích thước, Bảo hành...).
export function SpecAccordion({ groups }: { groups: SpecGroup[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(i)) n.add(i);
      return n;
    });

  return (
    <div className="bg-neutral-100 p-5 md:p-8">
      <h2 className="mb-6 text-2xl font-semibold uppercase">Thông số kỹ thuật</h2>
      <ul>
        {groups.map((g, i) => {
          const on = open.has(i);
          return (
            <li key={g.title} className="border-b border-black">
              <h3>
                <button
                  type="button"
                  id={`spec-btn-${i}`}
                  aria-expanded={on}
                  aria-controls={`spec-panel-${i}`}
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between px-3 py-5 text-left text-sm font-semibold uppercase hover:text-[#de0000]"
                >
                  {g.title}
                  <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${on ? "rotate-180" : ""}`} />
                </button>
              </h3>
              <div id={`spec-panel-${i}`} role="region" aria-labelledby={`spec-btn-${i}`} hidden={!on} className="px-3 pb-5">
                <dl className="divide-y divide-neutral-200 bg-white text-sm">
                  {g.items.map((it) => (
                    <div key={it.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
                      <dt className="text-neutral-600">{it.label}</dt>
                      <dd className="font-medium text-neutral-900">{it.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
