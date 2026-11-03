import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { telHref } from "./data";
import { formatDate, postHref } from "@/lib/posts";
import { getLatestPosts } from "@/lib/repo";
import { getShop } from "@/lib/shop";

// Right-hand column shared by the news list and the article page.
export async function NewsSidebar() {
  const { hotlines, facebook } = await getShop();
  const latest = await getLatestPosts(5);
  return (
    <aside className="space-y-6" aria-label="Thanh bên">
      <div className="bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase">Bài mới nhất</h2>
        <ul className="space-y-3 text-sm">
          {latest.map((a) => (
            <li key={a.slug} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
              <Link href={postHref(a.slug)} className="font-medium hover:text-[#de0000]">{a.title}</Link>
              <span className="mt-0.5 block text-xs text-neutral-400">{formatDate(a.date)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase">Liên hệ tư vấn</h2>
        <div className="space-y-2">
          {hotlines.map((n) => (
            <a key={n} href={telHref(n)} className="flex items-center justify-center gap-2 bg-[#de0000] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#b80000]">
              <Phone size={15} /> {n}
            </a>
          ))}
          <a href={facebook} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#0a7cff] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0866d4]">
            <MessageCircle size={15} /> Nhắn tin Facebook
          </a>
        </div>
      </div>
    </aside>
  );
}
