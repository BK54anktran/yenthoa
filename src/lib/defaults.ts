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
export type HeroSlide = { eyebrow: string; title: string; sub: string; img: string; link?: string | null; dim?: boolean; imgMobile?: string | null; fit?: "cover" | "natural" }; // fit: cover = fill the fixed frame (edges are cut), natural = the frame follows the picture's own shape (nothing is cut) // dim: a dark layer over the photo so the text reads (default on)

const IMG = "/sites/xemayhoangkim/img";

export const DEFAULT_SHOP: Shop = {
  brand: "Siêu Thị Yên Thoa",
  hotlines: ["0902 003 145", "091 468 64 24"],
  facebook: "https://www.facebook.com/SieuthiYenThoaYM/",
  branches: [
    "CN Yên Thổ - Yên Mô - Ninh Bình",
    "CN 876 Nguyễn Công Trứ - P. Ninh Sơn - TP Hoa Lư - Ninh Bình",
    "CN Khánh Nhạc - Yên Khánh - Ninh Bình (cổng trường THPT Yên Khánh A)",
    "CN Khánh Hải - Văn Hải - Kim Sơn - Ninh Bình",
    "CN Đồng Quan - P. Nam Hoa Lư - Ninh Bình",
  ],
  stores: [
    { name: "CN Yên Thổ", kind: "Xe đạp, xe đạp điện, xe 50cc", address: "Yên Thổ - Yên Mô - Ninh Bình", hours: "Luôn mở cửa", img: `${IMG}/dich-vu-2.jpg` },
    { name: "CN 876 Nguyễn Công Trứ", kind: "Xe đạp, xe đạp điện, xe 50cc", address: "876 Nguyễn Công Trứ - P. Ninh Sơn - TP Hoa Lư - Ninh Bình", hours: "Luôn mở cửa", img: `${IMG}/tin-1.jpg` },
  ],
};

export const DEFAULT_SLIDES: HeroSlide[] = [
  { eyebrow: "Chương trình tháng này", title: "Rước xe về ngay", sub: "Trả trước linh hoạt, thủ tục gọn", img: `${IMG}/hero-1.jpg`, link: "/xe-may" },
  { eyebrow: "Xe số tiết kiệm", title: "Bền bỉ mỗi ngày", sub: "Nhiều màu, giao xe trong ngày", img: `${IMG}/hero-2.jpg`, link: "/xe-may" },
  { eyebrow: "Khám phá cùng xe mới", title: "Đi xa thoải mái", sub: "Xe êm, tiết kiệm nhiên liệu", img: `${IMG}/hero-3.jpg`, link: "/xe-may" },
];

export const BRANDS = [
  { id: "honda", name: "Honda" },
  { id: "dibao", name: "Dibao" },
  { id: "tailg", name: "Tailg" },
  { id: "osakar", name: "Osakar" },
  { id: "dk", name: "DK" },
  { id: "victoria", name: "Victoria" },
  { id: "motor-thai", name: "Motor Thái" },
  { id: "viet-thai", name: "Việt Thái" },
  { id: "ally", name: "Ally" },
  { id: "xe-50cc", name: "Xe 50cc" },
  { id: "khac", name: "Hãng khác" },
];

// brands listed in the "Xe điện" dropdown of the header; the rest go in "Xe máy"
export const ELECTRIC_BRANDS = new Set(["dibao", "tailg", "osakar", "dk", "khac"]);

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
  honda: { src: "/sites/yenthoa/bg/concrete.webp" },
  yamaha: { src: "/sites/yenthoa/bg/arches.webp" },
  sym: { src: "/sites/yenthoa/bg/wireframe.webp" },
  suzuki: { src: "/sites/yenthoa/bg/dark.webp", dark: true },
  "xe-may-nhap-khau": { src: "/sites/yenthoa/bg/concrete.webp" },
  "xe-50cc": { src: "/sites/yenthoa/bg/concrete.webp" },
  yadea: { src: "/sites/yenthoa/bg/arches.webp" },
  "xe-dien-yamaha": { src: "/sites/yenthoa/bg/arches.webp" },
};
