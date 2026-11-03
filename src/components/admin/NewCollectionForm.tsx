"use client";

import { useActionState } from "react";
import { createCollectionAction, type CollectionFormState } from "@/app/admin/collection-actions";
import { btnCls, inputCls } from "./ui";

export function NewCollectionForm() {
  const [state, action, pending] = useActionState<CollectionFormState, FormData>(createCollectionAction, {});
  return (
    <form action={action} className="flex flex-wrap items-start gap-2 bg-white p-4">
      <label className="min-w-56 flex-1 text-sm font-semibold">
        Tạo bộ sưu tập mới
        <input name="name" required maxLength={80} placeholder="Ví dụ: Xe tay ga bán chạy, Xe dưới 30 triệu" className={`${inputCls} mt-1 font-normal`} />
      </label>
      <button disabled={pending} className={`${btnCls} mt-6`}>{pending ? "Đang tạo..." : "+ Tạo"}</button>
      {state.error && <p role="alert" className="w-full text-sm font-medium text-[#de0000]">{state.error}</p>}
    </form>
  );
}
