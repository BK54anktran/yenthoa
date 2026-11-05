"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { importDocumentAction, importImageAction, uploadImageAction } from "@/app/admin/upload";
import { tidyHtml } from "@/lib/format-html";
import { checkImageFile, IMAGE_URL, UPLOAD_LINK } from "@/lib/image-rules";
import { btnGhost, inputCls } from "./ui";

// An HTML field with two views: the source, and a preview of what the page will show (after the same cleaning that runs on save).
// Paste a photo link (the "Sao chép link" button of the image manager gives /uploads/<id>) and it becomes an <img> at the cursor.
// The <img> keeps the photo's id only, so replacing that photo later changes every place that shows it.
// Copied picture files (Ctrl+V) and files dropped on the field are uploaded first, then inserted the same way.
// Photos that live on other websites (a pasted link, or <img> tags in pasted HTML) are downloaded into the image manager
// and the link is changed to /uploads/<id>; if some are still in the text, a button downloads them.

// The preview is drawn in a frame that runs NO script (sandbox without allow-scripts): the content may hold any tag, but code
// pasted from somewhere else cannot act inside the admin. allow-same-origin only lets this page measure the frame's height.
// The style is a copy of .prose-content in globals.css (keep the two alike).
const PREVIEW_CSS = "body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; } .prose-content { font-size: 15px; line-height: 1.75; color: #404040; overflow-wrap: anywhere; } .prose-content > * + * { margin-top: 1rem; } .prose-content h2 { margin-top: 2rem; font-size: 1.375rem; font-weight: 600; line-height: 1.35; color: #000; } .prose-content h3 { margin-top: 1.5rem; font-size: 1.125rem; font-weight: 600; line-height: 1.4; color: #000; } .prose-content h4 { font-weight: 600; color: #000; } .prose-content a { color: #de0000; text-decoration: underline; } .prose-content ul { list-style: disc; padding-left: 1.5rem; } .prose-content ol { list-style: decimal; padding-left: 1.5rem; } .prose-content li + li { margin-top: 0.375rem; } .prose-content strong, .prose-content b { font-weight: 600; color: #171717; } .prose-content figure { margin: 1.5rem 0; } .prose-content img { display: block; margin: 0 auto; width: 100%; max-width: 100%; height: auto; } .prose-content figcaption { margin-top: 0.5rem; text-align: center; font-size: 0.8125rem; font-style: italic; color: #737373; } .prose-content table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 14px; } .prose-content th, .prose-content td { border: 1px solid #e5e5e5; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; } .prose-content th { background: #fafafa; font-weight: 600; }";
const previewDoc = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body class="prose-content">${html}</body></html>`;

// a pasted line that is a photo link -> the address to put in src, otherwise null
const imageSrc = (line: string): string | null => UPLOAD_LINK.exec(line)?.[1] ?? (IMAGE_URL.test(line) ? line : null);
// <img ... src="https://other-site/..."> in a text (our own /uploads/<id> links and relative paths are not "other websites")
const EXTERNAL_IMG = /<img\b[^>]*?\ssrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
const externalSrcs = (text: string, own: string): string[] =>
  [...new Set([...text.matchAll(EXTERNAL_IMG)].map((m) => m[1]))].filter((u) => !UPLOAD_LINK.test(u) && !(own && u.startsWith(`${own}/`)));
const imgTag = (src: string) => `<img src="${src}" alt="" loading="lazy">`;
export function HtmlEditor({ name, defaultValue = "", onChange, rows = 10, maxLength = 2_000_000 }: {
  name?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  const [value, setValue] = useState(() => tidyHtml(defaultValue));
  const [mode, setMode] = useState<"html" | "preview">("html");
  const [frameH, setFrameH] = useState(120);
  const frame = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const own = useSyncExternalStore(() => () => {}, () => window.location.origin, () => ""); // this website's address (empty while rendering on the server)
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const update = (v: string) => {
    setValue(v);
    onChange?.(v);
  };

  // fit the frame to its content (also when photos finish loading)
  function fit() {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const measure = () => setFrameH(Math.max(120, doc.documentElement.scrollHeight));
    measure();
    for (const img of Array.from(doc.images)) img.addEventListener("load", measure);
    new ResizeObserver(measure).observe(doc.documentElement);
  }

  async function addImages(files: File[]) {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return;
    setErr("");
    setBusy((n) => n + pics.length);
    const tags: string[] = [];
    for (const f of pics) {
      const bad = checkImageFile(f);
      const fd = new FormData();
      fd.set("file", f);
      const r = bad ? { error: bad, url: undefined } : await uploadImageAction(fd).catch(() => ({ url: undefined, error: "không gửi được ảnh lên server (mạng hoặc server đang bận), thử lại." }));
      if (r.url) tags.push(`<img src="${r.url}" alt="" loading="lazy">`);
      else setErr(`${f.name || "Ảnh"}: ${r.error ?? "tải ảnh thất bại."}`);
      setBusy((n) => n - 1);
    }
    if (tags.length) insertAtCursor(tags.join("\n"));
  }

  // a Word or PDF file becomes HTML at the cursor; a picture file (a design exported as PNG or JPG) is uploaded like a dropped photo
  async function importFiles(files: File[]) {
    const docs = files.filter((f) => /\.(docx|pdf)$/i.test(f.name));
    await addImages(files);
    const range: [number, number] = [area.current?.selectionStart ?? value.length, area.current?.selectionEnd ?? value.length];
    for (const f of docs) {
      setErr("");
      setBusy((n) => n + 1);
      const fd = new FormData();
      fd.set("file", f);
      const r = await importDocumentAction(fd).catch(() => ({ html: undefined, warnings: undefined, error: "không gửi được tệp lên server, thử lại." }));
      setBusy((n) => n - 1);
      if (r.html) {
        insertAtCursor(r.html, range);
        if (r.warnings?.length) setErr(`${f.name}: ${r.warnings.join(" · ")}`);
      } else setErr(`${f.name}: ${r.error ?? "không đọc được tệp."}`);
    }
  }

  // downloads photos from other websites into the image manager: address -> /uploads/<id> (the ones that failed are left out)
  async function importAll(urls: string[]): Promise<Map<string, string>> {
    const done = new Map<string, string>();
    setErr("");
    setBusy((n) => n + urls.length);
    const failed: string[] = [];
    for (const u of urls) {
      const r = await importImageAction(u).catch(() => ({ url: undefined, error: "không gọi được server, thử lại." }));
      if (r.url) done.set(u, r.url);
      else failed.push(`${u.length > 60 ? `${u.slice(0, 57)}...` : u}: ${r.error ?? "tải ảnh thất bại."}`);
      setBusy((n) => n - 1);
    }
    if (failed.length) setErr(`Không tải về được ${failed.length} ảnh, link được giữ nguyên. ${failed.join(" · ")}`);
    return done;
  }

  const outside = externalSrcs(value, own);
  async function importOutside() {
    const done = await importAll(outside);
    if (!done.size) return;
    setValue((cur) => {
      let next = cur;
      for (const [from, to] of done) next = next.split(from).join(to);
      onChange?.(next);
      return next;
    });
  }

  // puts text where the cursor is (replacing the selection); the field may have changed while photos were uploading
  function insertAtCursor(text: string, range?: [number, number]) {
    const el = area.current;
    const at = range ? range[0] : el ? el.selectionStart : value.length;
    const to = range ? range[1] : el ? el.selectionEnd : value.length;
    setValue((cur) => {
      const next = tidyHtml(`${cur.slice(0, at)}${text}${cur.slice(to)}`);
      onChange?.(next);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Chế độ xem" className="flex border border-neutral-300 text-xs font-semibold">
          {([["html", "HTML"], ["preview", "Xem trước"]] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`px-3 py-1.5 ${mode === m ? "bg-[#2b2b2b] text-white" : "bg-white text-neutral-700 hover:bg-neutral-100"}`}>
              {label}
            </button>
          ))}
        </div>
        {mode === "html" && (
          <>
            <input ref={picker} type="file" multiple hidden accept=".docx,.pdf,image/*" onChange={(e) => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button type="button" onClick={() => picker.current?.click()} disabled={busy > 0} className={btnGhost}>Nhập từ tệp</button>
          </>
        )}
        {mode === "html" && (
          <span className="text-xs text-neutral-500">{busy > 0 ? `Đang tải ${busy} ảnh...` : "Dán link ảnh (Sao chép link ở mục Hình ảnh) để chèn ảnh."}</span>
        )}
      </div>

      <textarea
        ref={area}
        name={name}
        value={value}
        onChange={(e) => update(e.target.value)}
        onBlur={() => { const t = tidyHtml(value); if (t !== value) update(t); }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text/plain");
          const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const srcs = lines.map(imageSrc);
          const range: [number, number] = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd]; // where the cursor is now
          // pasted photo link(s), one per line: each becomes an <img>; a link to another website is downloaded first
          if (lines.length && srcs.every((x): x is string => !!x)) {
            e.preventDefault();
            const outsideLinks = srcs.filter((x) => !UPLOAD_LINK.test(x));
            void (async () => {
              const done = outsideLinks.length ? await importAll([...new Set(outsideLinks)]) : new Map<string, string>();
              const m = srcs.map((x) => UPLOAD_LINK.exec(x)?.[1] ?? done.get(x) ?? x);
              insertAtCursor(m.map(imgTag).join("\n"), range);
            })();
            return;
          }
          // pasted HTML with <img> from other websites: download them, then paste the HTML with the new links
          const ext = externalSrcs(text, own);
          if (ext.length) {
            e.preventDefault();
            void (async () => {
              const done = await importAll(ext);
              let out = text;
              for (const [from, to] of done) out = out.split(from).join(to);
              insertAtCursor(out, range);
            })();
            return;
          }
          const files = Array.from(e.clipboardData.files);
          if (files.some((f) => f.type.startsWith("image/"))) {
            e.preventDefault();
            void addImages(files);
          }
        }}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files);
          if (files.some((f) => f.type.startsWith("image/") || /\.(docx|pdf)$/i.test(f.name))) {
            e.preventDefault();
            void importFiles(files);
          }
        }}
        rows={rows}
        maxLength={maxLength}
        hidden={mode !== "html"}
        spellCheck={false}
        className={`${inputCls} font-mono font-normal`}
      />

      {mode === "html" && outside.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Có {outside.length} ảnh từ trang web khác (link ngoài). Ảnh sẽ mất nếu trang đó xoá hoặc đổi link.</span>
          <button type="button" onClick={importOutside} disabled={busy > 0} className={btnGhost}>{busy > 0 ? "Đang tải..." : `Tải ${outside.length} ảnh về mục Hình ảnh`}</button>
        </div>
      )}

      {mode === "preview" && (
        <div className="min-h-24 border border-neutral-300 bg-white" aria-label="Xem trước">
          {value.trim() ? (
            <iframe ref={frame} title="Xem trước" sandbox="allow-same-origin" srcDoc={previewDoc(value)} onLoad={fit} style={{ height: frameH }} className="block w-full border-0 p-4" />
          ) : (
            <p className="p-4 text-sm text-neutral-400">Chưa có nội dung.</p>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}
