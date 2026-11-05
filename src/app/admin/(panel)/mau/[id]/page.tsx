import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { PageTitle } from "@/components/admin/ui";
import { getAllTemplates } from "@/lib/repo";

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = (await getAllTemplates()).find((t) => t.id === id);
  if (!tpl) notFound();
  return (
    <>
      <PageTitle>Mẫu: {tpl.name}</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Sửa mẫu thì mọi khối dùng mẫu này trên trang chủ đổi theo (các giá trị đã nhập được giữ). <Link href="/admin/mau" className="text-[#de0000] underline">Quay lại danh sách mẫu</Link>
      </p>
      <TemplateEditor key={tpl.id} initial={tpl} readOnly={!!tpl.builtIn} />
    </>
  );
}
