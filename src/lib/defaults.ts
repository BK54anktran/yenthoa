// Defaults used to seed the database and as a fallback when the database is unreachable.
// Keep this file free of path aliases: scripts/db-seed.mjs imports it directly with Node.

export type Store = { name: string; kind: string; address: string; hours: string; img: string };
export type Shop = {
  brand: string;
  hotlines: string[];
  facebook: string;
  branches: string[];
  stores: Store[];
};
// link: where the banner button goes. null = never set (the site falls back to /xe-may), "" = no button.
export type HeroSlide = { eyebrow: string; title: string; sub: string; img: string; link?: string | null };

const IMG = "/sites/xemayhoangkim/img";

export const DEFAULT_SHOP: Shop = {
  brand: "Yên Thoa",
  hotlines: ["0789.619.698", "0971.839.730"],
  facebook: "https://www.facebook.com/share/1FPL6o3iSz/?mibextid=wwXIfr",
  branches: [
    "Trụ sở chính: 00 Đường Mẫu, Phường 1, Quận 1, TP. Hồ Chí Minh",
    "Chi nhánh 2: 00 Đường Mẫu, Phường 2, TP. Hồ Chí Minh",
    "Chi nhánh 3: 00 Đường Mẫu, Phường 3, TP. Hồ Chí Minh",
  ],
  stores: [
    { name: "Trụ sở chính", kind: "Showroom và xưởng dịch vụ", address: "00 Đường Mẫu, Phường 1, Quận 1, TP. Hồ Chí Minh", hours: "7:30 - 19:00, thứ Hai đến Chủ nhật", img: `${IMG}/dich-vu-2.jpg` },
    { name: "Chi nhánh 2", kind: "Showroom", address: "00 Đường Mẫu, Phường 2, TP. Hồ Chí Minh", hours: "8:00 - 18:30, thứ Hai đến Chủ nhật", img: `${IMG}/tin-1.jpg` },
  ],
};

export const DEFAULT_SLIDES: HeroSlide[] = [
  { eyebrow: "Chương trình tháng này", title: "Rước xe về ngay", sub: "Trả trước linh hoạt, thủ tục gọn", img: `${IMG}/hero-1.jpg`, link: "/xe-may" },
  { eyebrow: "Xe số tiết kiệm", title: "Bền bỉ mỗi ngày", sub: "Nhiều màu, giao xe trong ngày", img: `${IMG}/hero-2.jpg`, link: "/xe-may" },
  { eyebrow: "Khám phá cùng xe mới", title: "Đi xa thoải mái", sub: "Xe êm, tiết kiệm nhiên liệu", img: `${IMG}/hero-3.jpg`, link: "/xe-may" },
];

export const BRANDS = [
  { id: "honda", name: "Honda" },
  { id: "yamaha", name: "Yamaha" },
  { id: "sym", name: "SYM" },
  { id: "suzuki", name: "Suzuki" },
  { id: "yadea", name: "Yadea" },
  { id: "xe-50cc", name: "Xe 50cc" },
  { id: "xe-may-nhap-khau", name: "Xe nhập khẩu" },
  { id: "xe-dien-yamaha", name: "Xe điện" },
];

export const PRODUCT_TYPES = [
  { id: "xe-so", name: "Xe số" },
  { id: "xe-tay-ga", name: "Xe tay ga" },
  { id: "xe-tay-con", name: "Xe tay côn" },
  { id: "xe-the-thao", name: "Xe thể thao" },
  { id: "xe-may-dien", name: "Xe máy điện" },
  { id: "xe-dap-dien", name: "Xe đạp điện" },
];

export const NEWS_SECTIONS = [
  { slug: "thi-truong", name: "Tin thị trường" },
  { slug: "xe-may", name: "Tin xe máy" },
  { slug: "khuyen-mai", name: "Tin khuyến mãi" },
  { slug: "dich-vu", name: "Dịch vụ" },
  { slug: "tin-tuc", name: "Tin tức" },
];

// Studio backdrop behind the big photo of each brand's showcase on the home page (desktop), as on the source site.
// `dark` backdrops get white text. Brands that are not listed keep the plain white background.
export const BRAND_BACKDROPS: Record<string, { src: string; dark?: boolean }> = {
  honda: { src: "/sites/hungphat/bg/concrete.webp" },
  yamaha: { src: "/sites/hungphat/bg/arches.webp" },
  sym: { src: "/sites/hungphat/bg/wireframe.webp" },
  suzuki: { src: "/sites/hungphat/bg/dark.webp", dark: true },
  "xe-may-nhap-khau": { src: "/sites/hungphat/bg/concrete.webp" },
  "xe-50cc": { src: "/sites/hungphat/bg/concrete.webp" },
  yadea: { src: "/sites/hungphat/bg/arches.webp" },
  "xe-dien-yamaha": { src: "/sites/hungphat/bg/arches.webp" },
};
