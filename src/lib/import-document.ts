import { addImage } from "./media.ts";

// Turns an uploaded Word (.docx) or PDF file into HTML for the HTML fields of the admin.
// Word keeps its headings, lists, tables, bold/italic and links; every picture inside it is stored in the image manager
// and the <img> keeps only its /uploads/<id> link. A PDF gives its text (one <p> per paragraph); its layout is not kept.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A PDF only says where each line ends, not where a paragraph does: a line that ends a sentence (or is short) closes its paragraph,
// any other line continues into the next one.
function paragraphsOf(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const raw of text.normalize("NFC").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur = cur ? `${cur} ${line}` : line;
    if (/[.!?:;…]$/.test(line) || line.length < 45) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type ImportedDocument = { html: string; warnings: string[] };

export async function documentToHtml(data: Buffer, fileName: string): Promise<ImportedDocument> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const warnings: string[] = [];
    const result = await mammoth.convertToHtml(
      { buffer: data },
      {
        // a picture that cannot be stored is left out and reported, never dropped silently
        convertImage: mammoth.images.imgElement(async (image) => {
          try {
            if (/emf|wmf/i.test(image.contentType)) throw new Error("Word lưu ảnh này dạng vẽ (EMF/WMF), trình duyệt không hiển thị được. Hãy dán lại dạng ảnh PNG hoặc JPG.");
            const buf = await image.readAsBuffer();
            return { src: await addImage(buf, `${fileName.replace(/\.docx$/i, "")}.${image.contentType.split("/")[1] ?? "png"}`) };
          } catch (e) {
            warnings.push(e instanceof Error ? e.message : "không lưu được ảnh");
            return { src: "", "data-failed": "1" };
          }
        }),
      },
    );
    const html = result.value.replace(/<img [^>]*data-failed="1"[^>]*>/g, "").replace(/<p>\s*<\/p>/g, "").replace(/<img /g, '<img loading="lazy" ');
    return { html, warnings: [...new Set(warnings)] };
  }
  if (lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    const paragraphs = paragraphsOf(text);
    if (!paragraphs.length) throw new Error("PDF này không có chữ để lấy (có thể là ảnh quét). Hãy chèn từng trang thành ảnh.");
    return { html: paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n"), warnings: [] };
  }
  throw new Error("Chỉ nhận tệp Word (.docx) hoặc PDF.");
}
