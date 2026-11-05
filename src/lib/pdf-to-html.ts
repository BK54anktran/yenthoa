// Reads a PDF the way a person would: line by line, using where each piece of text sits and how big it is.
// Bigger text becomes a heading, a larger gap between lines starts a new paragraph, text split in columns on one line becomes
// a table row, and a line that starts with a bullet or a number becomes a list item. A picture goes where it sits on the page
// (between the lines above and below it), with its size and its place (left, centre, right). Colours and page layout are not kept.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Item = { str: string; x: number; y: number; w: number; h: number };
type Line = { cells: string[]; text: string; size: number; y: number; page: number; list?: "ul" | "ol" };
type Pic = { key: string; page: number; y: number; width: number; align: "left" | "center" | "right"; src?: string; raw?: { data: Uint8ClampedArray; width: number; height: number; channels: number } };
// turns the pixels of a picture into a file the site can keep (a /uploads/<id> link)
export type SaveImage = (png: Buffer, name: string) => Promise<string>;
const px = (pt: number) => Math.round((pt * 96) / 72);

const BULLET = /^[•·▪●○◦‣-]$/;
const NUMBERED = /^(\d{1,2}[.)])\s+(?=\S)/;

export async function pdfToHtml(data: Buffer, saveImage?: SaveImage): Promise<{ html: string; warnings: string[] }> {
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { OPS, Util } = await getResolvedPDFJS();
  const lines: Line[] = [];
  const pics: Pic[] = [];
  const warnings: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const pageWidth = page.getViewport({ scale: 1 }).width;
    // where each picture is painted: follow the transformation matrix through the page's drawing operations
    if (saveImage) {
      const ops = await page.getOperatorList();
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = Util.transform(ctm, args as number[]);
        else if (fn === OPS.paintFormXObjectBegin) {
          stack.push(ctm);
          if (Array.isArray(args[0])) ctm = Util.transform(ctm, args[0] as number[]);
        } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.paintImageXObject) {
          const width = Math.hypot(ctm[0], ctm[1]);
          const height = Math.hypot(ctm[2], ctm[3]);
          const mid = ctm[4] + width / 2;
          pics.push({ key: String(args[0]), page: pageNo, y: ctm[5] + height, width, align: mid < pageWidth * 0.4 ? "left" : mid > pageWidth * 0.6 ? "right" : "center" });
        }
      }
      for (const pic of pics.filter((p) => p.page === pageNo && !p.raw)) {
        const img = await new Promise<{ data?: Uint8ClampedArray; width?: number; height?: number } | undefined>((resolve) => (pic.key.startsWith("g_") ? page.commonObjs : page.objs).get(pic.key, resolve));
        if (img?.data && img.width && img.height) pic.raw = { data: img.data, width: img.width, height: img.height, channels: img.data.length / (img.width * img.height) };
      }
    }
    const content = await page.getTextContent();
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
  if (!lines.length && !pics.length) return { html: "", warnings };

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
  // pictures are stored once each, then placed among the lines by their height on the page
  const stored = new Map<string, string>();
  const sharp = pics.length ? (await import("sharp")).default : null;
  for (const p of pics) {
    if (!p.raw || !sharp || !saveImage) continue;
    const k = `${p.page}:${p.key}`;
    if (!stored.has(k)) {
      try {
        const png = await sharp(Buffer.from(p.raw.data), { raw: { width: p.raw.width, height: p.raw.height, channels: p.raw.channels as 1 | 3 | 4 } }).png().toBuffer();
        stored.set(k, await saveImage(png, `pdf-trang-${p.page}`));
      } catch (e) {
        stored.set(k, "");
        warnings.push(`Không lưu được một ảnh ở trang ${p.page}: ${e instanceof Error ? e.message : "lỗi ảnh"}`);
      }
    }
    p.src = stored.get(k) || undefined;
  }
  const seq: (Line | Pic)[] = [];
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const here: (Line | Pic)[] = [...lines.filter((l) => l.page === pg), ...pics.filter((p) => p.page === pg && p.src)];
    here.sort((a, b) => ("key" in b ? b.y : b.y + b.size) - ("key" in a ? a.y : a.y + a.size));
    seq.push(...here);
  }
  seq.forEach((l, i) => {
    if ("key" in l) {
      flush();
      const margin = l.align === "left" ? "margin-left:0;margin-right:auto" : l.align === "right" ? "margin-left:auto;margin-right:0" : "margin-left:auto;margin-right:auto";
      out.push(`<p><img loading="lazy" alt="" src="${l.src}" style="width:${px(l.width)}px;max-width:100%;${margin}" /></p>`);
      return;
    }
    const prev = seq[i - 1] && !("key" in seq[i - 1]) ? (seq[i - 1] as Line) : undefined;
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
  return { html: out.join("\n"), warnings };
}
