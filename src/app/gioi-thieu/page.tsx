import { AboutView } from "@/components/sites/xemayhoangkim/AboutView";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { pageMetadata } from "@/lib/shop";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";

export const generateMetadata = () => pageMetadata("Về chúng tôi", "Giới thiệu cửa hàng.");

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <AboutView />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
