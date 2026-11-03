import Image from "next/image";
import Link from "next/link";
import { ImageActions, RenameImage, UploadNewButton } from "@/components/admin/MediaActions";
import { PageTitle, btnGhost, inputCls } from "@/components/admin/ui";
import { findUsage, listMedia } from "@/lib/media";

const PER_PAGE = 24;
// lower-case without accents, đ as d: "đồng phục" finds "dong phuc"
const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const day = (t: number) => new Date(t).toISOString().slice(0, 10).split("-").reverse().join("/");

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ loc?: string; trang?: string; q?: string }> }) {
  const sp = await searchParams;
  const loc = sp.loc === "dang-dung" || sp.loc === "chua-dung" ? sp.loc : "";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const [all, usage] = await Promise.all([listMedia(), findUsage()]);
  // every word typed has to appear in the name, the id, or the name of a place that uses the photo
  const words = fold(q).split(/\s+/).filter(Boolean);
  const files = words.length
    ? all.filter((f) => {
        const hay = fold([f.name, f.id, ...(usage.get(f.id) ?? []).map((p) => p.label)].join(" "));
        return words.every((w) => hay.includes(w));
      })
    : all;
  const used = files.filter((f) => (usage.get(f.id)?.length ?? 0) > 0).length;
  const shown = files.filter((f) => (loc === "dang-dung" ? usage.has(f.id) : loc === "chua-dung" ? !usage.has(f.id) : true));
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.trang) || 1), pages);
  const slice = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (l: string, p = 1) => `/admin/hinh-anh?${new URLSearchParams({ ...(q ? { q } : {}), ...(l ? { loc: l } : {}), ...(p > 1 ? { trang: String(p) } : {}) })}`;
  const tabs = [["", `Tất cả (${files.length})`], ["dang-dung", `Đang dùng (${used})`], ["chua-dung", `Chưa dùng (${files.length - used})`]];

  return (
    <>
      <PageTitle action={<UploadNewButton />}>Hình ảnh</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Các ảnh đã tải lên website. Mỗi ảnh cho biết đang được dùng ở bao nhiêu vị trí. Các chỗ dùng ảnh chỉ lưu <b>mã</b> của ảnh, nên <b>Đổi tên</b> hay <b>Thay thế</b> (đổi sang ảnh mới) đều không phải sửa lại chỗ nào. <b>Sao chép link</b> để dán vào ô ảnh ở nơi khác. Ảnh có sẵn của website (thư mục /sites) không nằm ở đây.
      </p>
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        {loc && <input type="hidden" name="loc" value={loc} />}
        <input name="q" defaultValue={q} placeholder="Tìm theo tên ảnh, mã ảnh hoặc nơi đang dùng..." maxLength={100} aria-label="Tìm ảnh" className={`${inputCls} max-w-md`} />
        <button className={btnGhost}>Tìm</button>
        {q && <Link href={loc ? `/admin/hinh-anh?loc=${loc}` : "/admin/hinh-anh"} className="self-center text-sm text-neutral-500 hover:text-[#de0000]">Xoá tìm kiếm</Link>}
      </form>
      <nav aria-label="Lọc ảnh" className="mb-4 flex flex-wrap gap-2 text-sm">
        {tabs.map(([v, label]) => (
          <Link key={v} href={href(v)} className={`border px-3 py-1.5 ${loc === v ? "border-[#de0000] font-semibold text-[#de0000]" : "border-neutral-300 bg-white text-neutral-700 hover:border-black"}`}>{label}</Link>
        ))}
      </nav>

      {slice.length === 0 ? (
        <p className="bg-white p-6 text-sm text-neutral-500">{all.length === 0 ? "Chưa có ảnh nào được tải lên." : q ? `Không có ảnh nào khớp "${q}".` : "Không có ảnh nào ở mục này."}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slice.map((f) => {
            const places = usage.get(f.id) ?? [];
            return (
              <li key={f.id} className="flex flex-col gap-3 bg-white p-3">
                <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                  <Image src={f.url} alt="" fill sizes="(min-width: 1024px) 300px, 50vw" unoptimized className="object-contain" />
                </div>
                <div className="min-w-0 text-xs text-neutral-500">
                  <RenameImage id={f.id} name={f.name} />
                  <p className="mt-0.5">{kb(f.size)} · {day(f.time)} · mã <span className="font-mono">{f.id}</span></p>
                </div>
                <div className="text-sm">
                  {places.length === 0 ? (
                    <span className="text-neutral-400">Chưa dùng ở đâu</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer font-semibold text-green-700">Đang dùng ở {places.length} vị trí</summary>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {places.map((p, i) => (
                          <li key={i}><Link href={p.href} className="hover:text-[#de0000] hover:underline">{p.label}</Link></li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <ImageActions id={f.id} places={places.length} />
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={href(loc, page - 1)} className="hover:text-[#de0000]">← Trước</Link>}
          <span className="text-neutral-500">Trang {page}/{pages}</span>
          {page < pages && <Link href={href(loc, page + 1)} className="hover:text-[#de0000]">Sau →</Link>}
        </div>
      )}
    </>
  );
}
