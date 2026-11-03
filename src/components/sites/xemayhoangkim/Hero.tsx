"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroSlide } from "@/lib/defaults";

export type HeroCard = { title: string; img: string; href: string };

// the banner button: pages of this site navigate in place, any other link opens in a new tab
function HeroButton({ href, focusable }: { href: string; focusable: boolean }) {
  const cls = "mt-8 inline-block bg-[#de0000] px-8 py-4 text-sm font-bold uppercase transition-transform duration-200 hover:bg-white hover:text-[#de0000] active:scale-95";
  if (/^\/(?!\/)/.test(href)) return <Link href={href} tabIndex={focusable ? 0 : -1} className={cls}>Xem xe</Link>;
  const external = /^https?:\/\//i.test(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} tabIndex={focusable ? 0 : -1} className={cls}>
      Xem xe
    </a>
  );
}

export function Hero({ slides: heroSlides, cards = [] }: { slides: HeroSlide[]; cards?: HeroCard[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = heroSlides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 5000);
    return () => clearInterval(t);
  }, [paused, n]);

  if (n === 0) return null;

  return (
    <section
      className="relative overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid">
        {heroSlides.map((s, k) => (
          <div
            key={s.title}
            className={`relative flex h-[460px] min-w-full bg-neutral-900 items-center overflow-hidden px-6 text-white transition-opacity duration-[1600ms] [grid-area:1/1] motion-reduce:transition-none md:h-[640px] md:px-[10%] ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={k !== i}
          >
            <Image
              src={s.img}
              alt=""
              fill
              priority={k === 0}
              // the other slides sit stacked at opacity 0, where the browser never lazy-loads them: fetch them quietly so the fade finds a picture
              loading={k === 0 ? undefined : "eager"}
              fetchPriority={k === 0 ? undefined : "low"}
              sizes="100vw"
              className="object-cover"
            />
            {/* a flat neutral scrim keeps the text readable on any photo */}
            <div className="absolute inset-0 bg-black/45" />
            <div className="hp-rise relative max-w-5xl">
              {k === 0 ? (
                <h1 className="text-[clamp(40px,6vw,84px)] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] [word-spacing:0.06em]">{s.title}</h1>
              ) : (
                <h2 className="text-[clamp(40px,6vw,84px)] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] [word-spacing:0.06em]">{s.title}</h2>
              )}
              <p className="mt-5 max-w-[52ch] text-lg md:text-xl">{[s.eyebrow, s.sub].filter(Boolean).join(" · ")}</p>
              {(s.link ?? "/xe-may") !== "" && <HeroButton href={s.link ?? "/xe-may"} focusable={k === i} />}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 left-6 flex items-center gap-4 md:left-[10%]">
        <button
          className="grid size-12 place-items-center bg-white text-black transition-colors hover:bg-[#de0000] hover:text-white"
          aria-label="Slide trước"
          onClick={() => setI((i + n - 1) % n)}
        >
          <ChevronLeft />
        </button>
        <button
          className="grid size-12 place-items-center bg-white text-black transition-colors hover:bg-[#de0000] hover:text-white"
          aria-label="Slide sau"
          onClick={() => setI((i + 1) % n)}
        >
          <ChevronRight />
        </button>
        <div className="flex gap-2">
          {heroSlides.map((s, k) => (
            <button
              key={s.title}
              aria-label={`Tới slide ${k + 1}`}
              onClick={() => setI(k)}
              className={`h-1.5 transition-all duration-300 ${k === i ? "w-10 bg-white" : "w-6 bg-white/50 hover:bg-white"}`}
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
