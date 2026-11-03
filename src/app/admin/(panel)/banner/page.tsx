import { redirect } from "next/navigation";

// the banners now live on the home page editor
export default function BannerAdmin() {
  redirect("/admin/trang-chu");
}
