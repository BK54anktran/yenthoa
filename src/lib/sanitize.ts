import sanitizeHtml from "sanitize-html";

// Admin-written HTML is kept exactly as written: every tag and attribute is allowed, scripts and event handlers included
// (a deliberate choice of the shop: tracking pixels, embeds, custom layout). Only someone who is logged in to the admin can
// write it. The admin preview shows it in a sandboxed frame that runs no script, so pasting code from somewhere else
// cannot act inside the admin. Anything that must stay safe (an excerpt, a page title) goes through htmlToText instead.
export const cleanHtml = (html: string): string => html.replace(/\u0000/g, "").trim();

// plain text of an HTML fragment, used for excerpts
export const htmlToText = (html: string): string => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
