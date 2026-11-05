import JSZip from "jszip";

// Mammoth turns a Word file into plain HTML and drops the text colours and the size a picture has on the page.
// This reads both straight from the .docx (a zip of XML files): every coloured run is given a character style of its own
// ("Docx Color 1F4E79") that a style map turns into a <span>, and the width of each picture is listed in document order.
// Best effort: when something in the file looks unusual, the caller falls back to the file as it was.
const EMU_PER_PX = 9525;

export type DocxFormat = { data: Buffer; colors: string[]; imageWidths: number[] };

const colorName = (hex: string) => `Docx Color ${hex}`;
const styleId = (hex: string) => `DocxColor${hex}`;

// black is the normal ink, near white would vanish on the page's white ground
function usable(hex: string | undefined): string | null {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex, 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return hex === "000000" || lum > 0.85 ? null : hex.toUpperCase();
}

export async function readDocxFormat(input: Buffer): Promise<DocxFormat> {
  const zip = await JSZip.loadAsync(input);
  const docFile = zip.file("word/document.xml");
  const stylesFile = zip.file("word/styles.xml");
  if (!docFile || !stylesFile) return { data: input, colors: [], imageWidths: [] };
  let doc = await docFile.async("string");
  let styles = await stylesFile.async("string");

  // colour of every style, following "based on" up the chain
  const own = new Map<string, { color?: string; base?: string }>();
  for (const m of styles.matchAll(/<w:style\b[^>]*\bw:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    own.set(m[1], { color: /<w:rPr>[\s\S]*?<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(m[2])?.[1], base: /<w:basedOn\b[^>]*\bw:val="([^"]+)"/.exec(m[2])?.[1] });
  }
  const styleColor = (id: string | undefined): string | null => {
    for (let i = 0, cur = id; cur && i < 6; i++, cur = own.get(cur)?.base) {
      const c = usable(own.get(cur)?.color);
      if (c) return c;
    }
    return null;
  };

  const used = new Set<string>();
  doc = doc.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const paraColor = styleColor(/<w:pPr>[\s\S]*?<w:pStyle\b[^>]*\bw:val="([^"]+)"/.exec(para)?.[1]);
    return para.replace(/(<w:r\b[^>]*>)([\s\S]*?)<\/w:r>/g, (run, open: string, body: string) => {
      if (!/<w:t\b/.test(body)) return run;
      const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body);
      if (rPr && /<w:rStyle\b/.test(rPr[1])) return run; // a run holds one style: keep what it has (links, etc.)
      const color = usable(rPr ? /<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(rPr[1])?.[1] : undefined) ?? paraColor;
      if (!color) return run;
      used.add(color);
      const tag = `<w:rStyle w:val="${styleId(color)}"/>`;
      return `${open}${rPr ? body.replace("<w:rPr>", `<w:rPr>${tag}`) : `<w:rPr>${tag}</w:rPr>${body}`}</w:r>`;
    });
  });

  const imageWidths = [...doc.matchAll(/<w:drawing>[\s\S]*?<wp:extent\b[^>]*\bcx="(\d+)"[\s\S]*?<a:blip\b[^>]*\br:embed="[^"]+"/g)].map((m) => Math.round(Number(m[1]) / EMU_PER_PX));

  const colors = [...used];
  if (colors.length) {
    const defs = colors.map((c) => `<w:style w:type="character" w:customStyle="1" w:styleId="${styleId(c)}"><w:name w:val="${colorName(c)}"/><w:basedOn w:val="DefaultParagraphFont"/></w:style>`).join("");
    styles = styles.replace("</w:styles>", `${defs}</w:styles>`);
    zip.file("word/document.xml", doc);
    zip.file("word/styles.xml", styles);
  }
  return { data: colors.length ? await zip.generateAsync({ type: "nodebuffer" }) : input, colors, imageWidths };
}

export const colorStyleMap = (colors: string[]): string[] => colors.map((c) => `r[style-name='${colorName(c)}'] => span.dc-${c}`);
// the page gives <strong> a colour of its own, which would hide the colour of the <span> around it: put the colour on the <strong> itself
export const applyColorClasses = (html: string): string =>
  html
    .replace(/<span class="dc-([0-9A-F]{6})">(<strong>[\s\S]*?<\/strong>)<\/span>/g, (_m, c: string, strong: string) => strong.replace("<strong>", `<strong style="color:#${c}">`))
    .replace(/<span class="dc-([0-9A-F]{6})">/g, '<span style="color:#$1">');
