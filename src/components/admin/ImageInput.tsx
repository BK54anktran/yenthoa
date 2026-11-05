"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { isWebLink, UPLOAD_LINK } from "@/lib/image-rules";
import { useImageIntake } from "./image-intake";
import { btnGhost, inputCls } from "./ui";

// Text field for an image path plus an upload button. Works uncontrolled (name + defaultValue, for
// plain forms) or controlled (value + onChange). Same rules as every other picture field (lib/image-rules.ts):
// a copied picture (Ctrl+V) or a dropped file is uploaded, a link to another website's picture is downloaded.
export function ImageInput({ name, defaultValue = "", value, onChange, placeholder = "/uploads/... hoặc https://..." }: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const file = useRef<HTMLInputElement>(null);
  const { busy, err, uploadFiles, resolveLinks } = useImageIntake();
  const v = value ?? inner;
  const set = (x: string) => (onChange ? onChange(x) : setInner(x));
  const loading = busy > 0;

  async function upload(files: File[]) {
    const [url] = await uploadFiles(files);
    if (url) set(url);
    if (file.current) file.current.value = "";
  }

  async function bring(link: string) {
    const [out] = await resolveLinks([link]);
    if (out) set(out);
  }

  // an outside link still in the box (not one of ours): the button downloads it
  const outside = isWebLink(v) && !UPLOAD_LINK.test(v.trim());

  return (
    <div
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return;
        e.preventDefault();
        void upload(files);
      }}
    >
      <div className="flex gap-2">
        <input
          name={name}
          value={v}
          onChange={(e) => set(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
            if (files.length) {
              e.preventDefault();
              void upload(files);
              return;
            }
            const text = e.clipboardData.getData("text").trim();
            if (!isWebLink(text)) return;
            e.preventDefault();
            set(text);
            void bring(text);
          }}
          onBlur={() => {
            if (!loading && outside) void bring(v);
          }}
          maxLength={500}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" onClick={() => (outside ? void bring(v) : file.current?.click())} disabled={loading} className={`${btnGhost} shrink-0`}>
          {loading ? "Đang tải..." : outside ? "Tải ảnh về" : "Tải ảnh lên"}
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
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
