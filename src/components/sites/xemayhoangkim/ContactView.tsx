import Link from "next/link";
import { ChevronRight, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { telHref } from "./data";
import { getShop } from "@/lib/shop";

export async function ContactView() {
  const { brand: BRAND, hotlines: HOTLINES, facebook: FACEBOOK, stores } = await getShop();
  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">Liên hệ</span>
        </nav>

        <h1 className="text-2xl font-semibold uppercase md:text-3xl">Liên hệ</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {BRAND} luôn sẵn sàng tư vấn chọn xe, báo giá và đặt lịch bảo dưỡng. Chọn cách liên hệ thuận tiện nhất với bạn.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <section className="bg-white p-6">
            <Phone className="text-[#de0000]" size={28} />
            <h2 className="mt-3 text-lg font-semibold uppercase">Gọi hotline</h2>
            <p className="mt-1 text-sm text-neutral-600">Tư vấn và báo giá nhanh nhất.</p>
            <div className="mt-4 space-y-2">
              {HOTLINES.map((n) => (
                <a key={n} href={telHref(n)} className="block bg-[#de0000] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#b80000]">
                  {n}
                </a>
              ))}
            </div>
          </section>

          <section className="bg-white p-6">
            <MessageCircle className="text-[#0a7cff]" size={28} />
            <h2 className="mt-3 text-lg font-semibold uppercase">Nhắn tin Facebook</h2>
            <p className="mt-1 text-sm text-neutral-600">Gửi câu hỏi hoặc hình xe bạn quan tâm, cửa hàng sẽ phản hồi.</p>
            <a
              href={FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block bg-[#0a7cff] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#0866d4]"
            >
              Mở Facebook cửa hàng
            </a>
          </section>

          <section className="bg-white p-6">
            <Clock className="text-[#de0000]" size={28} />
            <h2 className="mt-3 text-lg font-semibold uppercase">Giờ làm việc</h2>
            <p className="mt-1 text-sm text-neutral-600">Mở cửa cả tuần, kể cả cuối tuần.</p>
            <p className="mt-4 text-sm font-semibold">{stores[0]?.hours}</p>
          </section>
        </div>

        <h2 className="mb-4 mt-10 text-xl font-semibold uppercase">Địa chỉ cửa hàng</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {stores.map((s) => (
            <li key={s.name} className="flex gap-3 bg-white p-5 text-sm">
              <MapPin size={20} className="mt-0.5 shrink-0 text-[#de0000]" />
              <div>
                <p className="font-semibold uppercase">{s.name}</p>
                <p className="mt-1 text-neutral-600">{s.address}</p>
                <p className="text-neutral-600">{s.hours}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/he-thong-cua-hang" className="font-semibold text-[#de0000] hover:underline">
            Xem chi tiết hệ thống cửa hàng
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-neutral-400">
          (Địa chỉ và giờ làm việc mang tính mẫu cho bản demo. Biểu mẫu gửi yêu cầu trực tuyến sẽ có ở gói nâng cao.)
        </p>
      </div>
    </div>
  );
}
