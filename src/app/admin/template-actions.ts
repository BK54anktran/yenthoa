"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { exec } from "@/lib/db";
import { getAllTemplates, getCustomTemplates, getHomeSections } from "@/lib/repo";
import { slugify } from "@/lib/slug";
import { MAX_TEMPLATES, parseTemplateJson, TEMPLATES_KEY, type Template } from "@/lib/template";

export type TemplateFormState = { error?: string; saved?: boolean };

const refresh = () => revalidatePath("/", "layout");
const store = (list: Template[]) =>
  exec("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [TEMPLATES_KEY, JSON.stringify(list.map((t) => ({ id: t.id, name: t.name, description: t.description, html: t.html, fields: t.fields })))]);

// a free id for a new template: tc-<name>, tc-<name>-2, ...
async function freeId(name: string): Promise<string> {
  const all = await getAllTemplates();
  const base = `tc-${slugify(name) || "mau"}`.slice(0, 60);
  let id = base;
  for (let n = 2; all.some((t) => t.id === id); n++) id = `${base}-${n}`;
  return id;
}

// saves the editor's whole template; no id = a new template
export async function saveTemplateAction(_: TemplateFormState, f: FormData): Promise<TemplateFormState> {
  await assertAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(f.get("template") ?? ""));
  } catch {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const p = parseTemplateJson(raw);
  if ("error" in p) return { error: p.error };
  const id = String(f.get("id") ?? "").trim();
  const custom = await getCustomTemplates();
  if (!id) {
    if (custom.length >= MAX_TEMPLATES) return { error: `Tối đa ${MAX_TEMPLATES} mẫu.` };
    const nid = await freeId(p.template.name);
    await store([...custom, { id: nid, ...p.template }]);
    refresh();
    redirect(`/admin/mau/${nid}`);
  }
  if (!custom.some((t) => t.id === id)) return { error: "Không tìm thấy mẫu này (mẫu có sẵn không sửa được, hãy tạo bản sao)." };
  await store(custom.map((t) => (t.id === id ? { id, ...p.template } : t)));
  refresh();
  return { saved: true };
}

// a copy of any template (also of the ones that come with the site) that can be edited
export async function duplicateTemplateAction(f: FormData) {
  await assertAdmin();
  const id = String(f.get("id") ?? "");
  const all = await getAllTemplates();
  const src = all.find((t) => t.id === id);
  const custom = await getCustomTemplates();
  if (!src || custom.length >= MAX_TEMPLATES) return;
  const name = `${src.name} (bản sao)`.slice(0, 80);
  const nid = await freeId(name);
  await store([...custom, { id: nid, name, description: src.description, html: src.html, fields: src.fields }]);
  refresh();
  redirect(`/admin/mau/${nid}`);
}

// deleting is refused while a block on the home page still uses the template
export async function deleteTemplateAction(_: TemplateFormState, f: FormData): Promise<TemplateFormState> {
  await assertAdmin();
  const id = String(f.get("id") ?? "");
  const custom = await getCustomTemplates();
  if (!custom.some((t) => t.id === id)) return { error: "Không tìm thấy mẫu này." };
  const users = (await getHomeSections()).filter((s) => s.kind === "template" && s.templateId === id);
  if (users.length) return { error: `Mẫu đang được dùng ở trang chủ (${users.map((s) => s.name).join(", ")}). Xoá các mục đó trước.` };
  await store(custom.filter((t) => t.id !== id));
  refresh();
  return { saved: true };
}
