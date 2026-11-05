import { applyFormat, colorStyleMap, readDocxFormat, type DocxFormat } from "./docx-format.ts";
import { addImage } from "./media.ts";

// Turns an uploaded Word (.docx) or PDF file into HTML for the HTML fields of the admin.
// Word keeps its headings, lists, tables, bold/italic and links; every picture inside it is stored in the image manager
// and the <img> keeps only its /uploads/<id> link. A PDF gives its text (one <p> per paragraph); its layout is not kept.

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

// the page centres every picture in a post: put it where Word has it
const MARGIN = { left: "margin-left:0;margin-right:auto", center: "margin-left:auto;margin-right:auto", right: "margin-left:auto;margin-right:0" } as const;

// the title of a post is the page's <h1>, and the page's own style starts at <h2>: Word's headings go one level down
const HEADING_MAP = [
  "p[style-name='Title'] => h2:fresh",
  "p[style-name='heading 1'] => h2:fresh",
  "p[style-name='heading 2'] => h3:fresh",
  "p[style-name='heading 3'] => h4:fresh",
  "p[style-name='heading 4'] => h4:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
];

export type ImportedDocument = { html: string; warnings: string[] };

export async function documentToHtml(data: Buffer, fileName: string): Promise<ImportedDocument> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const warnings: string[] = [];
    // text colours and the size of each picture are not kept by mammoth: read them from the file itself
    const fmt: DocxFormat = await readDocxFormat(data).catch(() => ({ data, styles: [], images: [] }));
    let imageNo = 0;
    const result = await mammoth.convertToHtml(
      { buffer: fmt.data },
      {
        styleMap: [...HEADING_MAP, ...colorStyleMap(fmt.styles)],
        // a picture that cannot be stored is left out and reported, never dropped silently
        convertImage: mammoth.images.imgElement(async (image) => {
          const pic = fmt.images[imageNo++];
          try {
            if (/emf|wmf/i.test(image.contentType)) throw new Error("Word lưu ảnh này dạng vẽ (EMF/WMF), trình duyệt không hiển thị được. Hãy dán lại dạng ảnh PNG hoặc JPG.");
            const buf = await image.readAsBuffer();
            const src = await addImage(buf, `${fileName.replace(/\.docx$/i, "")}.${image.contentType.split("/")[1] ?? "png"}`);
            return pic && pic.width > 0 ? { src, style: `width:${pic.width}px;max-width:100%;${MARGIN[pic.align]}` } : { src };
          } catch (e) {
            warnings.push(e instanceof Error ? e.message : "không lưu được ảnh");
            return { src: "", "data-failed": "1" };
          }
        }),
      },
    );
    const html = applyFormat(result.value).replace(/<img [^>]*data-failed="1"[^>]*>/g, "").replace(/<p>\s*<\/p>/g, "").replace(/<img /g, '<img loading="lazy" ');
    return { html, warnings: [...new Set(warnings)] };
  }
  if (lower.endsWith(".pdf")) {
    const { pdfToHtml } = await import("./pdf-to-html.ts");
    const html = await pdfToHtml(data);
    if (!html) throw new Error("PDF này không có chữ để lấy (có thể là ảnh quét). Hãy chèn từng trang thành ảnh.");
    return { html, warnings: [] };
  }
  throw new Error("Chỉ nhận tệp Word (.docx) hoặc PDF.");
}
