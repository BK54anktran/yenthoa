"use client";

import type { TemplateField, TemplateValues } from "@/lib/template";
import { btnGhost, inputCls } from "./ui";
import { HtmlEditor } from "./HtmlEditor";
import { ImageInput } from "./ImageInput";

type Item = Record<string, string | number | boolean>;
type Update = (fn: (cur: TemplateValues) => TemplateValues) => void;

// One input for one field of a template, by its type. `value` and `set` work on a single value (an item of a list uses the same inputs).
function FieldInput({ f, value, set, idKey }: { f: TemplateField; value: unknown; set: (v: string | number | boolean) => void; idKey: string }) {
  switch (f.type) {
    case "textarea":
      return <textarea aria-label={f.label} value={String(value ?? "")} onChange={(e) => set(e.target.value)} rows={3} maxLength={5000} className={inputCls} />;
    case "html":
      return <HtmlEditor key={idKey} defaultValue={String(value ?? "")} onChange={set} rows={6} />;
    case "image":
      return <ImageInput value={String(value ?? "")} onChange={set} />;
    case "link":
      return <input aria-label={f.label} value={String(value ?? "")} onChange={(e) => set(e.target.value)} maxLength={500} placeholder="/xe-may, /tin-tuc/..., https://..., tel:0789619698" className={inputCls} />;
    case "number":
      return <input aria-label={f.label} type="number" step="any" value={String(value ?? 0)} onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))} className={inputCls} />;
    case "color":
      return (
        <div className="flex gap-2">
          <input aria-label={`${f.label} (chọn màu)`} type="color" value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#000000"} onChange={(e) => set(e.target.value)} className="h-10 w-14 border border-neutral-300 bg-white p-1" />
          <input aria-label={f.label} value={String(value ?? "")} onChange={(e) => set(e.target.value)} maxLength={9} placeholder="#de0000" className={inputCls} />
        </div>
      );
    case "select":
      return (
        <select aria-label={f.label} value={String(value ?? "")} onChange={(e) => set(e.target.value)} className="h-10 w-full border border-neutral-300 bg-white px-2 text-sm">
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} className="size-4 accent-[#de0000]" /> Bật
        </label>
      );
    case "datetime":
      return <input aria-label={f.label} type="datetime-local" value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={inputCls} />;
    default:
      return <input aria-label={f.label} value={String(value ?? "")} onChange={(e) => set(e.target.value)} maxLength={500} className={inputCls} />;
  }
}

// The form made from a template's fields. Every change is made on the latest values (`update` takes a function), because a picture
// that finishes uploading late must not undo what was typed meanwhile.
export function TemplateValuesForm({ fields, values, update, idKey }: { fields: TemplateField[]; values: TemplateValues; update: Update; idKey: string }) {
  const setTop = (key: string, v: string | number | boolean) => update((cur) => ({ ...cur, [key]: v }));
  return (
    <div className="space-y-4">
      {fields.length === 0 && <p className="text-sm text-neutral-500">Mẫu này không có ô nào để sửa.</p>}
      {fields.map((f) => (
        <div key={f.key}>
          <p className="mb-1 text-xs font-semibold text-neutral-600">{f.label}</p>
          {f.type === "list" ? (
            <div className="space-y-2">
              {((values[f.key] as Item[] | undefined) ?? []).map((item, i) => (
                <div key={i} className="border border-neutral-200 p-3">
                  <div className="grid items-start gap-3 md:grid-cols-2">
                    {f.fields?.map((sf) => (
                      <div key={sf.key} className={sf.type === "html" || sf.type === "textarea" ? "md:col-span-2" : ""}>
                        <p className="mb-1 text-xs text-neutral-500">{sf.label}</p>
                        <FieldInput
                          f={sf}
                          value={item[sf.key]}
                          idKey={`${idKey}-${f.key}-${i}-${sf.key}`}
                          set={(v) => update((cur) => ({ ...cur, [f.key]: ((cur[f.key] as Item[] | undefined) ?? []).map((x, j) => (j === i ? { ...x, [sf.key]: v } : x)) }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={i === 0} onClick={() => update((cur) => { const l = [...((cur[f.key] as Item[] | undefined) ?? [])]; if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...cur, [f.key]: l }; })} className={btnGhost}>Lên</button>
                    <button type="button" onClick={() => update((cur) => { const l = [...((cur[f.key] as Item[] | undefined) ?? [])]; if (i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...cur, [f.key]: l }; })} className={btnGhost}>Xuống</button>
                    <button type="button" onClick={() => update((cur) => ({ ...cur, [f.key]: ((cur[f.key] as Item[] | undefined) ?? []).filter((_, j) => j !== i) }))} className={btnGhost}>Xoá</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={((values[f.key] as Item[] | undefined) ?? []).length >= (f.max ?? 12)}
                onClick={() => update((cur) => ({ ...cur, [f.key]: [...((cur[f.key] as Item[] | undefined) ?? []), Object.fromEntries((f.fields ?? []).map((sf) => [sf.key, sf.type === "boolean" ? false : sf.type === "number" ? 0 : sf.type === "select" ? sf.options?.[0]?.value ?? "" : ""]))] }))}
                className={btnGhost}
              >
                + Thêm dòng ({((values[f.key] as Item[] | undefined) ?? []).length}/{f.max ?? 12})
              </button>
            </div>
          ) : (
            <FieldInput f={f} value={values[f.key]} idKey={`${idKey}-${f.key}`} set={(v) => setTop(f.key, v)} />
          )}
          {f.hint && <p className="mt-1 text-xs text-neutral-500">{f.hint}</p>}
        </div>
      ))}
    </div>
  );
}
