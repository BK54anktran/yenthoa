"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// One horizontal row of photo thumbnails that scrolls sideways (swipe on phones, arrow buttons on desktop).
export function ThumbStrip({ images, active, onSelect }: { images: string[]; active: number; onSelect: (k: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true }); // is the strip scrolled fully to the left / right?

  const update = () => {
    const el = box.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [images.length]);

  // keep the selected photo in view: scrolls the strip only, never the page
  useEffect(() => {
    const el = box.current;
    const t = el?.children[active] as HTMLElement | undefined;
    if (!el || !t) return;
    el.scrollTo({ left: t.offsetLeft - (el.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const go = (dir: -1 | 1) => box.current?.scrollBy({ left: dir * box.current.clientWidth * 0.8, behavior: "smooth" });
  // same look as the home carousel: no background, a soft glow keeps the arrow readable over a photo
  const arrow = "absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center text-neutral-800 [filter:drop-shadow(0_0_2px_#fff)_drop-shadow(0_0_5px_#fff)] hover:text-[#de0000]";

  return (
    <div className="relative mt-3">
      {!edge.start && (
        <button type="button" aria-label="Xem ảnh trước" onClick={() => go(-1)} className={`${arrow} left-1`}>
          <ChevronLeft size={26} strokeWidth={2.5} />
        </button>
      )}
      <div
        ref={box}
        onScroll={update}
        role="tablist"
        aria-label="Ảnh xe"
        className="relative flex snap-x gap-3 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, k) => (
          <button
            key={src}
            type="button"
            role="tab"
            aria-selected={k === active}
            aria-label={`Ảnh ${k + 1}`}
            onClick={() => onSelect(k)}
            className={`relative h-16 w-24 shrink-0 snap-start overflow-hidden border-2 bg-white ${k === active ? "border-[#de0000]" : "border-neutral-200 opacity-70 hover:opacity-100"}`}
          >
            <Image src={src} alt="" fill sizes="96px" className="object-contain" />
          </button>
        ))}
      </div>
      {!edge.end && (
        <button type="button" aria-label="Xem ảnh tiếp" onClick={() => go(1)} className={`${arrow} right-1`}>
          <ChevronRight size={26} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
