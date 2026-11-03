<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Website Reverse-Engineer Template

## What This Is
A reusable template for reverse-engineering any website into a clean, modern Next.js codebase using AI coding agents. The Next.js + shadcn/ui + Tailwind v4 base is pre-scaffolded — just run `/clone-website <url1> [<url2> ...]`.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Base UI primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — will be replaced/supplemented by extracted SVGs)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utilities or scoped CSS; avoid inline styles unless behavior needs dynamic values
- 2-space indentation
- Responsive: mobile-first

## Design Principles
- **Pixel-perfect emulation** — match the target's spacing, colors, typography exactly
- **No personal aesthetic changes during emulation phase** — match 1:1 first, customize later
- **Real content** — use actual text and assets from the target site, not placeholders
- **Beauty-first** — every pixel matters

## Project Structure
```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
    sites/<site>/   # Source-specific components, including extracted SVGs
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  sites/<site>/     # Source-specific images, fonts, video, and other assets
docs/
  research/<site>/  # Page brief, asset map, and inspection evidence
  design-references/ # Screenshots and visual references
scripts/            # Asset download scripts
.agents/
  skills/
    clone-website/  # Canonical cross-agent cloning workflow
.claude/
  commands/
    clone-website.md # Thin Claude Code invocation bridge
```

## Agent Workflow
- Edit `.agents/skills/clone-website/` for cloning-workflow changes. It is the canonical skill used by Codex, Cursor, and OpenCode.
- Keep `.claude/commands/clone-website.md` as a thin Claude Code bridge to the canonical skill; do not duplicate the workflow there.

---

# Quy tắc làm việc của chủ dự án (mang từ Bosskin, chỉ phần hợp với Yên Thoa)

Website bán xe máy (Next.js + MySQL + trang `/admin`), triển khai trên Vibe Host (`docs/VIBEHOST.md`, `docs/ADMIN.md`).

1. **Commit sạch.** Commit đứng tên chủ dự án (theo `git config` của máy), **không** thêm chữ ký Claude
   (`Co-Authored-By`, `Claude-Session`…). Không tạo PR nếu chủ dự án không yêu cầu.
2. **Không bao giờ tự xoá / reset dữ liệu**, kể cả database dev: không `DROP` / `TRUNCATE` / `DELETE` hàng loạt,
   không `npm run db:seed -- --force` (ghi đè dòng đã sửa) và không xoá `/data` hay `public/uploads` nếu chủ dự án chưa đồng ý rõ trong lần đó.
   Cần dữ liệu mới → thêm bằng seed không ghi đè hoặc bằng trang admin. `db/seed.sql` luôn phải chạy lại an toàn (dòng đã có thì giữ nguyên).
3. **Code – database – tài liệu đi cùng nhau.** Đổi bảng / cột (`src/lib/db.ts`) thì sinh lại `db/seed.sql` (`npm run db:sql`)
   và sửa `docs/ADMIN.md`; đổi biến môi trường hay cách triển khai thì sửa `.env.example` và `docs/VIBEHOST.md`.
   Đổi dữ liệu mẫu trong `src/content` → chạy lại `npm run db:sql`.
4. **Triển khai (Vibe Host) chỉ khi chủ dự án yêu cầu, và chỉ sau khi CI của chính commit đó xanh** (`lint`, `typecheck`, `build`).
   Vibe Host build từ nhánh `main` nên: push → đợi CI xanh → `redeploy_project` → `wait_for_job` → xem log chạy. CI đỏ thì sửa, không triển khai.
   Có người dùng thật thì gộp nhiều thay đổi vào một lần triển khai, đừng triển khai lắt nhắt từng commit.
5. **Giao diện: làm đúng và gọn, không tự thêm.** Chỉ làm đúng thứ được yêu cầu — không tự thêm ghi chú, gợi ý, chú thích,
   tooltip, biểu ngữ, nút phụ hay chữ giải thích khi chủ dự án không đòi; cần thêm thì hỏi trước. Dùng lại component sẵn có
   (`src/components/ui`, `src/components/admin/ui.tsx`) thay vì dựng kiểu mới; thấy lặp lại ≥ 2 nơi thì tách thành component dùng chung.
   Đổi thứ gì thì xoá luôn phần thừa đi kèm (import, biến, class không còn dùng).
6. **Màu & giao diện:** không viết cứng màu rải rác trong component — dùng design token ở `globals.css` / Tailwind.
   Mọi phần tử bấm được trên desktop phải có `cursor-pointer` khi hover.
7. **Mobile-first thật sự:** kiểm tra ở 390×844 (điện thoại) lẫn 1280×800 (desktop). Không đặt chiều rộng cố định cạnh `justify-between`
   gây tràn mép phải; nhóm lựa chọn ít mục (2–4) xếp một hàng, không để mục cuối rớt dòng lẻ; chữ không cắt / tràn / xuống dòng lẻ.
8. **Phải có ảnh làm bằng chứng cho thay đổi giao diện.** Chạy site thật (`npm run db:dev` + `npm run db:seed` + `npm run dev`),
   chụp bằng Playwright đã cài sẵn ở **cả hai cỡ** 390×844 và 1280×800, **tự mở từng ảnh xem lại** (đúng chỗ yêu cầu chưa, chữ có cắt / tràn,
   nút mồ côi, thừa khoảng trắng) rồi mới gửi chủ dự án; lỗi bố cục thì sửa và chụp lại, không gửi ảnh còn lỗi. Sửa giao diện lớn thì gửi ảnh
   xem trước và chỉ commit / push sau khi chủ dự án duyệt. Không có ảnh thì không báo "đã sửa xong"; không chạy được app thì nói rõ lý do,
   không giả lập kết quả. Ảnh thử / ảnh lỗi để trong thư mục tạm, **không commit**.
9. **Lỗi backend / admin:** làm luôn rồi đưa bằng chứng cụ thể (đầu ra lệnh, dòng database trước / sau, `npm run check` đạt).
   Trước khi báo xong luôn chạy `npm run check` (lint + typecheck + build).
10. **Bảo mật admin:** mọi route / server action của `/admin` và API ghi dữ liệu đều phải kiểm tra phiên đăng nhập; nội dung HTML do người
    dùng nhập phải qua `src/lib/sanitize.ts`; truy vấn MySQL luôn dùng tham số, không nối chuỗi; không in bí mật (`ADMIN_PASSWORD_HASH`,
    `SESSION_SECRET`, mật khẩu DB) ra log hay commit.
11. **Giới hạn sử dụng:** khi mức dùng chạm ~99%, dừng, commit / push phần đã xong và tóm tắt tiến độ cho chủ dự án.
