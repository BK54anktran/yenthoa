"use client";

import { useActionState, useState } from "react";
import { saveShopAction, type FormState } from "@/app/admin/actions";
import type { Shop, Store } from "@/lib/defaults";
import { Field, btnCls, btnGhost, inputCls } from "./ui";
import { ImageInput } from "./ImageInput";

const blank: Store = { name: "", kind: "", address: "", hours: "", img: "" };

export function ShopForm({ shop }: { shop: Shop }) {
  const [state, action, pending] = useActionState<FormState & { saved?: boolean }, FormData>(
    async (prev, f) => {
      const r = await saveShopAction(prev, f);
      return { ...r, saved: !r.error };
    },
    {},
  );
  const [stores, setStores] = useState<Store[]>(shop.stores);
  const set = (i: number, k: keyof Store, v: string) => setStores((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <form action={action} className="max-w-4xl space-y-5 bg-white p-5">
      <Field label="Tên cửa hàng" hint="Hiện ở đầu trang, chân trang, tiêu đề trình duyệt và dòng &quot;Đăng bởi&quot; của bài viết.">
        <input name="brand" defaultValue={shop.brand} required maxLength={120} className={inputCls} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Hotline" hint="Mỗi dòng một số. Số đầu tiên là số gọi nhanh.">
          <textarea name="hotlines" defaultValue={shop.hotlines.join("\n")} rows={3} className={inputCls} />
        </Field>
        <Field label="Link Facebook" hint="Bắt đầu bằng https://">
          <input name="facebook" defaultValue={shop.facebook} maxLength={500} className={inputCls} />
        </Field>
      </div>
      <Field label="Địa chỉ ở chân trang" hint="Mỗi dòng một chi nhánh.">
        <textarea name="branches" defaultValue={shop.branches.join("\n")} rows={4} className={inputCls} />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Cửa hàng (trang Hệ thống cửa hàng và Liên hệ)</legend>
        {stores.map((s, i) => (
          <div key={i} className="grid gap-3 border border-neutral-200 p-3 md:grid-cols-2">
            <input aria-label="Tên" placeholder="Tên" value={s.name} onChange={(e) => set(i, "name", e.target.value)} className={inputCls} />
            <input aria-label="Loại" placeholder="Loại (Showroom...)" value={s.kind} onChange={(e) => set(i, "kind", e.target.value)} className={inputCls} />
            <input aria-label="Địa chỉ" placeholder="Địa chỉ" value={s.address} onChange={(e) => set(i, "address", e.target.value)} className={`${inputCls} md:col-span-2`} />
            <input aria-label="Giờ mở cửa" placeholder="Giờ mở cửa" value={s.hours} onChange={(e) => set(i, "hours", e.target.value)} className={inputCls} />
            <ImageInput value={s.img} onChange={(v) => set(i, "img", v)} />
            <button type="button" onClick={() => setStores((x) => x.filter((_, j) => j !== i))} className={`${btnGhost} w-fit`}>Xoá cửa hàng này</button>
          </div>
        ))}
        <button type="button" onClick={() => setStores((x) => [...x, { ...blank }])} className={btnGhost}>+ Thêm cửa hàng</button>
        <input type="hidden" name="stores" value={JSON.stringify(stores)} />
      </fieldset>

      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm font-medium text-green-700">Đã lưu.</p>}
      <button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu thay đổi"}</button>
    </form>
  );
}
