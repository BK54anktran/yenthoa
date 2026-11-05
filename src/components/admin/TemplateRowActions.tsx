"use client";

import { useActionState } from "react";
import { deleteTemplateAction, duplicateTemplateAction, type TemplateFormState } from "@/app/admin/template-actions";
import { btnGhost } from "./ui";
import { downloadPrompt } from "./TemplateEditor";

export function PromptButton() {
  return (
    <button type="button" onClick={downloadPrompt} className={btnGhost} title="Đưa file này cùng đoạn HTML của bạn cho AI, nó trả về JSON để dán vào tab JSON khi tạo mẫu">
      Tải prompt chuyển HTML sang mẫu
    </button>
  );
}

export function TemplateRowActions({ id, builtIn }: { id: string; builtIn: boolean }) {
  const [state, del, pending] = useActionState<TemplateFormState, FormData>(deleteTemplateAction, {});
  return (
    <span className="flex flex-wrap items-center gap-2">
      <form action={duplicateTemplateAction}>
        <input type="hidden" name="id" value={id} />
        <button className={btnGhost}>Tạo bản sao</button>
      </form>
      {!builtIn && (
        <form
          action={del}
          onSubmit={(e) => {
            if (!window.confirm("Xoá mẫu này? Không khôi phục được.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button disabled={pending} className={btnGhost}>Xoá</button>
        </form>
      )}
      {state.error && <span role="alert" className="basis-full text-xs font-medium text-[#de0000]">{state.error}</span>}
    </span>
  );
}
