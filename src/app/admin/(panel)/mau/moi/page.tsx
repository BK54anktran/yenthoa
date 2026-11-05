import Link from "next/link";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { PageTitle } from "@/components/admin/ui";

export default function NewTemplate() {
  return (
    <>
      <PageTitle>Tạo mẫu mới</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Viết HTML ở tab Giao diện, tạo các ô nhập ở tab Ô nhập. Hoặc dán thẳng JSON ở tab JSON. <Link href="/admin/mau" className="text-[#de0000] underline">Quay lại danh sách mẫu</Link>
      </p>
      <TemplateEditor initial={null} />
    </>
  );
}
