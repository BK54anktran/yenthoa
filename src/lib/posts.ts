export type PostSummary = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  section: string;
  excerpt: string;
  img: string | null;
};

export type PostDetailData = PostSummary & { id: number; html: string; published: boolean };

export const postHref = (slug: string) => `/tin-tuc/${slug}`;
export const PAGE_SIZE = 12;

// "2026-11-01" -> "01/11/2026"
export const formatDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
