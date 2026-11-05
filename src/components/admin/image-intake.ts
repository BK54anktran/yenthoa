"use client";

import { useState, useSyncExternalStore } from "react";
import { importImageAction, uploadImageAction } from "@/app/admin/upload";
import { checkImageFile, classifyImageLink } from "@/lib/image-rules";

// The one way pictures get into the admin from the browser (rules: lib/image-rules.ts): upload files, bring in links.
export function useImageIntake() {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const own = useSyncExternalStore(() => () => {}, () => window.location.origin, () => ""); // this website's address ("" while rendering on the server)

  // files -> /uploads/<id> links (the ones that fail are reported and left out)
  async function uploadFiles(files: File[]): Promise<string[]> {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return [];
    setErr("");
    setBusy((n) => n + pics.length);
    const urls: string[] = [];
    const problems: string[] = [];
    for (const f of pics) {
      const bad = checkImageFile(f);
      if (bad) problems.push(`${f.name || "Ảnh"}: ${bad}`);
      else {
        const fd = new FormData();
        fd.set("file", f);
        const r = await uploadImageAction(fd).catch(() => ({ url: undefined, error: "không gửi được ảnh lên server (mạng hoặc server đang bận), thử lại." }));
        if (r.url) urls.push(r.url);
        else problems.push(`${f.name || "Ảnh"}: ${r.error ?? "tải ảnh thất bại."}`);
      }
      setBusy((n) => n - 1);
    }
    if (problems.length) setErr(problems.join(" · "));
    return urls;
  }

  // links -> what to keep: our own pictures as /uploads/<id>, other websites' pictures downloaded (a failed one stays as the link written)
  async function resolveLinks(lines: string[]): Promise<string[]> {
    const unique = [...new Set(lines.map((l) => l.trim()))];
    const done = new Map<string, string>();
    const failed: string[] = [];
    setErr("");
    for (const link of unique) {
      const c = classifyImageLink(link, own);
      if (!c) continue;
      if (c.kind === "own") {
        done.set(link, c.path);
        continue;
      }
      setBusy((n) => n + 1);
      const r = await importImageAction(c.url).catch(() => ({ url: undefined, error: "không gọi được server, thử lại." }));
      setBusy((n) => n - 1);
      if (r.url) done.set(link, r.url);
      else failed.push(`${link.length > 60 ? `${link.slice(0, 57)}...` : link}: ${r.error ?? "không tải được ảnh."}`);
    }
    if (failed.length) setErr(`Không tải về được ${failed.length} ảnh, giữ link gốc (có thể mất nếu trang kia xoá ảnh). ${failed.join(" · ")}`);
    return lines.map((l) => done.get(l.trim()) ?? l.trim());
  }

  return { busy, err, setErr, own, uploadFiles, resolveLinks };
}
