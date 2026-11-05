import JSZip from "jszip";

// Mammoth turns a Word file into plain HTML and drops what makes a page look designed: text colours, the background of a table
// cell or a boxed paragraph, highlighted text, alignment, and the size a picture has on the page.
// This reads those straight from the .docx (a zip of XML files) and hands them to the HTML in two ways:
//  - a coloured / highlighted run gets a character style of its own, which a style map turns into <span class="dc-...">;
//  - a table cell or a paragraph with a background, border or alignment gets a marker (private-use characters) as its first text,
//    which applyFormat() turns into a style="..." on the <td> / <p> and removes.
// Best effort: when something in the file looks unusual, the caller falls back to the file as it was.
const EMU_PER_PX = 9525;
const OPEN = "";
const CLOSE = "";

export type DocxImage = { width: number; align: "left" | "center" | "right" };
export type DocxFormat = { data: Buffer; styles: string[]; images: DocxImage[] };

const HIGHLIGHT: Record<string, string> = {
  yellow: "FFFF00", green: "00FF00", cyan: "00FFFF", magenta: "FF00FF", blue: "0000FF", red: "FF0000", darkBlue: "000080", darkCyan: "008080",
  darkGreen: "008000", darkMagenta: "800080", darkRed: "800000", darkYellow: "808000", darkGray: "808080", lightGray: "D3D3D3", black: "000000",
};
const hexOf = (v: string | undefined): string | null => (v && /^[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null);
const lum = (hex: string) => {
  const n = parseInt(hex, 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const isDark = (hex: string | null) => !!hex && lum(hex) < 0.5;
// black is the normal ink and near white would vanish on the page's white ground (unless the text sits on a dark background)
const usableColor = (hex: string | null, onDark: boolean): string | null => (hex && (onDark || (hex !== "000000" && lum(hex) <= 0.85)) ? hex : null);

const runStyleName = (color: string | null, bg: string | null) => `Docx Fmt ${color ?? "none"} ${bg ?? "none"}`;
const runStyleId = (color: string | null, bg: string | null) => `DocxFmt_${color ?? "none"}_${bg ?? "none"}`;

export async function readDocxFormat(input: Buffer): Promise<DocxFormat> {
  const zip = await JSZip.loadAsync(input);
  const docFile = zip.file("word/document.xml");
  const stylesFile = zip.file("word/styles.xml");
  if (!docFile || !stylesFile) return { data: input, styles: [], images: [] };
  let doc = await docFile.async("string");
  let styles = await stylesFile.async("string");

  // colour of every style, following "based on" up the chain
  const own = new Map<string, { color?: string; base?: string }>();
  for (const m of styles.matchAll(/<w:style\b[^>]*\bw:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    own.set(m[1], { color: /<w:rPr>[\s\S]*?<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(m[2])?.[1], base: /<w:basedOn\b[^>]*\bw:val="([^"]+)"/.exec(m[2])?.[1] });
  }
  const styleColor = (id: string | undefined): string | null => {
    for (let i = 0, cur = id; cur && i < 6; i++, cur = own.get(cur)?.base) {
      const c = hexOf(own.get(cur)?.color);
      if (c) return c;
    }
    return null;
  };

  const used = new Map<string, [string | null, string | null]>();
  const images: DocxImage[] = []; // every picture in document order: its width and where its paragraph sits
  const paraCss = (pPr: string): { css: string; fill: string | null; align: "left" | "center" | "right" } => {
    const fill = hexOf(/<w:shd\b[^>]*\bw:fill="([0-9A-Fa-f]{6})"/.exec(pPr)?.[1]);
    const jc = /<w:jc\b[^>]*\bw:val="(\w+)"/.exec(pPr)?.[1];
    const align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : "left";
    const css: string[] = [];
    const box = /<w:pBdr>([\s\S]*?)<\/w:pBdr>/.exec(pPr)?.[1] ?? "";
    let bordered = false;
    for (const side of ["left", "top", "right", "bottom"] as const) {
      const b = new RegExp(`<w:${side}\\b([^>]*)/?>`).exec(box)?.[1];
      if (!b || /w:val="(nil|none)"/.test(b)) continue;
      const sz = Number(/w:sz="(\d+)"/.exec(b)?.[1] ?? 8);
      const color = hexOf(/w:color="([0-9A-Fa-f]{6})"/.exec(b)?.[1]);
      css.push(`border-${side}:${Math.max(1, Math.round((sz / 8) * 1.333))}px solid ${color ? `#${color}` : "#999"}`);
      bordered = true;
    }
    if (fill) css.push(`background:#${fill}`);
    if (fill || bordered) css.push("padding:12px 16px");
    if (jc === "center" || jc === "right" || jc === "end") css.push(`text-align:${align}`);
    return { css: css.join(";"), fill, align };
  };

  // one pass over the document: table cells (with the paragraphs in them) and the paragraphs outside tables, in order
  const doParagraph = (para: string, cellFill: string | null, cellMarker: string): string => {
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(para)?.[1] ?? "";
    const { css, fill, align } = paraCss(pPr);
    for (const m of para.matchAll(/<w:drawing>[\s\S]*?<wp:extent\b[^>]*\bcx="(\d+)"[\s\S]*?<a:blip\b[^>]*\br:embed="[^"]+"/g)) images.push({ width: Math.round(Number(m[1]) / EMU_PER_PX), align });
    const paraColor = styleColor(/<w:pStyle\b[^>]*\bw:val="([^"]+)"/.exec(pPr)?.[1]);
    const onDark = isDark(fill ?? cellFill);
    let out = para.replace(/(<w:r\b[^>]*>)([\s\S]*?)<\/w:r>/g, (run, open: string, body: string) => {
      if (!/<w:t\b/.test(body)) return run;
      const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body);
      if (rPr && /<w:rStyle\b/.test(rPr[1])) return run; // a run holds one style: keep what it has (links, etc.)
      const hl = rPr ? /<w:highlight\b[^>]*\bw:val="(\w+)"/.exec(rPr[1])?.[1] : undefined;
      const bg = hexOf(hl ? HIGHLIGHT[hl] : rPr ? /<w:shd\b[^>]*\bw:fill="([0-9A-Fa-f]{6})"/.exec(rPr[1])?.[1] : undefined);
      const dark = bg ? isDark(bg) : onDark;
      let color = usableColor(hexOf(rPr ? /<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(rPr[1])?.[1] : undefined) ?? paraColor, dark);
      if (!color && dark) color = "FFFFFF"; // Word draws "automatic" text white on a dark background
      if (!color && !bg) return run;
      used.set(runStyleId(color, bg), [color, bg]);
      const tag = `<w:rStyle w:val="${runStyleId(color, bg)}"/>`;
      return `${open}${rPr ? body.replace("<w:rPr>", `<w:rPr>${tag}`) : `<w:rPr>${tag}</w:rPr>${body}`}</w:r>`;
    });
    const marker = `${cellMarker}${css ? `${OPEN}P:${css}${CLOSE}` : ""}`;
    if (marker && /<w:t\b/.test(out)) {
      const run = `<w:r><w:t xml:space="preserve">${marker}</w:t></w:r>`;
      out = pPr ? out.replace(/<\/w:pPr>/, `</w:pPr>${run}`) : out.replace(/^(<w:p\b[^>]*>)/, `$1${run}`);
    }
    return out;
  };

  doc = doc.replace(/(<w:tc\b[^>]*>[\s\S]*?<\/w:tc>)|(<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g, (all, cell: string | undefined, para: string | undefined) => {
    if (para) return doParagraph(para, null, "");
    const fill = hexOf(/<w:tcPr>[\s\S]*?<w:shd\b[^>]*\bw:fill="([0-9A-Fa-f]{6})"/.exec(cell ?? "")?.[1]);
    let first = true;
    return (cell ?? all).replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (p) => {
      const hasText = /<w:t\b/.test(p);
      const marker = fill && first && hasText ? `${OPEN}C:background:#${fill}${CLOSE}` : "";
      if (hasText) first = false;
      return doParagraph(p, fill, marker);
    });
  });

  if (used.size) {
    const defs = [...used].map(([id, [c, b]]) => `<w:style w:type="character" w:customStyle="1" w:styleId="${id}"><w:name w:val="${runStyleName(c, b)}"/><w:basedOn w:val="DefaultParagraphFont"/></w:style>`).join("");
    styles = styles.replace("</w:styles>", `${defs}</w:styles>`);
  }
  const changed = used.size > 0 || doc !== (await docFile.async("string"));
  if (!changed) return { data: input, styles: [], images };
  zip.file("word/document.xml", doc);
  zip.file("word/styles.xml", styles);
  return { data: await zip.generateAsync({ type: "nodebuffer" }), styles: [...used.values()].map(([c, b]) => `${c ?? "none"}_${b ?? "none"}`), images };
}

export const colorStyleMap = (styles: string[]): string[] =>
  styles.map((s) => {
    const [c, b] = s.split("_");
    return `r[style-name='${runStyleName(c === "none" ? null : c, b === "none" ? null : b)}'] => span.dc-${s}`;
  });

// the page gives <strong> a colour of its own, which would hide the colour of the <span> around it: put the style on the <strong> itself
const spanStyle = (c: string, b: string) => `${c !== "none" ? `color:#${c};` : ""}${b !== "none" ? `background:#${b};padding:0 2px` : ""}`.replace(/;$/, "");

export function applyFormat(html: string): string {
  return html
    .replace(/<span class="dc-([0-9A-F]{6}|none)_([0-9A-F]{6}|none)">(<strong>[\s\S]*?<\/strong>)<\/span>/g, (_m, c: string, b: string, strong: string) => strong.replace("<strong>", `<strong style="${spanStyle(c, b)}">`))
    .replace(/<span class="dc-([0-9A-F]{6}|none)_([0-9A-F]{6}|none)">/g, (_m, c: string, b: string) => `<span style="${spanStyle(c, b)}">`)
    .replace(new RegExp(`<(td|th)([^>]*)><(\\w+)>${OPEN}C:([^${CLOSE}]*)${CLOSE}`, "g"), '<$1$2 style="$4"><$3>')
    .replace(new RegExp(`<(p|h[1-6]|li|blockquote)>${OPEN}P:([^${CLOSE}]*)${CLOSE}`, "g"), '<$1 style="$2">')
    .replace(new RegExp(`${OPEN}[^${CLOSE}]*${CLOSE}`, "g"), "");
}
