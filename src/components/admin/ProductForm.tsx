"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProductAction, type FormState } from "@/app/admin/actions";
import { useTaxonomy } from "@/components/sites/xemayhoangkim/taxonomy-context";
import type { ProductDetailData } from "@/lib/products";
import { Field, btnCls, btnGhost, inputCls } from "./ui";
import { GalleryField } from "./GalleryField";
import { HtmlEditor } from "./HtmlEditor";
import { ImageInput } from "./ImageInput";
import { SpecsEditor } from "./SpecsEditor";
import { VariantsEditor } from "./VariantsEditor";

export function ProductForm({ product }: { product?: ProductDetailData }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProductAction, {});
  const { brands, types } = useTaxonomy();
  return (
    <form action={action} className="max-w-4xl space-y-5 bg-white p-5">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Tên xe">
          <input name="name" defaultValue={product?.name} required maxLength={200} className={inputCls} />
        </Field>
        <Field label="Đường dẫn" hint="Để trống để tự tạo từ tên xe.">
          <input name="slug" defaultValue={product?.slug} maxLength={191} className={inputCls} />
        </Field>
        <Field label="Mã sản phẩm" hint="Để trống để tự tạo (SP0001...). Không trùng với xe khác.">
          <input name="code" defaultValue={product?.code} maxLength={40} className={inputCls} />
        </Field>
        <Field label="Hãng">
          <select name="brand" defaultValue={product?.brand ?? ""} className={inputCls}>
            <option value="">(Chưa chọn)</option>
            {brands.filter((b) => b.active || b.id === product?.brand).map((b) => <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (ẩn)"}</option>)}
          </select>
        </Field>
        <Field label="Màu sắc" hint="Cách nhau bằng dấu phẩy, ví dụ: Đen, Trắng, Đỏ">
          <input name="colors" defaultValue={product?.colors.join(", ")} className={inputCls} />
        </Field>
        <Field label="Giá từ (đồng)">
          <input name="price" inputMode="numeric" defaultValue={product?.price ?? 0} className={inputCls} />
        </Field>
        <Field label="Giá đến (đồng)" hint="Để bằng giá từ nếu chỉ có một mức giá.">
          <input name="priceMax" inputMode="numeric" defaultValue={product?.priceMax ?? 0} className={inputCls} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Loại xe</legend>
        <div className="flex flex-wrap gap-4">
          {types.filter((t) => t.active || product?.types.includes(t.id)).map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="types" value={t.id} defaultChecked={product?.types.includes(t.id)} className="size-4 accent-[#de0000]" />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Ảnh đại diện" hint="Để trống để lấy ảnh đầu tiên trong thư viện.">
        <ImageInput name="img" defaultValue={product?.img ?? ""} />
      </Field>
      <Field label="Thư viện ảnh" hint="Mỗi dòng một đường dẫn ảnh.">
        <GalleryField name="gallery" defaultValue={product?.gallery.join("\n") ?? ""} />
      </Field>
      <Field label="Phiên bản và màu (mỗi dòng một ảnh và một giá riêng)" hint="Trang chi tiết xe hiện các lựa chọn này; chọn màu thì đổi ảnh và giá theo dòng tương ứng.">
        <VariantsEditor name="variants" defaultValue={product?.variants ?? []} />
      </Field>
      <Field label="Thông số kỹ thuật" hint="Hiện ở tab &quot;Thông số kỹ thuật&quot; trên trang xe, mỗi nhóm là một mục thu gọn được. Để trống thì không hiện tab này.">
        <SpecsEditor name="specs" defaultValue={product?.specs ?? []} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-semibold">Giới thiệu ngắn (HTML)</p>
        <HtmlEditor name="shortHtml" defaultValue={product?.shortHtml} rows={4} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">Chi tiết (HTML)</p>
        <HtmlEditor name="html" defaultValue={product?.html} rows={14} />
        <p className="mt-1 text-xs text-neutral-500">Cho phép mọi thẻ HTML, kể cả script, style và iframe. Chỉ dán mã bạn tin tưởng: mã chạy trên mọi trang khách xem. Tab Xem trước chạy trong khung cô lập (không chạy script).</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-[#de0000]" />
        Hiển thị trên website
      </label>
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu xe"}</button>
        <Link href="/admin/san-pham" className={btnGhost}>Huỷ</Link>
      </div>
    </form>
  );
}
