import { Header } from "@/components/sites/xemayhoangkim/Header";
import { pageMetadata } from "@/lib/shop";
import { StoreList } from "@/components/sites/xemayhoangkim/StoreList";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";

export const generateMetadata = () => pageMetadata("Hệ thống cửa hàng", "Danh sách cửa hàng và giờ mở cửa.");

export default function StoresPage() {
  return (
    <>
      <Header />
      <main>
        <StoreList />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
