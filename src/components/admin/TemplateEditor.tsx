"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveTemplateAction, duplicateTemplateAction, type TemplateFormState } from "@/app/admin/template-actions";
import { defaultValues, FIELD_TYPES, parseTemplateJson, renderTemplate, unknownPlaceholders, type FieldType, type Template, type TemplateField, type TemplateValues } from "@/lib/template";
import { TEMPLATE_PROMPT, TEMPLATE_PROMPT_FILE } from "@/lib/template-prompt";
import { btnCls, btnGhost, inputCls } from "./ui";
import { TemplateValuesForm } from "./TemplateValuesForm";

type Tab = "html" | "fields" | "json" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "html", label: "Giao diện (HTML)" },
  { id: "fields", label: "Ô nhập" },
  { id: "json", label: "JSON" },
  { id: "preview", label: "Xem thử" },
];

const SITE = { products: 64, brands: 8, branches: 3, hotline: "0789.619.698", name: "Cửa hàng" };
const newField = (): TemplateField => ({ key: "", label: "", type: "text" });

export function downloadPrompt() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_PROMPT], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_PROMPT_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

// one field of the schema (and, for a list, the fields of its items)
function FieldRow({ f, onChange, onMove, onRemove, first, last, nested }: { f: TemplateField; onChange: (p: Partial<TemplateField>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean; nested?: boolean }) {
  const setSub = (i: number, p: Partial<TemplateField>) => onChange({ fields: (f.fields ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const optionsText = (f.options ?? []).map((o) => (o.value === o.label ? o.value : `${o.value} | ${o.label}`)).join("\n");
  return (
    <div className={`border border-neutral-200 p-3 ${nested ? "bg-neutral-50" : ""}`}>
      <div className="grid items-start gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <input aria-label="Tên trường (key)" placeholder="key: tieu_de" value={f.key} onChange={(e) => onChange({ key: e.target.value })} maxLength={31} className={`${inputCls} font-mono`} />
        <input aria-label="Nhãn hiện ở ô nhập" placeholder="Nhãn: Tiêu đề" value={f.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} className={inputCls} />
        <select
          aria-label="Kiểu"
          value={f.type}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            onChange({ type, ...(type === "list" ? { fields: f.fields?.length ? f.fields : [newField()], max: f.max ?? 12 } : {}), ...(type === "select" && !f.options?.length ? { options: [{ value: "a", label: "A" }] } : {}) });
          }}
          className="h-10 border border-neutral-300 bg-white px-2 text-sm"
        >
          {FIELD_TYPES.filter((t) => !(nested && t.id === "list")).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
        {f.type !== "list" && f.type !== "boolean" && f.type !== "select" && (
          <input aria-label="Giá trị mặc định" placeholder="Mặc định (nội dung gốc)" value={String(f.default ?? "")} onChange={(e) => onChange({ default: f.type === "number" ? Number(e.target.value) || 0 : e.target.value })} className={inputCls} />
        )}
        {f.type === "boolean" && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.default === true} onChange={(e) => onChange({ default: e.target.checked })} className="size-4 accent-[#de0000]" /> Mặc định bật</label>
        )}
        {f.type === "select" && (
          <textarea
            aria-label="Các mục chọn"
            placeholder={"Mỗi dòng một mục: giá_trị | Nhãn"}
            value={optionsText}
            rows={3}
            onChange={(e) => {
              const options = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [v, ...r] = l.split("|"); const value = v.trim(); return { value, label: r.join("|").trim() || value }; });
              onChange({ options, default: options.some((o) => o.value === f.default) ? f.default : options[0]?.value });
            }}
            className={`${inputCls} font-mono`}
          />
        )}
        <input aria-label="Gợi ý" placeholder="Gợi ý dưới ô nhập (không bắt buộc)" value={f.hint ?? ""} onChange={(e) => onChange({ hint: e.target.value })} maxLength={200} className={inputCls} />
      </div>
      {f.type === "list" && (
        <div className="mt-3 space-y-2 border-l-4 border-neutral-300 pl-3">
          <p className="text-xs font-semibold text-neutral-600">Mỗi dòng của danh sách gồm các trường:</p>
          {(f.fields ?? []).map((sf, i) => (
            <FieldRow
              key={i}
              nested
              f={sf}
              first={i === 0}
              last={i === (f.fields?.length ?? 1) - 1}
              onChange={(p) => setSub(i, p)}
              onMove={(d) => { const l = [...(f.fields ?? [])]; const j = i + d; if (j >= 0 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; onChange({ fields: l }); } }}
              onRemove={() => onChange({ fields: (f.fields ?? []).filter((_, j) => j !== i) })}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onChange({ fields: [...(f.fields ?? []), newField()] })} disabled={(f.fields?.length ?? 0) >= 12} className={btnGhost}>+ Thêm trường vào dòng</button>
            <label className="flex items-center gap-2 text-sm">Tối đa <input type="number" min={1} max={50} value={f.max ?? 12} onChange={(e) => onChange({ max: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} className="h-9 w-20 border border-neutral-300 px-2" /> dòng</label>
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onMove(-1)} disabled={first} className={btnGhost}>Lên</button>
        <button type="button" onClick={() => onMove(1)} disabled={last} className={btnGhost}>Xuống</button>
        <button type="button" onClick={onRemove} className={btnGhost}>Xoá trường</button>
      </div>
    </div>
  );
}

export function TemplateEditor({ initial, readOnly = false }: { initial: Template | null; readOnly?: boolean }) {
  const [state, action, pending] = useActionState<TemplateFormState, FormData>(saveTemplateAction, {});
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [html, setHtml] = useState(initial?.html ?? "");
  const [fields, setFields] = useState<TemplateField[]>(initial?.fields ?? []);
  const [tab, setTab] = useState<Tab>(initial ? "html" : "html");
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const [sample, setSample] = useState<TemplateValues>({});
  const area = useRef<HTMLTextAreaElement>(null);
  const [frameH, setFrameH] = useState(300);
  const frame = useRef<HTMLIFrameElement>(null);

  const current = useMemo(() => ({ name, description, html, fields }), [name, description, html, fields]);
  const checked = useMemo(() => parseTemplateJson(current), [current]);
  const unknown = useMemo(() => unknownPlaceholders(html, fields), [html, fields]);
  const values = useMemo(() => ({ ...defaultValues(fields), ...sample }), [fields, sample]);
  const preview = useMemo(() => {
    const body = renderTemplate({ html, fields }, values, SITE, "xem-thu");
    // the preview runs the template's own script in a frame that cannot touch the admin (no allow-same-origin); it reports its height
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:16px;font-family:Inter,system-ui,sans-serif;color:#171717}</style></head><body>${body}<script>(function(){function s(){parent.postMessage({tpl:'h',h:document.documentElement.scrollHeight},'*')}new ResizeObserver(s).observe(document.documentElement);window.addEventListener('load',s);s()})()</script></body></html>`;
  }, [html, fields, values]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.tpl === "h") setFrameH(Math.max(120, Math.min(2000, Number(e.data.h) || 300)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  const insert = (text: string) => {
    const el = area.current;
    const at = el ? el.selectionStart : html.length;
    const to = el ? el.selectionEnd : html.length;
    setHtml((cur) => `${cur.slice(0, at)}${text}${cur.slice(to)}`);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + text.length, at + text.length); });
  };
  const setField = (i: number, p: Partial<TemplateField>) => setFields((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));

  function openJson() {
    setJsonText(JSON.stringify(current, null, 2));
    setJsonErr("");
    setTab("json");
  }
  function applyJson() {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (e) {
      setJsonErr(`JSON chưa đúng cú pháp: ${e instanceof Error ? e.message : "không đọc được"}`);
      return;
    }
    const p = parseTemplateJson(raw);
    if ("error" in p) {
      setJsonErr(p.error);
      return;
    }
    setName(p.template.name);
    setDescription(p.template.description);
    setHtml(p.template.html);
    setFields(p.template.fields);
    setSample({});
    setJsonErr("");
    setTab("html");
  }
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "mau").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  // the values now in the preview become the fields' defaults (also the way to give a list its sample rows)
  const useSampleAsDefault = () => setFields((cur) => cur.map((f) => ({ ...f, default: values[f.key] as TemplateField["default"] })));

  return (
    <form action={action} className="max-w-5xl space-y-4">
      <input type="hidden" name="id" value={initial && !readOnly ? initial.id : ""} />
      <input type="hidden" name="template" value={JSON.stringify(current)} />
      <fieldset disabled={readOnly} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-semibold">Tên mẫu<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${inputCls} mt-1 font-normal`} /></label>
          <label className="block text-sm font-semibold">Mô tả ngắn<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className={`${inputCls} mt-1 font-normal`} /></label>
        </div>
      </fieldset>
      {readOnly && (
        <div className="flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Mẫu có sẵn của website, không sửa được trực tiếp.
          <button formAction={duplicateTemplateAction} name="id" value={initial?.id} className={btnGhost}>Tạo bản sao để sửa</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Phần của mẫu" className="flex border border-neutral-300 text-sm font-semibold">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => (t.id === "json" ? openJson() : setTab(t.id))} className={`px-4 py-2 ${tab === t.id ? "bg-[#2b2b2b] text-white" : "bg-white text-neutral-700 hover:bg-neutral-100"}`}>{t.label}</button>
          ))}
        </div>
        <button type="button" onClick={downloadPrompt} className={`${btnGhost} ml-auto`} title="Tải file hướng dẫn cho AI: đưa file này cùng đoạn HTML của bạn cho AI, nó trả về JSON để dán vào tab JSON">Tải prompt chuyển HTML sang mẫu</button>
      </div>

      {tab === "html" && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">Viết HTML (kèm &lt;style&gt;, &lt;script&gt; nếu cần). Chỗ nào cho sửa thì đặt <code>{"{{tên_trường}}"}</code>, bấm các nút dưới để chèn đúng chỗ con trỏ. <code>{"{{_id}}"}</code> là mã riêng của từng khối, dùng cho id mà script tìm.</p>
          <div className="flex flex-wrap gap-1">
            {fields.filter((f) => f.key).map((f) =>
              f.type === "list" ? (
                <span key={f.key} className="flex flex-wrap gap-1">
                  <button type="button" disabled={readOnly} onClick={() => insert(`{{#each ${f.key}}}\n  \n{{/each}}`)} className={btnGhost}>{`{{#each ${f.key}}}`}</button>
                  {(f.fields ?? []).filter((s) => s.key).map((s) => <button key={s.key} type="button" disabled={readOnly} onClick={() => insert(`{{${s.key}}}`)} className={btnGhost}>{`{{${s.key}}}`}</button>)}
                </span>
              ) : (
                <button key={f.key} type="button" disabled={readOnly} onClick={() => insert(`{{${f.key}}}`)} className={btnGhost}>{`{{${f.key}}}`}</button>
              ),
            )}
            <button type="button" disabled={readOnly} onClick={() => insert("{{_id}}")} className={btnGhost}>{"{{_id}}"}</button>
            <button type="button" disabled={readOnly} onClick={() => insert("{{#if tên}}  {{else}}  {{/if}}")} className={btnGhost}>{"{{#if}}"}</button>
          </div>
          <textarea ref={area} aria-label="HTML của mẫu" value={html} onChange={(e) => setHtml(e.target.value)} readOnly={readOnly} rows={22} spellCheck={false} maxLength={200_000} className={`${inputCls} font-mono text-[13px]`} />
          {unknown.length > 0 && <p className="text-xs text-amber-800">Trong HTML có {unknown.map((k) => `{{${k}}}`).join(", ")} nhưng chưa có ô nhập tên đó (sẽ để trống). Thêm ở tab Ô nhập hoặc sửa lại tên.</p>}
        </div>
      )}

      {tab === "fields" && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">Mỗi trường là một ô nhập khi thêm mẫu vào trang chủ. Khoá (key) dùng trong HTML dưới dạng <code>{"{{key}}"}</code>.</p>
          {fields.map((f, i) => (
            <FieldRow
              key={i}
              f={f}
              first={i === 0}
              last={i === fields.length - 1}
              onChange={(p) => setField(i, p)}
              onMove={(d) => setFields((cur) => { const l = [...cur]; const j = i + d; if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]]; return l; })}
              onRemove={() => setFields((cur) => cur.filter((_, j) => j !== i))}
            />
          ))}
          {!readOnly && <button type="button" onClick={() => setFields((cur) => [...cur, newField()])} disabled={fields.length >= 40} className={btnGhost}>+ Thêm trường ({fields.length}/40)</button>}
        </div>
      )}

      {tab === "json" && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">Toàn bộ mẫu dưới dạng JSON. Dán JSON (ví dụ do AI trả về sau khi bạn đưa file prompt và HTML) rồi bấm Áp dụng. Có thể tải JSON về để chia sẻ hoặc sao lưu.</p>
          <textarea aria-label="JSON của mẫu" value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={22} spellCheck={false} readOnly={readOnly} className={`${inputCls} font-mono text-[13px]`} />
          {jsonErr && <p role="alert" className="text-sm font-medium text-[#de0000]">{jsonErr}</p>}
          <div className="flex gap-2">
            {!readOnly && <button type="button" onClick={applyJson} className={btnCls}>Áp dụng JSON</button>}
            <button type="button" onClick={downloadJson} className={btnGhost}>Tải JSON về</button>
          </div>
        </div>
      )}

      {tab === "preview" && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">Xem thử với giá trị bên dưới (số liệu cửa hàng là số mẫu). Script của mẫu chạy trong khung riêng, không chạm được vào trang quản trị.</p>
          <div className="border border-neutral-300 bg-white">
            <iframe ref={frame} title="Xem thử mẫu" sandbox="allow-scripts" srcDoc={preview} style={{ height: frameH }} className="block w-full border-0" />
          </div>
          <details className="border border-neutral-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">Giá trị đang xem thử ({fields.length} ô)</summary>
            <div className="mt-3"><TemplateValuesForm fields={fields} values={values} idKey="preview" update={(fn) => setSample((cur) => fn({ ...defaultValues(fields), ...cur }))} /></div>
            {!readOnly && <button type="button" onClick={useSampleAsDefault} className={`${btnGhost} mt-3`}>Đặt các giá trị này làm mặc định</button>}
          </details>
        </div>
      )}

      {"error" in checked && <p className="text-sm font-medium text-amber-800">Chưa lưu được: {checked.error}</p>}
      {state.error && <p role="alert" className="text-sm font-medium text-[#de0000]">{state.error}</p>}
      {state.saved && <p className="text-sm font-medium text-green-700">Đã lưu. Các nơi dùng mẫu này đã cập nhật.</p>}
      {!readOnly && <button disabled={pending || "error" in checked} className={btnCls}>{pending ? "Đang lưu..." : "Lưu mẫu"}</button>}
    </form>
  );
}
