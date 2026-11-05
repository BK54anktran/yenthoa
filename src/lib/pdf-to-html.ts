// Reads a PDF the way a person would: line by line, using where each piece of text sits and how big it is.
// Bigger text becomes a heading, a larger gap between lines starts a new paragraph, text split in columns on one line becomes
// a table row, and a line that starts with a bullet or a number becomes a list item. Pictures and page layout are not kept.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Item = { str: string; x: number; y: number; w: number; h: number };
type Line = { cells: string[]; text: string; size: number; y: number; page: number; list?: "ul" | "ol" };

const BULLET = /^[•·▪●○◦‣-]$/;
const NUMBERED = /^(\d{1,2}[.)])\s+(?=\S)/;

export async function pdfToHtml(data: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const lines: Line[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const content = await (await pdf.getPage(pageNo)).getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const t = it.transform as number[];
      items.push({ str: it.str, x: t[4], y: t[5], w: it.width, h: it.height || Math.abs(t[3]) });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    // items whose baselines are close belong to one line
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].y - it.y) < Math.max(2, it.h * 0.4)) row.push(it);
      else rows.push([it]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const size = Math.max(...row.map((i) => i.h));
      let list: Line["list"];
      if (BULLET.test(row[0].str.trim()) && row.length > 1) {
        list = "ul";
        row.shift();
      }
      const cells: string[] = [];
      let cur = "";
      let end = 0;
      row.forEach((it, i) => {
        const gap = it.x - end;
        if (i > 0 && gap > size * 1.0) {
          cells.push(cur.trim());
          cur = it.str;
        } else cur += (i > 0 && gap > size * 0.15 && !/\s$/.test(cur) && !/^\s/.test(it.str) ? " " : "") + it.str;
        end = it.x + it.w;
      });
      cells.push(cur.trim());
      lines.push({ cells, text: cells.join(" "), size, y: row[0].y, page: pageNo, list });
    }
  }
  if (!lines.length) return "";

  // the usual text size (by amount of text) and the usual gap between two lines of it
  const bySize = new Map<number, number>();
  for (const l of lines) bySize.set(Math.round(l.size), (bySize.get(Math.round(l.size)) ?? 0) + l.text.length);
  const body = [...bySize].sort((a, b) => b[1] - a[1])[0][0] || 12;
  const gaps: number[] = [];
  lines.forEach((l, i) => {
    const p = lines[i - 1];
    if (p && p.page === l.page && Math.round(l.size) === body && Math.round(p.size) === body && p.y - l.y > 0 && p.y - l.y < body * 3) gaps.push(p.y - l.y);
  });
  gaps.sort((a, b) => a - b);
  const leading = gaps[Math.floor(gaps.length / 2)] ?? body * 1.3;

  const out: string[] = [];
  let para = "";
  let table: string[][] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para) out.push(`<p>${esc(para)}</p>`);
    para = "";
    if (table.length) out.push(`<table>${table.map((r, i) => `<tr>${r.map((c) => `<${i === 0 ? "th" : "td"}>${esc(c)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table>`);
    table = [];
    if (list) out.push(`<${list.tag}>${list.items.map((x) => `<li>${esc(x)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const big = l.size >= body * 1.2 && l.text.length < 160;
    if (big) {
      flush();
      out.push(`<h${l.size >= body * 1.5 ? 2 : 3}>${esc(l.text)}</h${l.size >= body * 1.5 ? 2 : 3}>`);
    } else if (l.cells.length > 1) {
      if (para || list) flush();
      table.push(l.cells);
    } else if (l.list || NUMBERED.test(l.text)) {
      // a numbered line ("1. ...", "2) ...") of the usual text size is a list item
      const tag = l.list ?? "ol";
      if (para || table.length || (list && list.tag !== tag)) flush();
      if (!list) list = { tag, items: [] };
      list.items.push(l.list ? l.text : l.text.replace(NUMBERED, ""));
    } else {
      const newPara = !para || !prev || (prev.page === l.page && prev.y - l.y > leading * 1.25) || prev.size >= body * 1.2 || table.length > 0 || !!list;
      if (newPara) flush();
      para = para ? `${para} ${l.text}` : l.text;
    }
  });
  flush();
  return out.join("\n");
}
