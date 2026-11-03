"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePostAction, type FormState } from "@/app/admin/actions";
import type { PostDetailData } from "@/lib/posts";
import { useTaxonomy } from "@/components/sites/xemayhoangkim/taxonomy-context";
import { Field, btnCls, btnGhost, inputCls } from "./ui";
import { HtmlEditor } from "./HtmlEditor";
import { ImageInput } from "./ImageInput";

export function PostForm({ post, today }: { post?: PostDetailData; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePostAction, {});
  const { sections } = useTaxonomy();
  return (
    <form action={action} className="max-w-4xl space-y-5 bg-white p-5">
      {post && <input type="hidden" name="id" value={post.id} />}
      <Field label="Tiêu đề">
        <input name="title" defaultValue={post?.title} required maxLength={300} className={inputCls} />
      </Field>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Ngày đăng">
          <input name="date" type="date" defaultValue={post?.date ?? today} required className={inputCls} />
        </Field>
        <Field label="Mục">
          <select name="section" defaultValue={post?.section ?? "tin-tuc"} className={inputCls}>
            {sections.filter((s) => s.active || s.id === post?.section).map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (ẩn)"}</option>)}
          </select>
        </Field>
        <Field label="Đường dẫn" hint="Để trống để tự tạo từ tiêu đề.">
          <input name="slug" defaultValue={post?.slug} maxLength={191} className={inputCls} />
        </Field>
      </div>
      <Field label="Ảnh bìa" hint="Tải ảnh lên hoặc dán đường dẫn ảnh.">
        <ImageInput name="img" defaultValue={post?.img ?? ""} />
      </Field>
      <Field label="Mô tả ngắn" hint="Hiện ở danh sách tin. Để trống để lấy từ đầu bài.">
        <textarea name="excerpt" defaultValue={post?.excerpt} rows={2} maxLength={600} className={inputCls} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-semibold">Nội dung (HTML)</p>
        <HtmlEditor name="html" defaultValue={post?.html} rows={18} />
        <p className="mt-1 text-xs text-neutral-500">Cho phép mọi thẻ HTML, kể cả script, style và iframe. Chỉ dán mã bạn tin tưởng: mã chạy trên mọi trang khách xem. Tab Xem trước chạy trong khung cô lập (không chạy script).</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? true} className="size-4 accent-[#de0000]" />
        Hiển thị trên website
      </label>
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu bài"}</button>
        <Link href="/admin/bai-viet" className={btnGhost}>Huỷ</Link>
      </div>
    </form>
  );
}
