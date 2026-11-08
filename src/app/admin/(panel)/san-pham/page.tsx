import Image from "next/image";
import Link from "next/link";
import { deleteProductAction, toggleProductAction } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import { Pagination } from "@/components/admin/Pagination";
import { PageTitle, btnCls, btnGhost, inputCls, selectCls } from "@/components/admin/ui";
import { PRODUCT_SORTS, listProductsAdmin, type ProductFilter } from "@/lib/admin-repo";
import { priceLabel, productHref } from "@/lib/products";
import { getTaxonomy } from "@/lib/repo";
import { brandName } from "@/lib/taxonomy";

type Query = { q?: string; hang?: string; loai?: string; tt?: string; sx?: string; trang?: string };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams;
  const taxonomy = await getTaxonomy();
  const filter: ProductFilter = {
    q: (sp.q ?? "").trim().slice(0, 100),
    brand: taxonomy.brands.some((b) => b.id === sp.hang) ? String(sp.hang) : "",
    type: taxonomy.types.some((t) => t.id === sp.loai) ? String(sp.loai) : "",
    status: sp.tt === "hien" || sp.tt === "an" ? sp.tt : "",
    sort: PRODUCT_SORTS.find((x) => x.id === sp.sx)?.id ?? "ten",
  };
  const { rows, total, pages, page } = await listProductsAdmin(filter, Number(sp.trang) || 1);
  const params = { q: filter.q, hang: filter.brand, loai: filter.type, tt: filter.status, ...(filter.sort !== "ten" ? { sx: filter.sort } : {}) };
  const href = (p: number) => `/admin/san-pham?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), trang: String(p) })}`;
  const filtered = !!(filter.q || filter.brand || filter.type || filter.status || filter.sort !== "ten");
  return (
    <>
      <PageTitle action={<Link href="/admin/san-pham/moi" className={btnCls}>+ Thêm xe</Link>}>Sản phẩm ({total})</PageTitle>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex w-full gap-2 sm:w-auto">
          <input name="q" defaultValue={filter.q} placeholder="Tìm theo tên hoặc mã xe..." className={`${inputCls} min-w-0 flex-1 sm:w-64 sm:flex-none`} />
          <button className={btnGhost}>Tìm</button>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <AutoSubmitSelect name="hang" aria-label="Hãng" defaultValue={filter.brand} className={selectCls}>
            <option value="">Tất cả hãng</option>
            {taxonomy.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="loai" aria-label="Loại xe" defaultValue={filter.type} className={selectCls}>
            <option value="">Tất cả loại</option>
            {taxonomy.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="tt" aria-label="Trạng thái" defaultValue={filter.status} className={selectCls}>
            <option value="">Mọi trạng thái</option>
            <option value="hien">Đang hiện</option>
            <option value="an">Đang ẩn</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect name="sx" aria-label="Sắp xếp" defaultValue={filter.sort} className={selectCls}>
            {PRODUCT_SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </AutoSubmitSelect>
        </div>
        {filtered && <Link href="/admin/san-pham" className="text-xs text-neutral-500 hover:text-[#de0000] hover:underline">Xoá lọc</Link>}
      </form>
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr><th className="w-16 p-3"><span className="sr-only">Ảnh</span></th><th className="p-3">Mã</th><th className="p-3">Tên xe</th><th className="p-3">Hãng</th><th className="p-3">Giá</th><th className="p-3">Trạng thái</th><th className="hidden p-3 sm:table-cell">Cập nhật</th><th className="p-3" /></tr>
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
                <td className="p-3">
                  <Link href={`/admin/san-pham/${r.id}`} className="font-medium hover:text-[#de0000]">{r.name}</Link>
                  <span className="mt-1 block text-xs text-neutral-500 sm:hidden">Cập nhật {r.updated_vn}</span>
                </td>
                <td className="p-3 whitespace-nowrap">{r.brand ? brandName(taxonomy, r.brand) : "-"}</td>
                <td className="p-3 whitespace-nowrap">{priceLabel({ price: Number(r.price), priceMax: Number(r.price_max) })}</td>
                <td className="p-3">
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={r.active ? "text-green-700 hover:underline" : "text-neutral-400 hover:underline"}>{r.active ? "Đang hiện" : "Đang ẩn"}</button>
                  </form>
                </td>
                <td className="hidden p-3 whitespace-nowrap sm:table-cell">{r.updated_vn}</td>
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
            {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-neutral-500">Không có xe nào.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} href={href} />
    </>
  );
}
