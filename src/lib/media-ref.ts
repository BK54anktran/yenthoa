// Photos are referenced by their id, never by the path of the file: "/uploads/<id>" (16 hex characters).
//  - written to the database: any "/uploads/2026/11/<id>.webp" or "/uploads/<id>" becomes "/uploads/<id>"
//  - read from the database: "/uploads/<id>" becomes the address of the file that id points to right now
// So renaming or replacing a photo only changes its row in the media table, no page has to be edited.
// A file is named <id>.webp, or <id>-<more hex>.webp after a replace (a new file name, so browsers that kept the old photo show the new one).
export const REF_RE = /\/uploads\/(?:\d{4}\/\d{2}\/)?([0-9a-f]{16})(?:-[0-9a-f]{6,16})?(?:\.webp)?(?![0-9A-Za-z_/.-])/g;

export const canonText = (s: string): string => (s.includes("/uploads/") ? s.replace(REF_RE, (_m, id: string) => `/uploads/${id}`) : s);

// id -> file path inside the upload folder ("2026/11/<name>.webp")
export type MediaMap = Map<string, string>;

export const resolveText = (s: string, map: MediaMap): string =>
  s.includes("/uploads/") ? s.replace(REF_RE, (m, id: string) => (map.has(id) ? `/uploads/${map.get(id)}` : m)) : s;

export const idsIn = (s: string): string[] => (s.includes("/uploads/") ? [...s.matchAll(REF_RE)].map((m) => m[1]) : []);

// walks rows / JSON values and rewrites every string; objects are copied only when something changed
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  }
  return value;
}
