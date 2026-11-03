"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const COLLAPSED = 220;

// A long description that starts folded and opens with "Xem thêm" (only when it is taller than the folded box).
export function ExpandableHtml({ html }: { html: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [full, setFull] = useState(COLLAPSED);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => {
      setCanExpand(el.scrollHeight > COLLAPSED + 4);
      setFull(el.scrollHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);

  return (
    <div>
      <div ref={box} className="relative overflow-hidden transition-[max-height] duration-500" style={{ maxHeight: open || !canExpand ? full : COLLAPSED }}>
        <div className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
        {canExpand && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />}
      </div>
      {canExpand && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mx-auto mt-3 flex items-center gap-1 text-sm font-semibold text-[#de0000] hover:underline">
          {open ? "Thu gọn" : "Xem thêm"} <ChevronDown size={16} className={open ? "rotate-180" : ""} />
        </button>
      )}
    </div>
  );
}
