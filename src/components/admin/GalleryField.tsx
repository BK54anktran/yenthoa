"use client";

import { useRef, useState } from "react";
import { classifyImageLink, UPLOAD_LINK } from "@/lib/image-rules";
import { useImageIntake } from "./image-intake";
import { btnGhost, inputCls } from "./ui";

// One image path per line. Same rules as every other picture field (lib/image-rules.ts): copied pictures (Ctrl+V) and dropped
// files are uploaded and added as new lines, pasted links to other websites' pictures are downloaded first.
export function GalleryField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const file = useRef<HTMLInputElement>(null);
  const { busy, err, own, uploadFiles, resolveLinks } = useImageIntake();
  const loading = busy > 0;

  const append = (urls: string[]) => urls.length && setV((cur) => [cur.trim(), ...urls].filter(Boolean).join("\n"));

  async function upload(files: File[]) {
    append(await uploadFiles(files));
    if (file.current) file.current.value = "";
  }

  const lines = v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const outside = lines.filter((l) => classifyImageLink(l, own)?.kind === "external" && !UPLOAD_LINK.test(l));
  async function importOutside() {
    const out = await resolveLinks(lines);
    setV(out.join("\n"));
  }

  return (
    <div>
      <textarea
        name={name}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
          if (files.length) {
            e.preventDefault();
            void upload(files);
            return;
          }
          const pasted = e.clipboardData.getData("text").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (!pasted.length || !pasted.every((l) => classifyImageLink(l, own))) return;
          e.preventDefault();
          void resolveLinks(pasted).then(append);
        }}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
          if (!files.length) return;
          e.preventDefault();
          void upload(files);
        }}
        rows={4}
        className={`${inputCls} font-mono`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => file.current?.click()} disabled={loading} className={btnGhost}>
          {loading ? "Đang tải..." : "Tải thêm ảnh"}
        </button>
        {outside.length > 0 && (
          <button type="button" onClick={importOutside} disabled={loading} className={btnGhost}>{`Tải ${outside.length} ảnh từ trang khác về`}</button>
        )}
      </div>
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}
