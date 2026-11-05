"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, ExternalLink, FileText, Home, Image as ImageIcon, LayoutDashboard, LayoutTemplate, LogOut, Menu, Package, Plug, Settings, Store, X } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: "", items: [{ href: "/admin", label: "Tổng quan", icon: LayoutDashboard }] },
  {
    title: "Nội dung",
    items: [
      { href: "/admin/bai-viet", label: "Bài viết", icon: FileText },
      { href: "/admin/san-pham", label: "Sản phẩm", icon: Package },
      { href: "/admin/bo-suu-tap", label: "Bộ sưu tập", icon: Boxes },
      { href: "/admin/hinh-anh", label: "Hình ảnh", icon: ImageIcon },
    ],
  },
  {
    title: "Giao diện",
    items: [
      { href: "/admin/trang-chu", label: "Trang chủ", icon: Home },
      { href: "/admin/mau", label: "Mẫu", icon: LayoutTemplate },
      { href: "/admin/danh-muc", label: "Danh mục", icon: Settings },
      { href: "/admin/cai-dat", label: "Thông tin cửa hàng", icon: Store },
    ],
  },
  { title: "Hệ thống", items: [{ href: "/admin/ket-noi", label: "Kết nối", icon: Plug }] },
];

// vertical admin menu: a sidebar from md up, a button that opens it on phones
export function AdminNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

  const list = (
    <nav aria-label="Menu quản trị" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => (
        <div key={g.title || "top"}>
          {g.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={on(href) ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${on(href) ? "bg-[#de0000] font-semibold text-white" : "text-neutral-200 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={16} className="shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-0.5 border-t border-white/10 px-3 py-3 text-sm">
      <Link href="/" target="_blank" className="flex items-center gap-3 px-3 py-2 text-neutral-200 hover:bg-white/10 hover:text-white">
        <ExternalLink size={16} /> Xem website
      </Link>
      <form action={logoutAction}>
        <button className="flex w-full items-center gap-3 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white">
          <LogOut size={16} /> Đăng xuất
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* phones: a top bar with a button, the menu opens under it */}
      <div className="sticky top-0 z-40 bg-[#2b2b2b] text-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold">Quản trị</span>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Đóng menu" : "Mở menu"} className="grid size-9 place-items-center hover:bg-white/10">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <div className="flex max-h-[80vh] flex-col border-t border-white/10">
            {list}
            {footer}
          </div>
        )}
      </div>

      {/* md and up: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#2b2b2b] text-white md:flex">
        <div className="border-b border-white/10 px-6 py-4 text-lg font-bold">Quản trị</div>
        {list}
        {footer}
      </aside>
    </>
  );
}
