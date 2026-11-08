"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export type ShowcaseModel = { name: string; price: string; img: string; href: string };
export type ShowcaseCategory = { id: string; name: string; total: number; href: string | null; backdrop: { src: string; dark?: boolean } | null; backdropMobile?: string; models: ShowcaseModel[] };

const ITEM_W = 112; // w-28
const STEP = ITEM_W + 16; // item + gap (gap-4)
const AUTO_MS = 4500;
const mod = (a: number, n: number) => ((a % n) + n) % n;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const q = window.matchMedia(REDUCED);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

// Brand showcase: a big photo + info card for the selected model and a carousel of all models under it.
// The selected model is always in the middle of the carousel, the arrows and a click select another model,
// and it loops by itself (pauses on hover/focus/touch, when off screen and for reduced-motion users).
export function CategorySection({ cat }: { cat: ShowcaseCategory }) {
  const n = cat.models.length;
  // `pos` only ever counts up or down, so the carousel can keep sliding the same way around the loop
  const [pos, setPos] = useState(0);
  const sel = mod(pos, n);
  const m = cat.models[sel];
  const dark = !!cat.backdrop?.dark;

  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const dragX = useRef<number | null>(null);

  const go = (d: number) => setPos((p) => p + d);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // only animate sections that are on screen (the home page has one per brand)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible || reduced || n < 2) return;
    const t = setInterval(() => setPos((p) => p + 1), AUTO_MS);
    return () => clearInterval(t);
  }, [paused, visible, reduced, n]);

  // 3+ models: a ring with the selected one always in the middle.
  //  - more than fit in the row: slide endlessly, the ends are off screen
  //  - fewer: show each model once (the farthest ones fade out at the ends, so nothing pops in view)
  // 1-2 models: just a centred row
  const ring = width > 0 && n >= 3;
  const fills = n * STEP > width;
  const half = !ring ? 0 : fills ? Math.ceil(width / 2 / STEP) + 2 : Math.floor((n - 1) / 2);
  const margin = ring && !fills ? 1 : 0; // invisible spare slots so a model fades in/out instead of popping
  const virtual = ring ? Array.from({ length: (half + margin) * 2 + 1 }, (_, i) => pos - half - margin + i) : [];

  const thumb = (x: ShowcaseModel, k: number, selected: boolean, onPick: () => void, style?: React.CSSProperties) => (
    <button
      key={k}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={x.name}
      aria-hidden={style?.opacity === 0 || undefined}
      tabIndex={selected ? 0 : -1}
      onClick={onPick}
      style={style}
      className={`shrink-0 select-none border-b-2 pb-2 transition-opacity duration-500 text-center text-[13px] uppercase ${selected ? "border-[#de0000] font-bold text-[#de0000]" : "border-transparent text-neutral-700 hover:text-black"}`}
    >
      <span className="relative mx-auto mb-1 block h-16 w-24 overflow-hidden">
        <Image src={x.img} alt="" fill sizes="96px" draggable={false} className="object-contain" />
      </span>
      <span className="block truncate">{x.name}</span>
    </button>
  );

  return (
    <section
      id={cat.id}
      ref={root}
      className="scroll-mt-28 py-6 md:py-10"
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onFocusCapture={(e) => (e.target as HTMLElement).matches(":focus-visible") && setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* featured model: photo on the left, info card on the right. They sit side by side (stacked on phones)
          so the card never covers the bike. */}
      <Reveal>
      <div className="relative bg-white md:grid md:h-[620px] md:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] lg:block">
        {/* studio backdrop behind the bike (tablet and desktop only; phones keep the plain white block) */}
        {cat.backdrop && (
          <>
            <Image src={cat.backdrop.src} alt="" aria-hidden fill sizes="100vw" className="hidden object-cover md:block" />
            {/* the top and bottom edges melt into the white strips around the block (above the backdrop, below the bike and text) */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-12 bg-gradient-to-b from-white via-white/60 to-transparent md:block" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-12 bg-gradient-to-t from-white via-white/60 to-transparent md:block" />
          </>
        )}
        <div className="relative h-[260px] min-w-0 sm:h-[340px] md:h-auto lg:absolute lg:inset-0">
          {/* phones: its own backdrop behind the photo (the desktop one is hidden below md) */}
          {cat.backdropMobile && <Image src={cat.backdropMobile} alt="" aria-hidden fill sizes="100vw" className="object-cover md:hidden" />}
          {/* only the selected model and its two neighbours are mounted: a brand can have 20+ models and the rest would
              download big photos nobody sees. The neighbours are what fades out / in when the carousel moves. */}
          {cat.models.map((x, k) => ({ x, k })).filter(({ k }) => n <= 3 || [0, 1, n - 1].includes(mod(k - sel, n))).map(({ x, k }) => (
            <Image
              key={x.href}
              src={x.img}
              alt={x.name}
              fill
              sizes="(min-width: 1024px) 50vw, (min-width: 768px) 62vw, 100vw"
              // already a small WebP (kept to 1600px by the uploader): the original is served as it is, so a slow or stuck
              // resize request can never leave the big photo empty (the browser does not retry a failed image)
              unoptimized
              className={`object-contain p-4 transition-opacity duration-500 md:p-10 lg:px-[24%] lg:py-8 ${k === sel ? "opacity-100" : "opacity-0"}`}
            />
          ))}
        </div>
        {/* from md up: no panel background, the text sits at the bottom right (centred) beside the photo, never over it.
            lg and up: the photo spans the whole width so the bike is centred on the page, and its side padding (28%)
            keeps it clear of the text column (30%). Phones keep the stacked layout. */}
        <div className="relative flex min-w-0 flex-col justify-center bg-white px-6 py-6 md:items-center md:justify-end md:bg-transparent md:px-12 md:pb-16 md:text-center lg:absolute lg:inset-y-0 lg:right-0 lg:w-[30%] lg:bg-transparent">
          <h3 className={`text-[clamp(26px,2.6vw,38px)] font-bold uppercase leading-[1.05] tracking-[-0.01em] ${dark ? "md:text-white" : ""}`}>{m.name}</h3>
          <p className={`mt-3 text-lg font-medium ${dark ? "md:text-neutral-100" : "text-[#de0000]"}`}>{m.price}</p>
          <Link href={m.href} className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#de0000] md:w-fit px-7 py-4 text-sm font-bold uppercase text-white transition-transform duration-200 hover:bg-black active:scale-95">
            Xem chi tiết <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      </Reveal>

      {/* brand name + the carousel of its models. Phones: the name on its own line, the carousel under it. */}
      <Reveal delay={80}>
      <div className="mx-auto flex max-w-[1250px] flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:gap-8 md:py-10">
        <h2 className="shrink-0 text-[clamp(32px,3.6vw,50px)] font-extrabold uppercase leading-none tracking-[-0.02em] md:w-[7.8em]">
          {/* the count follows the last word of the name (inline), so a name that wraps onto two lines keeps it attached */}
          {cat.href ? (
            <Link href={cat.href} className="hover:text-[#de0000]" aria-label={`Xem tất cả xe ${cat.name}`}>
              {cat.name}
              <sup className="ml-2 text-base font-medium text-[#de0000]">{cat.total}</sup>
            </Link>
          ) : (
            <span>
              {cat.name}
              <sup className="ml-2 text-base font-medium text-[#de0000]">{cat.total}</sup>
            </span>
          )}
        </h2>

        <div className="relative w-full min-w-0 md:flex-1">
          <div
            ref={viewport}
            role="tablist"
            aria-label={cat.name}
            className={`relative h-[104px] touch-pan-y overflow-hidden md:[mask-image:linear-gradient(to_right,transparent,#000_72px,#000_calc(100%-72px),transparent)] ${ring ? "" : "flex justify-center gap-4"}`}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                go(e.key === "ArrowRight" ? 1 : -1);
              }
            }}
            onPointerDown={(e) => {
              dragX.current = e.clientX;
            }}
            onPointerUp={(e) => {
              const x0 = dragX.current;
              dragX.current = null;
              if (x0 !== null && Math.abs(e.clientX - x0) > 40) {
                go(e.clientX < x0 ? 1 : -1);
                // a swipe must not also count as a click on the thumbnail under the finger
                const el = viewport.current;
                const stop = (ev: Event) => ev.stopPropagation();
                el?.addEventListener("click", stop, true);
                setTimeout(() => el?.removeEventListener("click", stop, true), 60);
              }
            }}
            onPointerCancel={() => (dragX.current = null)}
          >
            {ring ? (
              <div
                className="absolute inset-y-0 left-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${width / 2 - (pos * STEP + ITEM_W / 2)}px)` }}
              >
                {virtual.map((p) =>
                  thumb(cat.models[mod(p, n)], p, p === pos, () => setPos(p), {
                    position: "absolute",
                    left: p * STEP,
                    width: ITEM_W,
                    opacity: Math.abs(p - pos) > half ? 0 : 1,
                    pointerEvents: Math.abs(p - pos) > half ? "none" : undefined,
                  }),
                )}
              </div>
            ) : (
              cat.models.map((x, k) => thumb(x, k, k === sel, () => setPos(k), { width: ITEM_W }))
            )}
          </div>

          {n > 1 && (
            <>
              <button type="button" aria-label="Xe trước" onClick={() => go(-1)} className="absolute top-4 z-10 grid size-9 place-items-center bg-white text-neutral-900 hover:text-[#de0000] left-0">
                <ChevronLeft size={26} strokeWidth={2.5} />
              </button>
              <button type="button" aria-label="Xe sau" onClick={() => go(1)} className="absolute top-4 z-10 grid size-9 place-items-center bg-white text-neutral-900 hover:text-[#de0000] right-0">
                <ChevronRight size={26} strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </div>
      </Reveal>
    </section>
  );
}
