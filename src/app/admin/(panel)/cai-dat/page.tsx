import { ShopForm } from "@/components/admin/ShopForm";
import { PageTitle } from "@/components/admin/ui";
import { getShop } from "@/lib/shop";

export default async function ShopSettings() {
  const shop = await getShop();
  return (
    <>
      <PageTitle>Thông tin cửa hàng</PageTitle>
      <ShopForm shop={shop} />
    </>
  );
}
