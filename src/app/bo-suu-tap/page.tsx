import { Header } from "@/components/sites/xemayhoangkim/Header";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { CollectionCards, visibleCollections } from "@/components/sites/xemayhoangkim/CollectionCards";
import { getCollections, getProducts } from "@/lib/repo";
import { pageMetadata } from "@/lib/shop";

export const generateMetadata = () => pageMetadata("Bộ sưu tập", "Các nhóm xe được chọn sẵn.");

export default async function CollectionsPage() {
  const [collections, products] = await Promise.all([getCollections(), getProducts()]);
  const cards = visibleCollections(collections, products);
  return (
    <>
      <Header />
      <main className="bg-neutral-100 pb-12">
        <div className="mx-auto max-w-[1250px] px-4 py-8">
          <h1 className="mb-6 text-2xl font-semibold uppercase md:text-3xl">Bộ sưu tập</h1>
          {cards.length === 0 ? (
            <p className="bg-white p-6 text-sm text-neutral-600">Chưa có bộ sưu tập nào.</p>
          ) : (
            <CollectionCards cards={cards} />
          )}
        </div>
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
