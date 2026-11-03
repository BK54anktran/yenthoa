# Triển khai trên Vibe Host

Làm giống các website khác trên Vibe Host (ví dụ BossKin API): một website chạy từ Dockerfile của repo, gắn một
database MySQL quản lý sẵn, và một thư mục dữ liệu bền.

## Chuẩn bị (trên máy của bạn, một lần)

```bash
npm install
npm run admin:hash -- "mat-khau-it-nhat-10-ky-tu"
```

Lệnh in ra 3 dòng `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`. Giữ lại để dán vào Vibe Host. Đừng gửi mật khẩu cho ai.

## Các bước trên Vibe Host

1. **Cho Vibe Host đọc repo.** Repo GitHub của dự án đang ở chế độ riêng tư. Tài khoản GitHub được kết nối với
   Vibe Host phải có quyền đọc (thêm làm collaborator) hoặc thêm mã truy cập cho repo trên giao diện Vibe Host.
   Nếu tài khoản Vibe Host mới dùng GitHub khác, có thể fork hoặc chuyển repo sang tài khoản đó.
2. **Tạo website** từ repo, nhánh `main`. Vibe Host build bằng `Dockerfile` ở gốc repo, ứng dụng nghe cổng **3000**.
   Gợi ý tài nguyên: 0,5 CPU, 512 MB RAM.
3. **Gắn database MySQL** vào website. Nền tảng tự đặt `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME` và `MYSQL_*`. Ứng dụng dùng `DATABASE_URL` nếu nó là `mysql://...`, nếu không thì dùng các biến `DB_*` / `MYSQL_*`.
   Bảng được tạo tự động ở lần truy cập đầu tiên (utf8mb4), không cần chạy migration.
4. **Đặt biến môi trường:**

   | Biến | Giá trị | Bí mật |
   |---|---|---|
   | `ADMIN_USER` | `admin` (hoặc tên khác) | không |
   | `ADMIN_PASSWORD_HASH` | dòng từ `npm run admin:hash` | có |
   | `SESSION_SECRET` | dòng từ `npm run admin:hash` (tối thiểu 32 ký tự) | có |

   `UPLOAD_DIR` không cần đặt: image đã mặc định `/data/uploads`.
5. **Khai thư mục dữ liệu bền: `/data`.** Thiếu bước này thì ảnh tải lên mất sau mỗi lần triển khai.
   Khai xong phải **triển khai lại** thì mới có hiệu lực.
6. **Triển khai.** Mở `https://<tên-miền>/admin/login`, đăng nhập, ở trang Tổng quan bấm **Nạp dữ liệu mẫu** (chỉ hiện khi database trống).
   Cách khác, không cần bấm nút: import file [`db/seed.sql`](../db/seed.sql) vào database MySQL của website (phpMyAdmin hoặc
   `mysql`). Vì database đã do Vibe Host tạo, hãy **xoá hai dòng `CREATE DATABASE` và `USE` ở đầu file** trước khi import. File tự tạo bảng và nạp
   113 bài, 64 xe (361 phiên bản/màu), banner, thông tin cửa hàng; import lại không ghi đè dữ liệu đã sửa.
7. Vào **Thông tin cửa hàng** đổi tên, hotline, Facebook, địa chỉ; vào **Banner** và **Sản phẩm** thay ảnh thật.

## Cập nhật sau này

Sửa mã, push lên `main`, bấm triển khai lại trên Vibe Host. Bài viết, sản phẩm, banner, thông tin cửa hàng và ảnh tải lên nằm
trong database và `/data`, nên không mất khi triển khai lại.

## Nếu có lỗi

- Trang báo lỗi hoặc không có bài viết: database chưa được gắn hoặc chưa có biến `DB_*`. Xem nhật ký chạy của website.
- Đăng nhập admin báo "Chưa cấu hình": thiếu `ADMIN_PASSWORD_HASH` hoặc `SESSION_SECRET` (cần ít nhất 32 ký tự).
- Đăng nhập xong bị đẩy về trang đăng nhập: cookie bị chặn vì website chạy HTTPS sau proxy không gửi `X-Forwarded-Proto`.
  Đặt `COOKIE_SECURE=true`.
- Ảnh tải lên mất sau khi triển khai lại: chưa khai `/data` là thư mục dữ liệu bền (bước 5) hoặc chưa triển khai lại sau khi khai.
