import Link from "next/link";
import { seedAction } from "@/app/admin/actions";
import { PageTitle, btnCls } from "@/components/admin/ui";
import { dashboardCounts } from "@/lib/admin-repo";

export default async function Dashboard() {
  const c = await dashboardCounts();
  const cards = [
    { href: "/admin/bai-viet", label: "Bài viết", n: c.posts, note: c.postsHidden ? `${c.postsHidden} đang ẩn` : "" },
    { href: "/admin/san-pham", label: "Sản phẩm", n: c.products, note: c.productsHidden ? `${c.productsHidden} đang ẩn` : "" },
    { href: "/admin/trang-chu", label: "Banner trang chủ", n: c.slides, note: "" },
  ];
  return (
    <>
      <PageTitle>Tổng quan</PageTitle>
      {c.posts === 0 && c.products === 0 && (
        <form action={seedAction} className="mb-6 bg-white p-5">
          <p className="mb-3 text-sm">Cơ sở dữ liệu đang trống. Nạp bài viết, sản phẩm, banner và thông tin cửa hàng mẫu đi kèm mã nguồn?</p>
          <button className={btnCls}>Nạp dữ liệu mẫu</button>
        </form>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((x) => (
          <Link key={x.href} href={x.href} className="bg-white p-5 hover:shadow">
            <p className="text-sm text-neutral-500">{x.label}</p>
            <p className="mt-1 text-3xl font-bold">{x.n}</p>
            {x.note && <p className="mt-1 text-xs text-neutral-500">{x.note}</p>}
          </Link>
        ))}
      </div>
    </>
  );
}
