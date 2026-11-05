"use client";

import { useActionState } from "react";
import { createKeyAction, type KeyState } from "@/app/admin/key-actions";
import { CopyLinkButton } from "./MediaActions";
import { Field, btnCls, inputCls } from "./ui";

export function KeyForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(createKeyAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <Field label="Tên gợi nhớ">
            <input name="name" required maxLength={100} placeholder="Ví dụ: Claude Desktop" className={inputCls} />
          </Field>
        </div>
        <button disabled={pending} className={btnCls}>{pending ? "Đang tạo..." : "Tạo key"}</button>
      </form>
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.created && (
        <div className="space-y-3 border border-neutral-300 bg-white p-4">
          <Field label={`Key "${state.created.name}"`}>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all bg-neutral-100 px-3 py-2 text-sm">{state.created.key}</code>
              <CopyLinkButton url={state.created.key} />
            </div>
          </Field>
          <Field label="Địa chỉ MCP">
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all bg-neutral-100 px-3 py-2 text-sm">{mcpUrl}</code>
              <CopyLinkButton url={mcpUrl} />
            </div>
          </Field>
          <Field label={"Địa chỉ có sẵn key (cho ChatGPT, chọn \"Không xác thực\")"}>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all bg-neutral-100 px-3 py-2 text-sm">{`${mcpUrl}/${state.created.key}`}</code>
              <CopyLinkButton url={`${mcpUrl}/${state.created.key}`} />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}
