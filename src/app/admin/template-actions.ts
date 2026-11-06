"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { deleteTemplate, duplicateTemplate, saveTemplate } from "@/lib/admin-service";

export type TemplateFormState = { error?: string; saved?: boolean };

const refresh = () => revalidatePath("/", "layout");

// saves the editor's whole template; no id = a new template
export async function saveTemplateAction(_: TemplateFormState, f: FormData): Promise<TemplateFormState> {
  await assertAdmin();
  const isNew = !String(f.get("id") ?? "").trim();
  const r = await saveTemplate(f);
  if ("error" in r) return { error: r.error };
  refresh();
  if (isNew) redirect(`/admin/mau/${r.id}`);
  return { saved: true };
}

// a copy of any template (also of the ones that come with the site) that can be edited
export async function duplicateTemplateAction(f: FormData) {
  await assertAdmin();
  const r = await duplicateTemplate(String(f.get("id") ?? ""));
  if ("error" in r) return;
  refresh();
  redirect(`/admin/mau/${r.id}`);
}

// deleting is refused while a block on the home page still uses the template
export async function deleteTemplateAction(_: TemplateFormState, f: FormData): Promise<TemplateFormState> {
  await assertAdmin();
  const r = await deleteTemplate(String(f.get("id") ?? ""));
  if ("error" in r) return { error: r.error };
  refresh();
  return { saved: true };
}
