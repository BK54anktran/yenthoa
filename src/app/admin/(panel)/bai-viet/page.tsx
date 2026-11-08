import Link from "next/link";
import { deletePostAction, togglePostAction } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Pagination } from "@/components/admin/Pagination";
import { PageTitle, btnCls, btnGhost, inputCls } from "@/components/admin/ui";
import { listPosts } from "@/lib/admin-repo";
import { formatDate, postHref } from "@/lib/posts";
import { getTaxonomy } from "@/lib/repo";
import { sectionName } from "@/lib/taxonomy";

export default async function PostsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; trang?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const taxonomy = await getTaxonomy();
  const { rows, total, pages, page } = await listPosts(q, Number(sp.trang) || 1);
  const href = (p: number) => `/admin/bai-viet?${new URLSearchParams({ ...(q ? { q } : {}), trang: String(p) })}`;
  return (
    <>
      <PageTitle action={<Link href="/admin/bai-viet/moi" className={btnCls}>+ Thêm bài</Link>}>Bài viết ({total})</PageTitle>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tìm theo tiêu đề..." className={`${inputCls} max-w-sm`} />
        <button className={btnGhost}>Tìm</button>
      </form>
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="p-3">ID</th><th className="p-3">Tiêu đề</th><th className="hidden p-3 sm:table-cell">Mục</th><th className="hidden p-3 sm:table-cell">Ngày</th><th className="p-3">Trạng thái</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="p-3 whitespace-nowrap font-mono text-xs text-neutral-600">{r.id}</td>
                <td className="p-3">
                  <Link href={`/admin/bai-viet/${r.id}`} className="font-medium hover:text-[#de0000]">{r.title}</Link>
                  <span className="mt-1 block text-xs text-neutral-500 sm:hidden">{sectionName(taxonomy, r.section)} · {formatDate(r.date)}</span>
                </td>
                <td className="hidden p-3 whitespace-nowrap sm:table-cell">{sectionName(taxonomy, r.section)}</td>
                <td className="hidden p-3 whitespace-nowrap sm:table-cell">{formatDate(r.date)}</td>
                <td className="p-3 whitespace-nowrap">
                  <form action={togglePostAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={r.published ? "text-green-700 hover:underline" : "text-neutral-400 hover:underline"}>{r.published ? "Đang hiện" : "Đang ẩn"}</button>
                  </form>
                </td>
                <td className="p-3 whitespace-nowrap text-right">
                  <Link href={postHref(r.slug)} target="_blank" className="mr-3 text-xs text-neutral-500 hover:underline">Xem</Link>
                  <Link href={`/admin/bai-viet/${r.id}`} className="mr-3 text-xs text-[#de0000] hover:underline">Sửa</Link>
                  <form action={deletePostAction} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message={`Xoá bài "${r.title}"? Không khôi phục được.`} className="text-xs text-neutral-500 hover:text-[#de0000] hover:underline">Xoá</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">Không có bài nào.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} href={href} />
    </>
  );
}
