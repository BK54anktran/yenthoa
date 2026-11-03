// Shop info and layout text. Posts and products live in src/content (see scripts/import-hoangkim.mjs).

export const telHref = (n: string) => `tel:${n.replace(/\D/g, "")}`;

export const topLinks = [
  { label: "Bán hàng doanh nghiệp", href: "#" },
  { label: "Tuyển dụng", href: "#" },
  { label: "Liên hệ", href: "/lien-he" },
  { label: "Thăm dò ý kiến khách hàng", href: "#" },
];

// Photos are Unsplash stock images (see docs/research/xemayhoangkim/credits.md).
// They are illustrations only, not the exact models named on the page.
const IMG = "/sites/xemayhoangkim/img";

export const services = [
  { name: "Dịch vụ xe máy", img: `${IMG}/dich-vu-1.jpg` },
  { name: "Dịch vụ tài chính", img: `${IMG}/dich-vu-2.jpg` },
];

export const footerMenu = [
  { label: "Xe máy", href: "/xe-may" },
  { label: "Xe điện", href: "/xe-may?nhom=dibao,tailg,osakar,dk,khac" },
  { label: "Dịch vụ", href: "/tin-tuc" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: "Liên hệ", href: "/lien-he" },
];
