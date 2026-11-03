import Link from "next/link";
import { reorderCollectionsAction } from "@/app/admin/collection-actions";
import { NewCollectionForm } from "@/components/admin/NewCollectionForm";
import { PageTitle, btnGhost } from "@/components/admin/ui";
import { productsOf } from "@/lib/collections";
import { getCollections, getProducts } from "@/lib/repo";

export default async function CollectionsAdmin() {
  const [collections, products] = await Promise.all([getCollections(), getProducts()]);
  return (
    <>
      <PageTitle>Bộ sưu tập</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Bộ sưu tập là một nhóm xe có tên và trang riêng (/bo-suu-tap/tên). Chọn tay từng xe, hoặc đặt luật để xe phù hợp tự vào (theo hãng, loại, khoảng giá). Dùng được ở trang chủ và menu.
      </p>
      <div className="max-w-4xl space-y-4">
        <NewCollectionForm />
        {collections.length === 0 ? (
          <p className="bg-white p-4 text-sm text-neutral-500">Chưa có bộ sưu tập nào.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 bg-white">
            {collections.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <Link href={`/admin/bo-suu-tap/${c.id}`} className="font-semibold hover:text-[#de0000]">{c.name}</Link>
                <span className="text-xs text-neutral-500">
                  {c.mode === "auto" ? "tự động" : "chọn tay"} · {productsOf(c, products).length} xe{c.active ? "" : " · đang ẩn"}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {[["up", "↑", i === 0], ["down", "↓", i === collections.length - 1]].map(([dir, label, off]) => (
                    <form key={String(dir)} action={reorderCollectionsAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="dir" value={String(dir)} />
                      <button disabled={!!off} aria-label={dir === "up" ? "Lên" : "Xuống"} className={btnGhost}>{label}</button>
                    </form>
                  ))}
                  <Link href={`/admin/bo-suu-tap/${c.id}`} className="ml-2 text-sm text-[#de0000] hover:underline">Sửa</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
