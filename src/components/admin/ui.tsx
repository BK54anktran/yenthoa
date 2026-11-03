import type { ReactNode } from "react";

export const inputCls =
  "w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#de0000] focus:outline-none";
export const btnCls = "inline-flex items-center justify-center bg-[#de0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#b80000] disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-[#de0000] hover:text-[#de0000]";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-neutral-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {action}
    </div>
  );
}
