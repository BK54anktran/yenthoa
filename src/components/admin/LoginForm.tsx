"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/admin/actions";
import { Field, btnCls, inputCls } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Tên đăng nhập">
        <input name="user" defaultValue="admin" autoComplete="username" required className={inputCls} />
      </Field>
      <Field label="Mật khẩu">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </Field>
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Đang đăng nhập..." : "Đăng nhập"}</button>
    </form>
  );
}
