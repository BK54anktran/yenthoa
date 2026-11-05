"use client";

import { useEffect } from "react";

// Ctrl+S (Cmd+S on a Mac) presses the page's "Lưu ..." button instead of the browser's "save this page". Only a button whose label starts
// with "Lưu" or "Cập nhật" counts, so buttons like "Tạo bản sao" or "Xoá" are never pressed by accident. A page without such a button
// keeps the browser's own Ctrl+S.
export function SaveShortcut() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "s") return;
      for (const form of document.querySelectorAll<HTMLFormElement>("main form")) {
        const save = [...form.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.type === "submit" && !b.disabled && /^(Lưu|Cập nhật)/.test((b.textContent ?? "").trim()));
        if (save) {
          e.preventDefault();
          form.requestSubmit(save);
          return;
        }
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return null;
}
