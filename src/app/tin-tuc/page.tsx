import { Header } from "@/components/sites/xemayhoangkim/Header";
import { pageMetadata } from "@/lib/shop";
import { NewsList } from "@/components/sites/xemayhoangkim/NewsList";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { getTaxonomy } from "@/lib/repo";

export const generateMetadata = () => pageMetadata("Tin tức", "Tin tức, giá xe và hướng dẫn về xe máy.");

// /tin-tuc?muc=thi-truong&trang=2
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ muc?: string | string[]; trang?: string | string[] }>;
}) {
  const sp = await searchParams;
  const muc = Array.isArray(sp.muc) ? sp.muc[0] : sp.muc;
  const trang = Number(Array.isArray(sp.trang) ? sp.trang[0] : sp.trang);
  const section = (await getTaxonomy()).sections.some((s) => s.id === muc) ? (muc as string) : null;

  return (
    <>
      <Header />
      <main>
        <NewsList section={section} page={Number.isFinite(trang) && trang > 0 ? Math.floor(trang) : 1} />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
