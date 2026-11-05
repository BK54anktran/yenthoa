import Image from "next/image";
import Link from "next/link";
import { Share2, Phone, MessageCircle } from "lucide-react";
import { telHref, footerMenu, services } from "./data";
import { postHref } from "@/lib/posts";
import { getTaxonomy } from "@/lib/repo";
import { activeOnly, sectionName } from "@/lib/taxonomy";
import { getLatestPosts } from "@/lib/repo";
import { getShop } from "@/lib/shop";
import { Reveal } from "./Reveal";

// figures on a flat dark field right under the banner: counted from the shop's own data or typed in the admin
export function Facts({ items, call, hotline }: { items: { value: string; label: string }[]; call: string; hotline: string }) {
  if (items.length === 0 && !hotline) return null;
  return (
    <section aria-label="Yên Thoa trong vài con số" className="bg-[#2b2b2b] text-white">
      <div
        className="mx-auto grid max-w-[1250px] gap-x-4 gap-y-8 px-4 py-12 [grid-template-columns:var(--m)] md:gap-x-8 md:py-20 lg:[grid-template-columns:var(--cols)]"
        style={{ "--m": `repeat(${Math.min(Math.max(items.length, 1), 3)}, minmax(0, 1fr))`, "--cols": `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr)) 1.4fr` } as React.CSSProperties}
      >
        {items.map((x, k) => (
          <Reveal key={`${x.label}-${k}`} delay={k * 90}>
            <p className="text-[clamp(44px,8vw,112px)] font-extrabold leading-[0.9] tracking-[-0.03em] tabular-nums">{x.value}</p>
            <p className="mt-3 text-base text-neutral-200 md:text-lg">{x.label}</p>
          </Reveal>
        ))}
        {hotline && (
          <Reveal delay={items.length * 90} className="col-span-full lg:col-span-1">
            {call && <p className="text-lg text-neutral-200">{call}</p>}
            <a href={telHref(hotline)} className="mt-3 inline-block bg-[#de0000] px-7 py-4 text-xl font-bold transition-transform duration-200 hover:bg-white hover:text-[#de0000] active:scale-95">{hotline}</a>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export function Services() {
  return (
    <section id="phu-tung" className="mx-auto scroll-mt-28 max-w-[1250px] px-4 py-20 md:py-28">
      <Reveal><h2 className="mb-10 text-[clamp(36px,5vw,72px)] font-extrabold uppercase leading-none tracking-[-0.02em]">Phụ tùng và dịch vụ</h2></Reveal>
      <div id="dich-vu" className="grid scroll-mt-28 gap-5 md:grid-cols-2">
        {services.map((s, k) => (
          <Reveal key={s.name} delay={k * 90}>
          <Link href="/tin-tuc" className="group block">
            <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
              <Image
                src={s.img}
                alt={s.name}
                fill
                sizes="(min-width: 1250px) 615px, (min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <p className="mt-4 flex items-center justify-between text-xl font-bold uppercase">{s.name}<span aria-hidden className="text-[#de0000] transition-transform duration-300 group-hover:translate-x-1">→</span></p>
          </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export async function News() {
  const latest = await getLatestPosts(3, true);
  const taxonomy = await getTaxonomy();
  return (
    <section id="tin-tuc" className="mx-auto scroll-mt-28 max-w-[1250px] px-4 pb-20 md:pb-28">
      <Reveal><h2 className="mb-10 text-[clamp(36px,5vw,72px)] font-extrabold uppercase leading-none tracking-[-0.02em]">Tin tức</h2></Reveal>
      <div className="grid gap-5 md:grid-cols-3">
        {latest.map((n, k) => (
          <Reveal key={n.slug} delay={k * 90}>
          <Link href={postHref(n.slug)} className="group block">
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
              <Image
                src={n.img!}
                alt={n.title}
                fill
                sizes="(min-width: 1250px) 400px, (min-width: 768px) 33vw, 100vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#de0000]">{sectionName(taxonomy, n.section)}</p>
            <h3 className="mt-1 text-lg font-bold leading-snug group-hover:text-[#de0000]">{n.title}</h3>
          </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-10">
        <Link href="/tin-tuc" className="inline-block bg-black px-8 py-4 text-sm font-bold uppercase text-white transition-transform duration-200 hover:bg-[#de0000] active:scale-95">
          Xem tất cả tin
        </Link>
      </div>
    </section>
  );
}

// the shop on a full-width photograph with one solid card: addresses, hotlines and one action
export async function Visit() {
  const { hotlines, branches } = await getShop();
  return (
    <section id="den-cua-hang" className="relative scroll-mt-28 md:h-[640px]">
      <div className="relative h-[320px] md:absolute md:inset-0 md:h-auto">
        <Image src="/sites/xemayhoangkim/img/dich-vu-2.jpg" alt="Xe máy trong một showroom" fill sizes="100vw" className="object-cover" />
      </div>
      <div className="relative -mt-20 px-4 pb-12 md:absolute md:right-[max(1rem,calc((100vw-1250px)/2+1rem))] md:top-14 md:mt-0 md:w-[400px] md:p-0">
        <Reveal className="bg-white p-8">
          <h2 className="text-3xl font-extrabold uppercase leading-none tracking-[-0.01em]">Đến cửa hàng</h2>
          <ul className="mt-5 space-y-3 text-base leading-snug">{branches.map((b) => <li key={b}>{b}</li>)}</ul>
          <p className="mt-5 text-base font-semibold tabular-nums">{hotlines.join(" · ")}</p>
          <a href={telHref(hotlines[0])} className="mt-6 flex h-14 items-center justify-center bg-[#de0000] text-base font-bold uppercase text-white transition-colors hover:bg-black">Gọi {hotlines[0]}</a>
        </Reveal>
      </div>
    </section>
  );
}

export async function Footer() {
  const { brand: BRAND, hotlines: HOTLINES, facebook: FACEBOOK, branches } = await getShop();
  const footerBrands = activeOnly((await getTaxonomy()).brands).filter((b) => b.menu === "xe-may");
  return (
    <footer id="cua-hang" className="scroll-mt-28 overflow-hidden bg-black text-sm text-white">
      <div className="mx-auto grid max-w-[1250px] gap-8 px-4 py-14 md:grid-cols-[1fr_1.2fr_1.3fr]">
        <Reveal>
          <p>Liên hệ để được tư vấn và nhận ngay ưu đãi!</p>
          {HOTLINES.map((n) => (
            <p key={n} className="mt-3 font-semibold">
              <span className="text-red-500">*</span> <a href={telHref(n)} className="hover:underline">{n}</a>
            </p>
          ))}
          <div className="mt-5 bg-neutral-900 p-5">
            <Image
              src="/sites/yenthoa/logo.png"
              alt={BRAND}
              width={1600}
              height={984}
              className="mb-3 h-14 w-auto"
            />
            <p className="font-bold uppercase">{BRAND}</p>
            <div className="mt-3 flex gap-3" aria-label="Mạng xã hội">
              <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-red-400">
                <Share2 size={16} /> Facebook
              </a>
            </div>
          </div>
        </Reveal>
        <Reveal delay={90} className="grid grid-cols-2 gap-x-6 gap-y-3 uppercase">
          <ul className="space-y-3">{footerMenu.map((l) => <li key={l.label}><Link href={l.href} className="hover:text-red-400">{l.label}</Link></li>)}</ul>
          <ul className="space-y-3">{footerBrands.map((l) => <li key={l.id}><Link href={`/xe-may?nhom=${l.id}`} className="hover:text-red-400">{l.name}</Link></li>)}</ul>
        </Reveal>
        <Reveal delay={180}>
          <h3 className="mb-3 font-bold uppercase">Hệ thống cửa hàng</h3>
          <ul className="space-y-3 leading-relaxed">{branches.map((b) => <li key={b}>{b}</li>)}</ul>
        </Reveal>
      </div>
      <div className="mx-auto max-w-[1250px] px-4 pb-2 pt-6">
        {/* the size was tuned for a 9-letter name (15.6vw, 213px max): scale it with the length of the shop name so it always fits */}
        <p aria-hidden className="select-none whitespace-nowrap font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-[#de0000]" style={{ fontSize: `min(${(140.4 / BRAND.length).toFixed(2)}vw, ${Math.round(1917 / BRAND.length)}px)` }}>{BRAND}</p>
      </div>
      <p className="mx-auto max-w-[1250px] px-4 py-5 text-[13px] uppercase text-neutral-300">© 2026 {BRAND}</p>
    </footer>
  );
}

export async function FloatingButtons() {
  const { hotlines: HOTLINES, facebook: FACEBOOK } = await getShop();
  const base = "grid size-12 place-items-center rounded-full text-white shadow-lg";
  return (
    <div className="fixed bottom-24 right-3 z-40 flex flex-col gap-3">
      <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" aria-label="Nhắn tin qua Facebook" className={`${base} bg-[#0a7cff]`}><MessageCircle size={22} /></a>
      <a href={telHref(HOTLINES[0])} aria-label="Gọi hotline" className={`${base} bg-[#16a34a]`}><Phone size={22} /></a>
    </div>
  );
}
