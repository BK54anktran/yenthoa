import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Phone, MessageCircle } from "lucide-react";
import { telHref } from "./data";
import { getShop } from "@/lib/shop";

const values = [
  { h: "Tư vấn đúng nhu cầu", p: "Hỏi rõ bạn đi làm, đi học hay chạy dịch vụ để gợi ý mẫu xe và mức giá phù hợp, không ép mua." },
  { h: "Giá minh bạch", p: "Báo giá rõ ràng, nêu đủ các khoản trước khi bạn quyết định." },
  { h: "Đồng hành sau bán hàng", p: "Bảo dưỡng, thay phụ tùng và hỗ trợ giấy tờ ngay tại cửa hàng." },
];

const offers = ["Xe số, xe tay ga, xe điện", "Bảo dưỡng và sửa chữa", "Phụ tùng và phụ kiện chính hãng", "Hỗ trợ thủ tục giấy tờ"];

export async function AboutView() {
  const { brand: BRAND, hotlines: HOTLINES, facebook: FACEBOOK } = await getShop();
  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1000px] px-4">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">Về chúng tôi</span>
        </nav>

        <article className="bg-white p-5 md:p-10">
          <h1 className="text-2xl font-semibold uppercase md:text-3xl">Về {BRAND}</h1>
          <div className="relative mt-6 aspect-[16/9] overflow-hidden bg-neutral-200">
            <Image
              src="/sites/xemayhoangkim/img/dich-vu-2.jpg"
              alt={`Cửa hàng ${BRAND}`}
              fill
              priority
              sizes="(min-width: 1000px) 920px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-700">
            <p>
              {BRAND} là cửa hàng chuyên mua bán xe máy, từ xe số, xe tay ga đến xe điện, kèm dịch vụ bảo dưỡng và phụ tùng. Chúng tôi
              mong mỗi khách hàng chọn được chiếc xe vừa túi tiền, vừa hợp nhu cầu đi lại.
            </p>
            <p>
              Đội ngũ tư vấn luôn đặt sự rõ ràng lên hàng đầu: giới thiệu đúng xe, báo giá đủ khoản và hỗ trợ bạn đến khi nhận xe.
            </p>
          </div>

          <h2 className="mb-4 mt-10 text-xl font-semibold uppercase">Giá trị chúng tôi theo đuổi</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {values.map((v) => (
              <li key={v.h} className="border-t-4 border-[#de0000] bg-neutral-50 p-5">
                <h3 className="font-semibold">{v.h}</h3>
                <p className="mt-2 text-sm text-neutral-600">{v.p}</p>
              </li>
            ))}
          </ul>

          <h2 className="mb-4 mt-10 text-xl font-semibold uppercase">Tại cửa hàng</h2>
          <ul className="grid gap-2 pl-5 text-sm text-neutral-700 sm:grid-cols-2">
            {offers.map((t) => (
              <li key={t} className="list-disc">{t}</li>
            ))}
          </ul>

          <div className="mt-10 grid gap-3 border-t border-neutral-200 pt-6 sm:grid-cols-3">
            {HOTLINES.map((n) => (
              <a key={n} href={telHref(n)} className="flex items-center justify-center gap-2 bg-[#de0000] px-4 py-3 text-sm font-bold text-white hover:bg-[#b80000]">
                <Phone size={16} /> Gọi {n}
              </a>
            ))}
            <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#0a7cff] px-4 py-3 text-sm font-bold text-white hover:bg-[#0866d4]">
              <MessageCircle size={16} /> Nhắn tin Facebook
            </a>
          </div>
          <p className="mt-4 text-xs text-neutral-400">(Nội dung giới thiệu mang tính mẫu cho bản demo, sẽ thay bằng câu chuyện thật của cửa hàng.)</p>
        </article>
      </div>
    </div>
  );
}
