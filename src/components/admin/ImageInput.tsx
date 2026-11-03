"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImageAction } from "@/app/admin/upload";
import { btnGhost, inputCls } from "./ui";

// Text field for an image path plus an upload button. Works uncontrolled (name + defaultValue, for
// plain forms) or controlled (value + onChange).
export function ImageInput({ name, defaultValue = "", value, onChange, placeholder = "/uploads/... hoặc https://..." }: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const v = value ?? inner;
  const set = (x: string) => (onChange ? onChange(x) : setInner(x));

  async function upload(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("file", files[0]);
    const r = await uploadImageAction(fd);
    setBusy(false);
    if (r.url) set(r.url);
    else setErr(r.error ?? "Tải ảnh thất bại.");
    if (file.current) file.current.value = "";
  }

  return (
    <div>
      <div className="flex gap-2">
        <input name={name} value={v} onChange={(e) => set(e.target.value)} maxLength={500} placeholder={placeholder} className={inputCls} />
        <button type="button" onClick={() => file.current?.click()} disabled={busy} className={`${btnGhost} shrink-0`}>
          {busy ? "Đang tải..." : "Tải ảnh lên"}
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
      {v && /^(\/|https:)/.test(v) && (
        <div className="relative mt-2 h-24 w-40 overflow-hidden bg-neutral-100">
          <Image src={v} alt="" fill sizes="160px" className="object-contain" unoptimized />
        </div>
      )}
    </div>
  );
}
