"use client";

import { useRef, useState } from "react";
import { uploadImageAction } from "@/app/admin/upload";
import { btnGhost, inputCls } from "./ui";

// One image path per line, with an upload button that appends the new file to the list.
export function GalleryField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr("");
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadImageAction(fd);
      if (r.url) setV((cur) => (cur.trim() ? `${cur.trim()}\n${r.url}` : r.url!));
      else setErr(r.error ?? "Tải ảnh thất bại.");
    }
    setBusy(false);
    if (file.current) file.current.value = "";
  }

  return (
    <div>
      <textarea name={name} value={v} onChange={(e) => setV(e.target.value)} rows={4} className={`${inputCls} font-mono`} />
      <button type="button" onClick={() => file.current?.click()} disabled={busy} className={`${btnGhost} mt-2`}>
        {busy ? "Đang tải..." : "Tải thêm ảnh"}
      </button>
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}
