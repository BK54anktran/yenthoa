import { ContactView } from "@/components/sites/xemayhoangkim/ContactView";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { pageMetadata } from "@/lib/shop";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";

export const generateMetadata = () => pageMetadata("Liên hệ", "Liên hệ tư vấn và báo giá.");

export default function ContactPage() {
  return (
    <>
      <Header />
      <main>
        <ContactView />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
