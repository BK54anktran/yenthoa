"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Phone, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { telHref, topLinks } from "./data";
import type { NavNode } from "@/lib/menu";
import { useNav } from "./nav-context";
import { useShop } from "./shop-context";

const itemCls = "block px-4 py-1.5 text-sm text-[#333] hover:bg-neutral-100";

// drop-down of any depth: every level opens its own list next to it
function SubMenu({ items, light, nested }: { items: NavNode[]; light?: boolean; nested?: boolean }) {
  const side = nested ? (light ? "right-full top-0" : "left-full top-0") : light ? "right-0 top-full" : "left-0 top-full";
  return (
    <ul className={`invisible absolute z-30 min-w-44 bg-white py-2 opacity-0 shadow-lg transition group-hover/sub:visible group-hover/sub:opacity-100 ${side}`}>
      {items.map((c, i) => (
        <li key={`${c.label}-${i}`} className="group/sub relative">
          {c.href ? (
            <Link href={c.href} className={`${itemCls} flex items-center justify-between gap-3`}>
              {c.label}
              {c.children.length > 0 && <ChevronRight size={12} />}
            </Link>
          ) : (
            <span className={`${itemCls} flex cursor-default items-center justify-between gap-3`}>
              {c.label}
              {c.children.length > 0 && <ChevronRight size={12} />}
            </span>
          )}
          {c.children.length > 0 && <SubMenu items={c.children} light={light} nested />}
        </li>
      ))}
    </ul>
  );
}

function NavItem({ item, light }: { item: NavNode; light?: boolean }) {
  const cls = "flex h-[42px] items-center gap-1 px-2 text-[15px] font-semibold capitalize text-white hover:text-[#ffd2d2] 2xl:px-3";
  return (
    <li className="group/sub relative">
      {item.href ? (
        <Link href={item.href} className={cls}>
          {item.label}
          {item.children.length > 0 && <ChevronDown size={12} />}
        </Link>
      ) : (
        <span className={`${cls} cursor-default`}>
          {item.label}
          {item.children.length > 0 && <ChevronDown size={12} />}
        </span>
      )}
      {item.children.length > 0 && <SubMenu items={item.children} light={light} />}
    </li>
  );
}

// phone menu: every level in one list, indented
function MobileItems({ items, depth = 0, onPick }: { items: NavNode[]; depth?: number; onPick: () => void }) {
  return (
    <>
      {items.map((i, k) => (
        <li key={`${i.label}-${k}`}>
          {i.href ? (
            <a href={i.href} className={`block py-3 text-sm text-white ${depth === 0 ? "font-semibold" : "text-white/80"}`} style={{ paddingLeft: depth * 16 }} onClick={onPick}>
              {depth > 0 && "– "}{i.label}
            </a>
          ) : (
            <span className="block py-3 text-sm font-semibold text-white/60" style={{ paddingLeft: depth * 16 }}>{depth > 0 && "– "}{i.label}</span>
          )}
          {i.children.length > 0 && <ul><MobileItems items={i.children} depth={depth + 1} onPick={onPick} /></ul>}
        </li>
      ))}
    </>
  );
}

export function Header() {
  const { brand: BRAND, hotlines: HOTLINES } = useShop();
  const { main: mainNav, secondary: secondaryNav } = useNav();
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className={`mx-auto flex max-w-[1250px] items-center gap-4 px-4 transition-all ${stuck ? "h-[64px]" : "h-[100px]"}`}>
        <button className="xl:hidden" aria-label="Mở menu" onClick={() => setOpen((v) => !v)}>
          {open ? <X /> : <Menu />}
        </button>
        <Link href="/" className="flex items-center gap-2" aria-label="Trang chủ">
          <Image
            src="/sites/xemayhoangkim/logo.jpg"
            alt=""
            width={1494}
            height={1064}
            priority
            className={`w-auto transition-all ${stuck ? "h-11" : "h-[76px]"}`}
          />
          <span className="max-w-[170px] text-sm font-bold leading-tight text-[#8a6a1f] md:max-w-none md:text-lg">{BRAND}</span>
        </Link>
        <span className="hidden text-sm font-bold md:block">
          <Phone size={13} className="mr-1 inline" />
          HOTLINE:{" "}
          {HOTLINES.map((n, k) => (
            <span key={n}>
              {k > 0 && " - "}
              <a href={telHref(n)} className="text-[#c40000] hover:underline">{n}</a>
            </span>
          ))}
        </span>
        <div className="ml-auto hidden w-[300px] flex-col gap-2 md:flex">
          <Form action="/tim-kiem" role="search" className="flex">
            <input
              name="q"
              type="search"
              aria-label="Tìm kiếm"
              placeholder="Tìm kiếm..."
              maxLength={120}
              autoComplete="off"
              className="h-8 flex-1 rounded-l border border-neutral-300 px-2 text-sm outline-none focus:border-[#de0000]"
            />
            <button className="grid h-8 w-8 place-items-center rounded-r bg-[#de0000] text-white" aria-label="Tìm">
              <Search size={14} />
            </button>
          </Form>
          {/* hidden once the header shrinks, otherwise the search box + links overflow the 64px bar */}
          <ul className={`flex-wrap gap-x-4 text-[13px] text-neutral-700 ${stuck ? "hidden" : "flex"}`}>
            {topLinks.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="hover:text-[#de0000]">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <nav className="hidden bg-[#2b2b2b] xl:block" aria-label="Menu chính">
        <div className="mx-auto flex max-w-[1250px] items-stretch px-4">
          <ul className="flex shrink-0 items-center rounded-r-[40px] bg-[#de0000] pr-8">
            {mainNav.map((i) => <NavItem key={i.label} item={i} />)}
          </ul>
          <ul className="ml-auto flex items-center">
            {secondaryNav.map((i) => <NavItem key={i.label} item={i} light />)}
          </ul>
        </div>
      </nav>

      {open && (
        <nav className="max-h-[calc(100vh-64px)] overflow-y-auto bg-[#2b2b2b] xl:hidden" aria-label="Menu di động">
          <Form action="/tim-kiem" role="search" className="flex border-b border-white/10 px-4 py-3 md:hidden" onSubmit={() => setOpen(false)}>
            <input
              name="q"
              type="search"
              aria-label="Tìm kiếm trên điện thoại"
              placeholder="Tìm xe, bài viết..."
              maxLength={120}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-l bg-white px-3 text-sm outline-none"
            />
            <button className="grid h-10 w-11 place-items-center rounded-r bg-[#de0000] text-white" aria-label="Tìm">
              <Search size={16} />
            </button>
          </Form>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3 text-sm font-bold text-white">
            <Phone size={14} className="mt-0.5" />
            {HOTLINES.map((n) => (
              <a key={n} href={telHref(n)} className="hover:underline">{n}</a>
            ))}
          </div>
          <ul className="divide-y divide-white/10 px-4 py-2">
            <MobileItems items={[...mainNav, ...secondaryNav]} onPick={() => setOpen(false)} />
          </ul>
        </nav>
      )}
    </header>
  );
}
