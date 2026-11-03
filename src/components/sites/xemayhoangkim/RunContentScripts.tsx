"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// <script> tags inside page content only run when the visitor loads the page itself. When a visitor clicks a link inside the
// site, the new content is put into the page without reloading it, and the browser skips the scripts in it. This brings
// them back: after every such change, each script that did not run yet is copied into a fresh <script> tag, which runs.
//  - the first time (the page was just loaded) every script in the content has already run, so they are only marked
//  - later, a script without the mark came with new content: it is replaced by a copy that runs (once per page view)
const MARK = "data-hp-ran";

export function RunContentScripts() {
  const path = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const scripts = document.querySelectorAll<HTMLScriptElement>(`main script:not([${MARK}])`);
    for (const old of Array.from(scripts)) {
      if (first.current) {
        old.setAttribute(MARK, "1");
        continue;
      }
      const copy = document.createElement("script");
      for (const a of Array.from(old.attributes)) copy.setAttribute(a.name, a.value);
      copy.textContent = old.textContent;
      copy.async = false; // keep the order they were written in
      copy.setAttribute(MARK, "1");
      old.replaceWith(copy);
    }
    first.current = false;
  }, [path]);

  return null;
}
