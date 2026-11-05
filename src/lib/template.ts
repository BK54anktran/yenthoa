// Templates (mẫu): a piece of HTML with {{placeholders}} plus a schema of fields. Adding a template to the home page makes a form from the
// schema; the values typed there are poured into the HTML. Pure functions only (no browser, no database), so the same code renders the
// page on the server and the preview in the admin.
//
// Placeholders:
//   {{key}}                      the value of a field (text is escaped; an `html` field is inserted as written; image / link are checked)
//   {{#if key}}..{{else}}..{{/if}}   shown when the value is not empty / not false / not 0     ({{#unless key}}..{{/unless}} is the opposite)
//   {{#each list}}..{{/each}}    repeats for every item of a `list` field; inside use the item's own keys, {{@index}} (0, 1, ...) and {{@number}} (1, 2, ...)
//   {{_id}}                      a name unique to this block on the page: put it in every id / class the script uses, so two blocks do not clash
//   {{site.products}} {{site.brands}} {{site.branches}} {{site.hotline}} {{site.name}}   figures from the shop's own data

export type FieldType = "text" | "textarea" | "html" | "image" | "link" | "number" | "color" | "select" | "boolean" | "datetime" | "list";
export const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: "text", label: "Chữ một dòng" },
  { id: "textarea", label: "Chữ nhiều dòng" },
  { id: "html", label: "HTML (nội dung có định dạng)" },
  { id: "image", label: "Ảnh" },
  { id: "link", label: "Đường dẫn" },
  { id: "number", label: "Số" },
  { id: "color", label: "Màu" },
  { id: "select", label: "Chọn một trong các mục" },
  { id: "boolean", label: "Bật / tắt" },
  { id: "datetime", label: "Ngày giờ" },
  { id: "list", label: "Danh sách (nhiều dòng lặp lại)" },
];

export type FieldValue = string | number | boolean | Record<string, string | number | boolean>[];
export type TemplateField = {
  key: string;
  label: string;
  type: FieldType;
  default?: string | number | boolean | Record<string, string | number | boolean>[];
  options?: { value: string; label: string }[]; // select
  fields?: TemplateField[]; // list: what each item holds (no nested lists)
  max?: number; // list: most items
  hint?: string;
};
export type Template = { id: string; name: string; description: string; html: string; fields: TemplateField[]; builtIn?: boolean };
export type TemplateValues = Record<string, FieldValue>;

export const TEMPLATES_KEY = "templates";
export const MAX_TEMPLATES = 60;
export const MAX_FIELDS = 40;
export const MAX_SUBFIELDS = 12;
export const MAX_LIST_ITEMS = 50;
export const MAX_TEMPLATE_HTML = 200_000;
export const MAX_RENDER = 500_000;
const KEY = /^[a-z][a-z0-9_]{0,30}$/;
const RESERVED = new Set(["site", "this", "index", "number"]);

// ---------- checks ----------
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export const safeLink = (s: string) => (/^(\/(?!\/)|#|https?:\/\/|tel:|mailto:)/i.test(s.trim()) && !/[\u0000-\u001f\s]/.test(s.trim()) ? s.trim() : "");
const safeImage = (s: string) => (/^(\/(?!\/)|https:\/\/)/i.test(s.trim()) && !/[\u0000-\u001f\s]/.test(s.trim()) ? s.trim() : "");
const safeColor = (s: string) => (/^#[0-9a-f]{3,8}$/i.test(s.trim()) ? s.trim() : "");

// ---------- schema from JSON (typed in the admin, imported, or produced by the prompt) ----------
function parseField(raw: unknown, where: string, inList: boolean): { error: string } | { field: TemplateField } {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return { error: `${where}: không phải một trường hợp lệ.` };
  const key = String(r.key ?? "").trim();
  if (!KEY.test(key) || RESERVED.has(key)) return { error: `${where}: tên trường "${key}" không hợp lệ (chữ thường không dấu, số, gạch dưới, bắt đầu bằng chữ, tối đa 31 ký tự; không dùng "site", "this", "index", "number").` };
  const type = String(r.type ?? "text") as FieldType;
  if (!FIELD_TYPES.some((t) => t.id === type)) return { error: `${where}: kiểu "${type}" không có. Dùng một trong: ${FIELD_TYPES.map((t) => t.id).join(", ")}.` };
  if (type === "list" && inList) return { error: `${where}: danh sách không được nằm trong danh sách.` };
  const field: TemplateField = { key, label: String(r.label ?? key).trim().slice(0, 80) || key, type };
  if (typeof r.hint === "string" && r.hint.trim()) field.hint = r.hint.trim().slice(0, 200);
  if (type === "select") {
    const opts = Array.isArray(r.options) ? r.options : [];
    field.options = opts
      .map((o) => (typeof o === "string" ? { value: o, label: o } : { value: String((o as { value?: unknown })?.value ?? ""), label: String((o as { label?: unknown })?.label ?? (o as { value?: unknown })?.value ?? "") }))
      .filter((o) => o.value)
      .slice(0, 30)
      .map((o) => ({ value: o.value.slice(0, 80), label: o.label.slice(0, 80) }));
    if (field.options.length === 0) return { error: `${where}: trường chọn "${key}" cần ít nhất một mục trong "options".` };
  }
  if (type === "list") {
    const subs = Array.isArray(r.fields) ? r.fields : [];
    if (subs.length === 0 || subs.length > MAX_SUBFIELDS) return { error: `${where}: danh sách "${key}" cần từ 1 đến ${MAX_SUBFIELDS} trường con trong "fields".` };
    field.fields = [];
    for (const [i, s] of subs.entries()) {
      const p = parseField(s, `${where} > ${key} > trường ${i + 1}`, true);
      if ("error" in p) return p;
      if (field.fields.some((x) => x.key === p.field.key)) return { error: `${where}: trùng tên trường "${p.field.key}" trong danh sách "${key}".` };
      field.fields.push(p.field);
    }
    field.max = Math.min(MAX_LIST_ITEMS, Math.max(1, Math.round(Number(r.max) || 12)));
  }
  if (r.default !== undefined && r.default !== null) {
    if (type === "list") field.default = Array.isArray(r.default) ? (r.default as Record<string, string | number | boolean>[]).slice(0, field.max).map((it) => (it && typeof it === "object" ? it : {})) : [];
    else if (type === "boolean") field.default = r.default === true || r.default === "true";
    else if (type === "number") field.default = Number(r.default) || 0;
    else field.default = String(r.default).slice(0, type === "html" ? 20_000 : 2000);
  }
  return { field };
}

export function parseTemplateJson(raw: unknown): { error: string } | { template: Omit<Template, "id" | "builtIn"> } {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || Array.isArray(r)) return { error: "JSON phải là một đối tượng có name, html, fields." };
  const name = String(r.name ?? "").trim().slice(0, 80);
  if (!name) return { error: 'Thiếu "name" (tên mẫu).' };
  const html = String(r.html ?? "");
  if (!html.trim()) return { error: 'Thiếu "html" (nội dung mẫu).' };
  if (html.length > MAX_TEMPLATE_HTML) return { error: `HTML dài quá ${MAX_TEMPLATE_HTML / 1000}k ký tự.` };
  const rawFields = Array.isArray(r.fields) ? r.fields : [];
  if (rawFields.length > MAX_FIELDS) return { error: `Tối đa ${MAX_FIELDS} trường.` };
  const fields: TemplateField[] = [];
  for (const [i, f] of rawFields.entries()) {
    const p = parseField(f, `Trường ${i + 1}`, false);
    if ("error" in p) return p;
    if (fields.some((x) => x.key === p.field.key)) return { error: `Trùng tên trường "${p.field.key}".` };
    fields.push(p.field);
  }
  return { template: { name, description: String(r.description ?? "").trim().slice(0, 300), html, fields } };
}

// which {{placeholders}} the html uses that no field (or built-in name) provides: shown as a warning, never blocks saving
export function unknownPlaceholders(html: string, fields: TemplateField[]): string[] {
  const known = new Set(["_id", "@index", "@number", "else", ...fields.map((f) => f.key)]);
  const lists = new Map(fields.filter((f) => f.type === "list").map((f) => [f.key, new Set((f.fields ?? []).map((x) => x.key))]));
  const out = new Set<string>();
  let inside: Set<string> | null = null;
  for (const m of html.matchAll(/\{\{\s*(#each|#if|#unless|\/each|\/if|\/unless)?\s*([@\w.]*)\s*\}\}/g)) {
    const [, op, name] = m;
    if (op === "#each") {
      inside = lists.get(name) ?? null;
      if (!lists.has(name)) out.add(name);
      continue;
    }
    if (op === "/each") {
      inside = null;
      continue;
    }
    if (!name || op?.startsWith("/")) continue;
    if (name.startsWith("site.") && ["products", "brands", "branches", "hotline", "name"].includes(name.slice(5))) continue;
    if (!known.has(name) && !inside?.has(name)) out.add(name);
  }
  return [...out];
}

// ---------- values ----------
const emptyFor = (f: TemplateField): FieldValue => (f.type === "boolean" ? false : f.type === "number" ? 0 : f.type === "list" ? [] : "");
export function defaultValues(fields: TemplateField[]): TemplateValues {
  const v: TemplateValues = {};
  for (const f of fields) v[f.key] = (f.default as FieldValue | undefined) ?? (f.type === "select" ? f.options?.[0]?.value ?? "" : emptyFor(f));
  return v;
}

// ---------- the engine ----------
type Node =
  | { t: "text"; v: string }
  | { t: "var"; key: string }
  | { t: "if"; key: string; neg: boolean; body: Node[]; other: Node[] }
  | { t: "each"; key: string; body: Node[] };

const TAG = /\{\{\s*(#if|#unless|#each|\/if|\/unless|\/each|else)?\s*([@\w.]*)\s*\}\}/g;

export function parseTemplate(source: string): Node[] {
  // {{{key}}} (the habit from other template languages) means the same as {{key}}: only an `html` field is ever inserted unescaped
  const src = source.replace(/\{\{\{\s*([@\w.]+)\s*\}\}\}/g, "{{$1}}");
  const root: Node[] = [];
  const stack: { node: Node & { t: "if" | "each" }; into: Node[]; inElse: boolean }[] = [];
  let out = root;
  let last = 0;
  const push = (n: Node) => out.push(n);
  for (const m of src.matchAll(TAG)) {
    if (m.index! > last) push({ t: "text", v: src.slice(last, m.index) });
    last = m.index! + m[0].length;
    const [, op, name] = m;
    if (op === "#if" || op === "#unless") {
      const node = { t: "if" as const, key: name, neg: op === "#unless", body: [] as Node[], other: [] as Node[] };
      push(node);
      stack.push({ node, into: out, inElse: false });
      out = node.body;
    } else if (op === "#each") {
      const node = { t: "each" as const, key: name, body: [] as Node[] };
      push(node);
      stack.push({ node, into: out, inElse: false });
      out = node.body;
    } else if (op === "else") {
      const top = stack[stack.length - 1];
      if (top && top.node.t === "if" && !top.inElse) {
        top.inElse = true;
        out = top.node.other;
      } else push({ t: "text", v: m[0] });
    } else if (op === "/if" || op === "/unless" || op === "/each") {
      const top = stack[stack.length - 1];
      const want = op === "/each" ? "each" : "if";
      if (top && top.node.t === want) {
        stack.pop();
        out = top.into;
      } else push({ t: "text", v: m[0] });
    } else if (name) push({ t: "var", key: name });
    else push({ t: "text", v: m[0] });
  }
  if (last < src.length) push({ t: "text", v: src.slice(last) });
  return root; // blocks left open simply end where the text ends
}

export type SiteFacts = { products: number; brands: number; branches: number; hotline: string; name: string };
type Frame = { values: Record<string, unknown>; fields: TemplateField[]; index?: number };

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "number" ? v !== 0 : typeof v === "string" ? v.trim() !== "" : !!v);

function lookup(key: string, frames: Frame[], site: SiteFacts, id: string): { value: unknown; field?: TemplateField } {
  if (key === "_id") return { value: id, field: { key, label: key, type: "text" } };
  if (key.startsWith("site.")) {
    const v = site[key.slice(5) as keyof SiteFacts];
    return { value: v ?? "", field: { key, label: key, type: "text" } };
  }
  const top = frames[frames.length - 1];
  if (key === "@index") return { value: top?.index ?? 0, field: { key, label: key, type: "number" } };
  if (key === "@number") return { value: (top?.index ?? 0) + 1, field: { key, label: key, type: "number" } };
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i].fields.find((x) => x.key === key);
    if (f) return { value: frames[i].values[key], field: f };
  }
  return { value: "" };
}

function show(value: unknown, field?: TemplateField): string {
  if (value === undefined || value === null) return "";
  switch (field?.type) {
    case "html":
      return String(value);
    case "image":
      return escapeHtml(safeImage(String(value)));
    case "link":
      return escapeHtml(safeLink(String(value)));
    case "color":
      return escapeHtml(safeColor(String(value)));
    case "boolean":
      return value ? "true" : "";
    case "list":
      return "";
    default:
      return escapeHtml(String(value));
  }
}

function run(nodes: Node[], frames: Frame[], site: SiteFacts, id: string, depth: number): string {
  if (depth > 8) return "";
  let out = "";
  for (const n of nodes) {
    if (n.t === "text") out += n.v;
    else if (n.t === "var") {
      const { value, field } = lookup(n.key, frames, site, id);
      out += show(value, field);
    } else if (n.t === "if") {
      const { value } = lookup(n.key, frames, site, id);
      out += run(truthy(value) !== n.neg ? n.body : n.other, frames, site, id, depth + 1);
    } else {
      const { value, field } = lookup(n.key, frames, site, id);
      const items = Array.isArray(value) ? value : [];
      items.slice(0, field?.max ?? MAX_LIST_ITEMS).forEach((item, index) => {
        out += run(n.body, [...frames, { values: (item ?? {}) as Record<string, unknown>, fields: field?.fields ?? [], index }], site, id, depth + 1);
      });
    }
    if (out.length > MAX_RENDER) return out.slice(0, MAX_RENDER);
  }
  return out;
}

// the page's HTML for one block: values missing from the block fall back to the field's default
export function renderTemplate(t: Pick<Template, "html" | "fields">, values: TemplateValues | undefined, site: SiteFacts, blockId: string): string {
  const merged: Record<string, unknown> = { ...defaultValues(t.fields), ...(values ?? {}) };
  const id = `t-${blockId.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "x"}`;
  return run(parseTemplate(t.html), [{ values: merged, fields: t.fields }], site, id, 0);
}

// what the admin's form saves: each value is brought to its field's type, anything not in the schema is dropped
export function cleanValues(
  fields: TemplateField[],
  raw: unknown,
  tools: { html: (s: string) => string; image: (s: string) => string | null; link: (s: string) => string | null },
): { error: string } | { values: TemplateValues } {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const values: TemplateValues = {};
  const one = (f: TemplateField, v: unknown, where: string): { error: string } | { value: string | number | boolean } => {
    switch (f.type) {
      case "number": {
        const n = Number(v);
        return { value: Number.isFinite(n) ? n : 0 };
      }
      case "boolean":
        return { value: v === true || v === "true" };
      case "html":
        return { value: tools.html(String(v ?? "").slice(0, 100_000)) };
      case "textarea":
        return { value: String(v ?? "").slice(0, 5000) };
      case "image": {
        const s = String(v ?? "").trim().slice(0, 500);
        return tools.image(s) === null ? { error: `${where}: ảnh phải bắt đầu bằng / hoặc https://` } : { value: s };
      }
      case "link": {
        const s = String(v ?? "").replace(/[\u0000-\u001f\s]/g, "").slice(0, 500);
        return tools.link(s) === null ? { error: `${where}: đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` } : { value: s };
      }
      case "color":
        return { value: safeColor(String(v ?? "")) };
      case "select": {
        const s = String(v ?? "");
        return { value: f.options?.some((o) => o.value === s) ? s : f.options?.[0]?.value ?? "" };
      }
      case "datetime":
        return { value: String(v ?? "").trim().slice(0, 40) };
      default:
        return { value: String(v ?? "").slice(0, 500) };
    }
  };
  for (const f of fields) {
    if (f.type === "list") {
      const items = Array.isArray(src[f.key]) ? (src[f.key] as unknown[]).slice(0, f.max ?? 12) : [];
      const list: Record<string, string | number | boolean>[] = [];
      for (const [i, it] of items.entries()) {
        const obj: Record<string, string | number | boolean> = {};
        for (const sf of f.fields ?? []) {
          const r = one(sf, (it as Record<string, unknown>)?.[sf.key], `${f.label} ${i + 1} > ${sf.label}`);
          if ("error" in r) return r;
          obj[sf.key] = r.value;
        }
        list.push(obj);
      }
      values[f.key] = list;
    } else {
      const r = one(f, src[f.key], f.label);
      if ("error" in r) return r;
      values[f.key] = r.value;
    }
  }
  return { values };
}
