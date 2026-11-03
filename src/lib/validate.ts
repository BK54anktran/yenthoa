// small checks shared by the admin actions
export const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
// where a link may go: a path on this site, an anchor, any http(s) page, tel: or mailto:. javascript:, data: and //host are refused.
export const linkUrl = (v: string) => (v === "" || /^\/(?!\/)/.test(v) || /^#/.test(v) || /^https?:\/\//i.test(v) || /^(tel|mailto):/i.test(v) ? v : null);
// images: our own paths or https URLs only
export const imgUrl = (v: string) => (v === "" || /^\/[^/]/.test(v) || /^https:\/\//i.test(v) ? v : null);
