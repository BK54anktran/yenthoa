import { TaxonomyForm } from "@/components/admin/TaxonomyForm";
import { PageTitle } from "@/components/admin/ui";
import { taxonomyUsage } from "@/lib/admin-repo";
import { getMenuConfig, getTaxonomy } from "@/lib/repo";

export default async function TaxonomyAdmin() {
  const [taxonomy, usage, menu] = await Promise.all([getTaxonomy(), taxonomyUsage(), getMenuConfig()]);
  return (
    <>
      <PageTitle>Danh mục và menu</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Hãng xe, loại xe, mục tin tức dùng để phân loại xe và bài viết. Menu đầu trang là cây nhiều cấp với đường dẫn tự do. Mục con của menu có thể lấy từ hãng xe, mục tin tức hoặc bộ sưu tập. Một nút Lưu ở cuối trang lưu tất cả.
      </p>
      <TaxonomyForm taxonomy={taxonomy} usage={usage} menu={menu} />
    </>
  );
}
