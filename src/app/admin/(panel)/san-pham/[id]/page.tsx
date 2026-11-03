import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageTitle } from "@/components/admin/ui";
import { getProductById } from "@/lib/admin-repo";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await getProductById(id) : null;
  if (!product) notFound();
  return (
    <>
      <PageTitle>Sửa xe</PageTitle>
      <ProductForm product={product} />
    </>
  );
}
