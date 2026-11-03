
export type ProductSummary = {
  slug: string;
  name: string;
  brand: string;
  types: string[];
  price: number;
  priceMax: number;
  img: string | null;
};

// One purchasable combination, with its own photo and price (like WooCommerce variations).
// `attrs` is an ordered list (MySQL JSON objects would lose the order) of any attributes the shop wants,
// for example Phiên bản, Màu sắc, Dung tích.
export type VariantAttr = { name: string; value: string };
export type Variant = { attrs: VariantAttr[]; img: string | null; price: number };

// technical specification: groups (Động cơ, Khung xe, Kích thước, ...) of label / value rows
export type SpecGroup = { title: string; items: { label: string; value: string }[] };

export type ProductDetailData = ProductSummary & {
  id: number;
  code: string;
  gallery: string[];
  colors: string[];
  variants: Variant[];
  specs: SpecGroup[];
  shortHtml: string;
  html: string;
  active: boolean;
};

export const productHref = (slug: string) => `/xe/${slug}`;

// "19700000" -> "19.700.000₫" (fixed format so server and client render the same text)
export const formatVnd = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}₫`;

export const priceLabel = (p: Pick<ProductSummary, "price" | "priceMax">) =>
  p.priceMax > p.price ? `${formatVnd(p.price)} - ${formatVnd(p.priceMax)}` : formatVnd(p.price);
