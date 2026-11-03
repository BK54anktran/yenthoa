import Image from "next/image";
import Link from "next/link";
import { deleteProductAction, toggleProductAction } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageTitle, btnCls, btnGhost, inputCls } from "@/components/admin/ui";
import { listProductsAdmin } from "@/lib/admin-repo";
import { priceLabel, productHref } from "@/lib/products";
import { getTaxonomy } from "@/lib/repo";
import { brandName } from "@/lib/taxonomy";

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; trang?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const taxonomy = await getTaxonomy();
  const { rows, total, pages, page } = await listProductsAdmin(q, Number(sp.trang) || 1);
  const href = (p: number) => `/admin/san-pham?${new URLSearchParams({ ...(q ? { q } : {}), trang: String(p) })}`;
  return (
    <>
      <PageTitle action={<Link href="/admin/san-pham/moi" className={btnCls}>+ Thêm xe</Link>}>Sản phẩm ({total})</PageTitle>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tìm theo tên hoặc mã xe..." className={`${inputCls} max-w-sm`} />
        <button className={btnGhost}>Tìm</button>
      </form>
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="w-16 p-3"><span className="sr-only">Ảnh</span></th><th className="p-3">Mã</th><th className="p-3">Tên xe</th><th className="p-3">Hãng</th><th className="p-3">Giá</th><th className="p-3">Trạng thái</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="p-2">
                  <div className="relative h-10 w-14 overflow-hidden bg-neutral-100">
                    {r.img && <Image src={r.img} alt="" fill sizes="56px" className="object-contain" />}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap font-mono text-xs text-neutral-600">{r.code || "-"}</td>
                <td className="p-3"><Link href={`/admin/san-pham/${r.id}`} className="font-medium hover:text-[#de0000]">{r.name}</Link></td>
                <td className="p-3 whitespace-nowrap">{r.brand ? brandName(taxonomy, r.brand) : "-"}</td>
                <td className="p-3 whitespace-nowrap">{priceLabel({ price: Number(r.price), priceMax: Number(r.price_max) })}</td>
                <td className="p-3">
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={r.active ? "text-green-700 hover:underline" : "text-neutral-400 hover:underline"}>{r.active ? "Đang hiện" : "Đang ẩn"}</button>
                  </form>
                </td>
                <td className="p-3 whitespace-nowrap text-right">
                  <Link href={productHref(r.slug)} target="_blank" className="mr-3 text-xs text-neutral-500 hover:underline">Xem</Link>
                  <Link href={`/admin/san-pham/${r.id}`} className="mr-3 text-xs text-[#de0000] hover:underline">Sửa</Link>
                  <form action={deleteProductAction} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message={`Xoá xe "${r.name}"? Không khôi phục được.`} className="text-xs text-neutral-500 hover:text-[#de0000] hover:underline">Xoá</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">Không có xe nào.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Phân trang" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={href(page - 1)} className={btnGhost}>‹ Trước</Link>}
          <span>Trang {page}/{pages}</span>
          {page < pages && <Link href={href(page + 1)} className={btnGhost}>Sau ›</Link>}
        </nav>
      )}
    </>
  );
}
