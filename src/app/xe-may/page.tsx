import { Header } from "@/components/sites/xemayhoangkim/Header";
import { pageMetadata } from "@/lib/shop";
import { ProductList } from "@/components/sites/xemayhoangkim/ProductList";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { activeOnly } from "@/lib/taxonomy";
import { getProducts, getTaxonomy } from "@/lib/repo";

export const generateMetadata = () => pageMetadata("Bảng giá xe máy", "Danh sách xe máy Honda, Yamaha, SYM, Suzuki và giá tham khảo.");

// /xe-may?nhom=honda,yamaha opens the list with those groups pre-selected
export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<{ nhom?: string | string[] }>;
}) {
  const { nhom } = await searchParams;
  const raw = Array.isArray(nhom) ? nhom.join(",") : (nhom ?? "");
  const known = new Set(activeOnly((await getTaxonomy()).brands).map((c) => c.id));
  const initialGroups = raw.split(",").filter((id) => known.has(id));
  const products = await getProducts();

  return (
    <>
      <Header />
      <main>
        <ProductList key={initialGroups.join(",")} initialGroups={initialGroups} products={products} />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
