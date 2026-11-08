import Link from "next/link";

const SIDE = 2; // page numbers shown on each side of the current one (from sm up)
const SIDE_NARROW = 1; // on a phone only the neighbours, so the bar stays on one line

const base = "h-8 min-w-8 items-center justify-center border px-2 text-xs font-semibold";
const linkCls = `${base} cursor-pointer border-neutral-300 bg-white text-neutral-700 hover:border-[#de0000] hover:text-[#de0000]`;
const currentCls = `${base} border-[#de0000] bg-[#de0000] text-white`;
const offCls = `${base} border-neutral-200 bg-white text-neutral-300`;
const dots = "px-1 text-neutral-400";

// the numbers around `page`: a window of 2*side+1 slid inside 1..pages, so it stays full at both ends
function windowAround(page: number, pages: number, side: number) {
  const size = Math.min(pages, side * 2 + 1);
  const start = Math.min(Math.max(1, page - side), pages - size + 1);
  return { start, end: start + size - 1 };
}

// « ‹ 1 2 3 4 5 … › »  or  « ‹ … 3 4 5 6 7 … › »: a window of numbers around the current page, centred under the list
export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const wide = windowAround(page, pages, SIDE);
  const narrow = windowAround(page, pages, SIDE_NARROW);
  const nums = Array.from({ length: wide.end - wide.start + 1 }, (_, i) => wide.start + i);
  const step = (label: string, text: string, to: number, off: boolean) =>
    off ? <span aria-hidden className={`${offCls} inline-flex`}>{text}</span> : <Link href={href(to)} aria-label={label} title={label} className={`${linkCls} inline-flex`}>{text}</Link>;
  return (
    <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      {step("Trang đầu", "«", 1, page === 1)}
      {step("Trang trước", "‹", page - 1, page === 1)}
      {narrow.start > 1 && <span aria-hidden className={`${dots} sm:hidden`}>…</span>}
      {wide.start > 1 && <span aria-hidden className={`${dots} hidden sm:inline`}>…</span>}
      {nums.map((n) => {
        const show = n < narrow.start || n > narrow.end ? "hidden sm:inline-flex" : "inline-flex";
        return n === page
          ? <span key={n} aria-current="page" className={`${currentCls} inline-flex`}>{n}</span>
          : <Link key={n} href={href(n)} className={`${linkCls} ${show}`}>{n}</Link>;
      })}
      {narrow.end < pages && <span aria-hidden className={`${dots} sm:hidden`}>…</span>}
      {wide.end < pages && <span aria-hidden className={`${dots} hidden sm:inline`}>…</span>}
      {step("Trang sau", "›", page + 1, page === pages)}
      {step("Trang cuối", "»", pages, page === pages)}
    </nav>
  );
}
