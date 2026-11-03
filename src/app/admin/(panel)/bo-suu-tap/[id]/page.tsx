import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCollectionAction } from "@/app/admin/collection-actions";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageTitle, btnGhost } from "@/components/admin/ui";
import { getCollections, getProducts, getTaxonomy } from "@/lib/repo";

export default async function CollectionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const [collections, products, taxonomy] = await Promise.all([getCollections(), getProducts(), getTaxonomy()]);
  const collection = collections.find((c) => c.id === id);
  if (!collection) notFound();
  return (
    <>
      <PageTitle action={<Link href="/admin/bo-suu-tap" className="text-sm text-neutral-600 hover:text-[#de0000]">← Tất cả bộ sưu tập</Link>}>{collection.name}</PageTitle>
      <div className="max-w-4xl space-y-6">
        <CollectionForm
          collection={collection}
          products={products.map((p) => ({ slug: p.slug, name: p.name, brand: p.brand }))}
          brands={taxonomy.brands}
          types={taxonomy.types}
        />
        <form action={deleteCollectionAction}>
          <input type="hidden" name="id" value={collection.id} />
          <ConfirmButton message={`Xoá bộ sưu tập "${collection.name}"? Các xe vẫn còn nguyên.`} className={btnGhost}>Xoá bộ sưu tập này</ConfirmButton>
        </form>
      </div>
    </>
  );
}
