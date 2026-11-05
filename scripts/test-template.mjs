// Checks the template engine (src/lib/template.ts): node --experimental-strip-types scripts/test-template.mjs
import { renderTemplate, parseTemplateJson, cleanValues, unknownPlaceholders } from "../src/lib/template.ts";
import assert from "node:assert/strict";
const j = {
  name: "T", html: `<div id="c-{{_id}}" class="{{cls}}">{{title}}{{#if show}}[S]{{else}}[N]{{/if}}{{#unless show}}(u){{/unless}}<img src="{{pic}}"><a href="{{go}}">x</a>{{{raw}}}{{#each items}}<li>{{@number}}.{{name}}|{{@index}}</li>{{/each}} {{site.products}}/{{site.hotline}} {{nope}}</div>`,
  fields: [
    { key: "title", label: "T", type: "text", default: "A&B <b>" }, { key: "show", label: "S", type: "boolean", default: true },
    { key: "cls", label: "c", type: "select", options: ["a", "b"] }, { key: "pic", type: "image" }, { key: "go", type: "link" }, { key: "raw", type: "html" },
    { key: "items", type: "list", fields: [{ key: "name", type: "text" }], default: [{ name: "x" }, { name: "y<" }] },
  ],
};
const p = parseTemplateJson(j); assert.ok(p.template, JSON.stringify(p));
const site = { products: 64, brands: 8, branches: 3, hotline: "0789", name: "HP" };
let out = renderTemplate(p.template, { pic: "javascript:alert(1)", go: 'javascript:alert(1)', raw: "<i>ok</i>", show: false }, site, "Blk 1!");
console.log(out);
assert.ok(out.includes('id="c-t-Blk1"'));
assert.ok(out.includes("A&amp;B &lt;b&gt;"));          // text escaped
assert.ok(out.includes("[N]") && out.includes("(u)")); // else / unless
assert.ok(out.includes('<img src="">') && out.includes('<a href="">'));  // unsafe schemes dropped
assert.ok(out.includes("<i>ok</i>"));                  // html raw
assert.ok(out.includes("1.x|0") && out.includes("2.y&lt;|1")); // each with defaults and escaping
assert.ok(out.includes("64/0789"));
console.log("unknown:", unknownPlaceholders(p.template.html, p.template.fields));
out = renderTemplate(p.template, { pic: "/uploads/abc", go: "/xe-may", show: true }, site, "z");
assert.ok(out.includes('src="/uploads/abc"') && out.includes('href="/xe-may"') && out.includes("[S]"));
// bad schemas
for (const bad of [{ name: "", html: "x", fields: [] }, { name: "a", html: "x", fields: [{ key: "Bad Key", type: "text" }] }, { name: "a", html: "x", fields: [{ key: "a", type: "zzz" }] }, { name: "a", html: "x", fields: [{ key: "a", type: "list", fields: [{ key: "b", type: "list", fields: [{ key: "c", type: "text" }] }] }] }, { name: "a", html: "x", fields: [{ key: "a", type: "text" }, { key: "a", type: "text" }] }]) assert.ok("error" in parseTemplateJson(bad), JSON.stringify(bad));
const cv = cleanValues(p.template.fields, { title: "t", pic: "ftp://x", items: [{ name: "n", evil: "z" }] }, { html: (s) => s, image: (s) => (s === "" || /^(\/|https:)/.test(s) ? s : null), link: (s) => s });
assert.ok("error" in cv, "image check");
const cv2 = cleanValues(p.template.fields, { title: "t", pic: "/u/1", cls: "zz", items: [{ name: "n", evil: "z" }, 5], extra: 1 }, { html: (s) => s, image: (s) => s, link: (s) => s });
console.log(JSON.stringify(cv2.values)); assert.deepEqual(Object.keys(cv2.values), ["title","show","cls","pic","go","raw","items"]);
assert.equal(cv2.values.cls, "a");
console.log("engine tests passed");
