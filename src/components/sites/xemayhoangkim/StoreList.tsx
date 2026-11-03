import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { telHref } from "./data";
import { getShop } from "@/lib/shop";

export async function StoreList() {
  const { hotlines: HOTLINES, facebook: FACEBOOK, stores } = await getShop();
  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-neutral-800">Hệ thống cửa hàng</span>
        </nav>

        <h1 className="text-2xl font-semibold uppercase md:text-3xl">Hệ thống cửa hàng</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Ghé cửa hàng gần bạn để xem xe trực tiếp và được tư vấn. Bạn cũng có thể gọi hotline để hẹn giờ trước.
        </p>

        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {stores.map((s) => (
            <li key={s.name} className="flex flex-col bg-white">
              <div className="relative aspect-[16/9] overflow-hidden bg-neutral-200">
                <Image
                  src={s.img}
                  alt={`${s.name} - ${s.kind}`}
                  fill
                  sizes="(min-width: 768px) 600px, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-5 md:p-6">
                <h2 className="text-xl font-semibold uppercase">{s.name}</h2>
                <p className="text-xs uppercase tracking-wide text-neutral-500">{s.kind}</p>

                <ul className="mt-4 space-y-3 text-sm">
                  <li className="flex gap-3">
                    <MapPin size={18} className="mt-0.5 shrink-0 text-[#de0000]" />
                    <span>{s.address}</span>
                  </li>
                  <li className="flex gap-3">
                    <Clock size={18} className="mt-0.5 shrink-0 text-[#de0000]" />
                    <span>{s.hours}</span>
                  </li>
                  <li className="flex gap-3">
                    <Phone size={18} className="mt-0.5 shrink-0 text-[#de0000]" />
                    <span className="flex flex-wrap gap-x-3">
                      {HOTLINES.map((n) => (
                        <a key={n} href={telHref(n)} className="font-semibold hover:text-[#de0000] hover:underline">
                          {n}
                        </a>
                      ))}
                    </span>
                  </li>
                </ul>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <a href={telHref(HOTLINES[0])} className="flex items-center justify-center gap-2 bg-[#de0000] px-4 py-3 text-sm font-bold text-white hover:bg-[#b80000]">
                    <Phone size={16} /> Gọi cửa hàng
                  </a>
                  <a
                    href={FACEBOOK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#0a7cff] px-4 py-3 text-sm font-bold text-white hover:bg-[#0866d4]"
                  >
                    <MessageCircle size={16} /> Nhắn tin Facebook
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-neutral-400">
          (Địa chỉ, giờ mở cửa và ảnh mang tính mẫu cho bản demo; sẽ thêm bản đồ chỉ đường khi có địa chỉ thật.)
        </p>
      </div>
    </div>
  );
}
