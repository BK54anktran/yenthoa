import Link from "next/link";
import { PromptButton, TemplateRowActions } from "@/components/admin/TemplateRowActions";
import { PageTitle, btnCls } from "@/components/admin/ui";
import { getAllTemplates, getHomeSections } from "@/lib/repo";

export default async function TemplatesAdmin() {
  const [templates, sections] = await Promise.all([getAllTemplates(), getHomeSections()]);
  const uses = (id: string) => sections.filter((s) => s.kind === "template" && s.templateId === id).length;
  return (
    <>
      <PageTitle>Mẫu</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Mẫu là một đoạn HTML có các chỗ trống cho phép sửa (chữ, ảnh, link, ngày giờ, danh sách...). Ở trang chủ chọn <b>+ Thêm từ mẫu</b>, điền các ô rồi lưu. Sửa mẫu thì mọi nơi dùng mẫu đổi theo. Tạo mẫu bằng HTML hoặc dán JSON; nút <b>Tải prompt</b> cho file hướng dẫn để nhờ AI chuyển HTML có sẵn thành mẫu.
      </p>
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/mau/moi" className={btnCls}>+ Tạo mẫu mới</Link>
          <PromptButton />
        </div>
        <ul className="divide-y divide-neutral-100 bg-white">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/mau/${t.id}`} className="font-semibold hover:text-[#de0000]">{t.name}</Link>
                <p className="text-xs text-neutral-500">
                  {t.builtIn ? "có sẵn" : "do bạn tạo"} · {t.fields.length} ô nhập · {uses(t.id) ? `đang dùng ${uses(t.id)} nơi` : "chưa dùng"}
                </p>
                {t.description && <p className="mt-1 text-sm text-neutral-600">{t.description}</p>}
              </div>
              <Link href={`/admin/mau/${t.id}`} className="text-sm text-[#de0000] hover:underline">{t.builtIn ? "Xem" : "Sửa"}</Link>
              <TemplateRowActions id={t.id} builtIn={!!t.builtIn} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
