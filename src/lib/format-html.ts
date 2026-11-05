// Lays out HTML that came as one long line (a Facebook post, a pasted page) as indented lines, one block tag per line.
// Only the white space BETWEEN block tags changes. Text, inline tags (<a>, <b>, <img>...), and the inside of <script>, <style>,
// <pre> and <textarea> are kept exactly as they are, so the page looks the same.
const BLOCK = new Set("address article aside blockquote body caption details div dl dt dd fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p section table tbody td tfoot th thead tr ul".split(" "));
const VOID_BLOCK = new Set(["hr"]);
const RAW = "script|style|pre|textarea";
const TOKEN = new RegExp(`<!--[\\s\\S]*?-->|<(${RAW})\\b[^>]*>[\\s\\S]*?</\\1\\s*>|</?[a-zA-Z][^>]*>|[^<]+|<`, "gi");

type Tok = { text: string; kind: "open" | "close" | "void" | "raw" | "inline"; name: string };

function tokenize(html: string): Tok[] {
  return (html.match(TOKEN) ?? []).map((text): Tok => {
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(text);
    if (new RegExp(`^<(${RAW})\\b`, "i").test(text) || text.startsWith("<!--")) return { text, kind: "raw", name: "" };
    if (!tag) return { text, kind: "inline", name: "" };
    const name = tag[2].toLowerCase();
    if (!BLOCK.has(name)) return { text, kind: "inline", name };
    if (VOID_BLOCK.has(name) || /\/\s*>$/.test(text)) return { text, kind: "void", name };
    return { text, kind: tag[1] ? "close" : "open", name };
  });
}

export function formatHtml(html: string, unit = "  "): string {
  const toks = tokenize(html);
  const lines: string[] = [];
  let indent = 0;
  let line = "";
  const flush = () => {
    const t = line.trim();
    if (t) lines.push(unit.repeat(Math.max(0, indent)) + t);
    line = "";
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === "open") {
      // a block that holds no other block (a paragraph of text) stays on one line
      let depth = 1;
      let j = i + 1;
      let simple = true;
      for (; j < toks.length && depth > 0; j++) {
        const u = toks[j];
        if (u.kind === "open" || u.kind === "void") simple = false;
        if (u.kind === "open" && u.name === t.name) depth++;
        if (u.kind === "close") {
          if (u.name === t.name) depth--;
          else simple = false;
        }
      }
      flush();
      if (simple && depth === 0) {
        line = toks.slice(i, j).map((u) => u.text).join("");
        flush();
        i = j - 1;
      } else {
        line = t.text;
        flush();
        indent++;
      }
    } else if (t.kind === "close") {
      flush();
      indent--;
      line = t.text;
      flush();
    } else if (t.kind === "void") {
      flush();
      line = t.text;
      flush();
    } else if (t.kind === "raw") {
      flush();
      line = t.text;
      flush();
    } else {
      line += t.text;
    }
  }
  flush();
  return lines.join("\n");
}

// Used by the editor without being asked: it only lays out HTML that is still one long line, and leaves alone HTML that
// the shop already broke into lines or that lays things side by side (a new line between such tags would open a gap).
export function tidyHtml(html: string): string {
  if (html.length < 200 || /display\s*:\s*inline|float\s*:/i.test(html)) return html;
  if (html.split("\n").length >= Math.ceil(html.length / 400)) return html;
  return formatHtml(html);
}
