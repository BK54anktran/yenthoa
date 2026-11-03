import { HomeSectionsForm } from "@/components/admin/HomeSectionsForm";
import { PageTitle } from "@/components/admin/ui";
import { resetHomeSectionsAction } from "@/app/admin/actions";
import { getAllSlides } from "@/lib/admin-repo";
import { getCollections, getHomeSections, getProducts, getTaxonomy } from "@/lib/repo";
import { activeOnly } from "@/lib/taxonomy";

export default async function HomeAdmin() {
  const [sections, products, taxonomy, slides, collections] = await Promise.all([getHomeSections(), getProducts(), getTaxonomy(), getAllSlides(), getCollections()]);
  return (
    <>
      <PageTitle
        action={
          <form action={resetHomeSectionsAction}>
            <button className="text-sm text-neutral-600 underline hover:text-[#de0000]">Khôi phục mặc định (banner đầu trang, mỗi hãng một mục, bộ sưu tập)</button>
          </form>
        }
      >
        Trang chủ
      </PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Trang chủ gồm các mục xếp từ trên xuống: banner đầu trang, các mục giới thiệu xe, banner ảnh xen giữa và danh sách bộ sưu tập. Thêm mục mới, đổi tên, đổi ảnh nền, đổi thứ tự, chọn xe muốn hiện, rồi bấm một nút Lưu ở cuối trang.
      </p>
      <HomeSectionsForm
        sections={sections}
        slides={slides}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        brands={activeOnly(taxonomy.brands)}
        products={products.map((p) => ({ slug: p.slug, name: p.name, brand: p.brand }))}
      />
    </>
  );
}
