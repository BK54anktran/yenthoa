"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteImageAction, renameImageAction, replaceImageAction } from "@/app/admin/media-actions";
import { uploadImageAction } from "@/app/admin/upload";
import { ConfirmButton } from "./ConfirmButton";
import { btnCls, btnGhost } from "./ui";

// Copy the photo's link (/uploads/...): it is what every image field of the admin takes.
export function CopyLinkButton({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // no clipboard permission (plain http): fall back to a temporary field
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return <button type="button" onClick={copy} className={btnGhost}>{done ? "Đã chép" : "Sao chép link"}</button>;
}

export function ImageActions({ id, places }: { id: string; places: number }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function replace(files: FileList | null) {
    if (!files?.[0]) return;
    if (places > 0 && !window.confirm(`Ảnh đang dùng ở ${places} vị trí. Thay bằng ảnh mới thì cả ${places} chỗ đều hiện ảnh mới (không phải sửa gì thêm). Tiếp tục?`)) {
      if (file.current) file.current.value = "";
      return;
    }
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("id", id);
    fd.set("file", files[0]);
    const r = await replaceImageAction(fd);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (r.error) setErr(r.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <CopyLinkButton url={`/uploads/${id}`} />
        <button type="button" onClick={() => file.current?.click()} disabled={busy} className={btnGhost}>{busy ? "Đang thay..." : "Thay thế"}</button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => replace(e.target.files)} />
        <form action={deleteImageAction}>
          <input type="hidden" name="id" value={id} />
          <ConfirmButton
            message={places > 0 ? `Ảnh đang dùng ở ${places} vị trí. Xoá thì các chỗ đó sẽ bị vỡ ảnh (hãy dùng Thay thế nếu chỉ muốn đổi ảnh). Vẫn xoá?` : "Xoá ảnh này? Không khôi phục được."}
            className={btnGhost}
          >
            Xoá
          </ConfirmButton>
        </form>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}

export function UploadNewButton() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr("");
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadImageAction(fd);
      if (r.error) setErr(`${f.name}: ${r.error}`);
    }
    setBusy(false);
    if (file.current) file.current.value = "";
    router.refresh();
  }
  return (
    <div>
      <button type="button" onClick={() => file.current?.click()} disabled={busy} className={btnCls}>{busy ? "Đang tải..." : "+ Tải ảnh lên"}</button>
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}

// shows the photo's name; the pencil turns it into a field (Enter or Lưu saves, Esc cancels)
export function RenameImage({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", value);
    const r = await renameImageAction(fd);
    setBusy(false);
    if (r.error) return setErr(r.error);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800" title={name}>{name}</p>
        <button type="button" onClick={() => { setValue(name); setEditing(true); }} className="shrink-0 text-xs text-[#de0000] hover:underline" aria-label="Đổi tên ảnh">Đổi tên</button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void save(); }
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={200}
          aria-label="Tên ảnh"
          className="min-w-0 flex-1 border border-neutral-300 px-2 py-1 text-sm focus:border-[#de0000] focus:outline-none"
        />
        <button type="button" onClick={save} disabled={busy} className={btnGhost}>{busy ? "..." : "Lưu"}</button>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-[#de0000]">{err}</p>}
    </div>
  );
}
