"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/defaults";
import { useShop } from "./shop-context";

export type HeroCard = { title: string; img: string; href: string };

// the whole banner is the link: pages of this site navigate in place, any other link opens in a new tab
function HeroLink({ href, label, focusable }: { href: string; label: string; focusable: boolean }) {
  const cls = "absolute inset-0 z-10 cursor-[inherit]";
  if (/^\/(?!\/)/.test(href)) return <Link href={href} aria-label={label} tabIndex={focusable ? 0 : -1} className={cls} />;
  const external = /^https?:\/\//i.test(href);
  return <a href={href} aria-label={label} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} tabIndex={focusable ? 0 : -1} className={cls} />;
}

// the banner picture: "cover" fills the fixed frame (edges are cut), "natural" lets the frame take the picture's own height (nothing is cut)
function SlideImage({ src, first, natural, cls }: { src: string; first: boolean; natural: boolean; cls: string }) {
  // the other slides sit stacked at opacity 0, where the browser never lazy-loads them: fetch them quietly so the fade finds a picture
  const load = { priority: first, loading: first ? undefined : ("eager" as const), fetchPriority: first ? undefined : ("low" as const) };
  return natural ? (
    <Image src={src} alt="" width={0} height={0} sizes="100vw" draggable={false} {...load} className={`block h-auto w-full ${cls}`} />
  ) : (
    <Image src={src} alt="" fill sizes="100vw" draggable={false} {...load} className={`object-cover ${cls}`} />
  );
}

export function Hero({ slides: heroSlides, cards = [] }: { slides: HeroSlide[]; cards?: HeroCard[] }) {
  const { brand } = useShop();
  const [i, setI] = useState(0);
  const [dragging, setDragging] = useState(false);
  const n = heroSlides.length;
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  // runs by itself: 5 seconds per banner, counted again after every change (also after a drag) and held while a finger or the mouse is down
  useEffect(() => {
    if (dragging || n < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [dragging, n, i]);

  const endDrag = (x: number | null) => {
    const x0 = startX.current;
    startX.current = null;
    setDragging(false);
    if (x === null || x0 === null) return;
    const dx = x - x0;
    if (Math.abs(dx) > 10) moved.current = true; // the click that follows a drag must not follow the banner's link
    if (Math.abs(dx) > 50 && n > 1) setI((v) => (dx < 0 ? (v + 1) % n : (v + n - 1) % n));
  };

  if (n === 0) return null;

  return (
    <section
      className={`relative touch-pan-y select-none overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      aria-roledescription="carousel"
      aria-label="Banner"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        startX.current = e.clientX;
        moved.current = false;
        setDragging(true);
      }}
      onDragStart={(e) => e.preventDefault()} // a link under the pointer would start the browser's own drag and cancel ours
      onPointerUp={(e) => endDrag(e.clientX)}
      onPointerCancel={() => endDrag(null)}
      onPointerLeave={(e) => e.pointerType === "mouse" && startX.current !== null && endDrag(e.clientX)}
      onClickCapture={(e) => {
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      }}
    >
      <div className="grid">
        {heroSlides.map((s, k) => (
          <div
            key={k}
            className={`relative min-w-full overflow-hidden bg-neutral-900 text-white transition-opacity duration-[1600ms] [grid-area:1/1] motion-reduce:transition-none ${s.fit === "natural" ? "" : "h-[460px] md:h-[640px]"} ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={k !== i}
          >
            {s.imgMobile && <SlideImage src={s.imgMobile} first={k === 0} natural={s.fit === "natural"} cls="md:hidden" />}
            <SlideImage src={s.img} first={k === 0} natural={s.fit === "natural"} cls={s.imgMobile ? "hidden md:block" : ""} />
            {/* a flat neutral scrim keeps the text readable on any photo; the admin can switch it off per banner */}
            {s.dim !== false && <div className="absolute inset-0 bg-black/45" />}
            {k === 0 && !s.title && <h1 className="sr-only">{brand}</h1>}
            {(s.link ?? "/xe-may") !== "" && <HeroLink href={s.link ?? "/xe-may"} label={s.title || "Xem xe"} focusable={k === i} />}
            {(s.title || s.sub || s.eyebrow) && (
              <div className="absolute inset-0 flex items-center px-6 md:px-[10%]">
                <div className="hp-rise relative max-w-5xl">
                  {s.title && (k === 0 ? (
                    <h1 className="text-[clamp(40px,6vw,84px)] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] [word-spacing:0.06em]">{s.title}</h1>
                  ) : (
                    <h2 className="text-[clamp(40px,6vw,84px)] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] [word-spacing:0.06em]">{s.title}</h2>
                  ))}
                  {(s.eyebrow || s.sub) && <p className="mt-5 max-w-[52ch] text-lg md:text-xl">{[s.eyebrow, s.sub].filter(Boolean).join(" · ")}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center">
        <div className="flex gap-2">
          {heroSlides.map((s, k) => (
            <button
              key={k}
              aria-label={`Tới slide ${k + 1}`}
              onClick={() => setI(k)}
              className={`h-1.5 cursor-pointer transition-all duration-300 ${k === i ? "w-10 bg-white" : "w-6 bg-white/50 hover:bg-white"}`}
            />
          ))}
        </div>
      </div>
      {/* the two newest articles: next steps after the single action */}
      {cards.length > 0 && (
        <div className="absolute bottom-6 right-24 hidden gap-4 md:flex">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="group block w-[210px] transition-transform duration-300 hover:-translate-y-1">
              <span className="relative block aspect-[3/2] overflow-hidden bg-neutral-800">
                <Image src={c.img} alt="" fill sizes="210px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              </span>
              <span className="flex min-h-[60px] items-center justify-between gap-2 bg-white px-3 py-2 text-base font-semibold leading-tight text-black">
                <span className="line-clamp-2">{c.title}</span>
                <span aria-hidden className="text-[#de0000]">→</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
