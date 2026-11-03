# Quản trị website và cơ sở dữ liệu

Bài viết, sản phẩm, banner trang chủ và thông tin cửa hàng nằm trong MySQL. Trang quản trị ở `/admin`.
Các file JSON trong `src/content` chỉ còn là **dữ liệu mẫu** để nạp lần đầu.

## Dựng database chỉ bằng một file: `db/seed.sql`

`db/seed.sql` tự tạo database `yenthoa_db` (utf8mb4), các bảng và toàn bộ dữ liệu mẫu (119 bài, 64 xe cùng 361 phiên bản/màu, banner, thông tin cửa hàng).
Chạy trực tiếp trong MySQL:

```sql
mysql> source db/seed.sql
```

hoặc từ dòng lệnh (cmd/bash: `mysql -u root -p < db/seed.sql`; PowerShell không hiểu dấu `<` nên dùng):

```bash
mysql -u root -p -e "source db/seed.sql"
```

Chạy lại an toàn: dòng nào đã có thì giữ nguyên, không ghi đè bản bạn đã sửa. Nếu nạp vào database đã có sẵn với tên khác
(phpMyAdmin, hosting), xoá hai dòng `CREATE DATABASE` và `USE` ở đầu file rồi chọn database của bạn trước khi import.

## Chạy website trên máy phát triển

Sau khi import `db/seed.sql`, tạo `.env.local` (UTF-8) ở gốc dự án:

```bash
DATABASE_URL=mysql://root:MAT_KHAU@127.0.0.1:3306/yenthoa_db
```

```bash
npm run admin:hash -- "mat-khau-it-nhat-10-ky-tu"   # in 3 dòng ADMIN_USER / ADMIN_PASSWORD_HASH / SESSION_SECRET, dán vào .env.local
npm install
npm run dev                                          # rồi mở http://localhost:3000 và /admin
```

Không có MySQL cài sẵn? `npm run db:dev` bật một MySQL 8.4 tạm ở cổng 3307 (mất dữ liệu khi tắt), sau đó dùng `npm run db:seed`
thay cho file SQL. `npm run db:seed -- --force` ghi đè các dòng trùng đường dẫn và đặt lại banner.
Sinh lại `db/seed.sql` sau khi dữ liệu trong `src/content` đổi: `npm run db:sql`.

## Chạy bằng Docker Compose (máy chủ thật)

1. Tạo file `.env` cạnh `docker-compose.yml`: `MYSQL_PASSWORD`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` (ba giá trị sau do `npm run admin:hash` in ra).
2. `docker compose up -d --build app mysql`
3. Vào `/admin`, đăng nhập, bấm **Nạp dữ liệu mẫu** ở trang Tổng quan (chỉ hiện khi cơ sở dữ liệu trống).

Dữ liệu nằm trong hai volume: `mysql-data` (database) và `uploads` (ảnh tải lên, `/data`). **Sao lưu cả hai.**
Sao lưu database: `docker compose exec mysql mysqldump -u yenthoa -p yenthoa_db > backup.sql`.

Nếu chạy sau một proxy (Nginx, Caddy, Cloudflare...) có HTTPS, proxy phải gửi header `X-Forwarded-Proto: https`
(hoặc đặt `COOKIE_SECURE=true`) để cookie đăng nhập có cờ Secure.

## Việc quản trị làm được

| Mục | Làm gì |
|---|---|
| Bài viết | Thêm, sửa, xoá, ẩn/hiện, chọn mục, ảnh bìa, nội dung HTML |
| Sản phẩm | Tên, hãng, loại, giá từ/đến, ảnh, thư viện ảnh, mô tả, ẩn/hiện; **thuộc tính tuỳ ý** (Phiên bản, Màu sắc, Dung tích...) với ảnh và giá riêng cho từng dòng |
| Trang chủ, mục Banner đầu trang | Tối đa 10 banner trang chủ: chữ, ảnh, thứ tự, bật/tắt, **đường dẫn khi bấm nút** (trang trong website như `/xe-may`, hoặc bất kỳ link `https://`, `tel:`, `mailto:`; để trống thì không hiện nút) |
| Trang chủ, thẻ góc banner | Trong mục Banner đầu trang, phần **Thẻ nhỏ ở góc phải dưới banner** (chỉ hiện trên màn hình từ cỡ tablet): **Tự động** (hai bài viết mới nhất, mặc định), **Tự tạo** (tối đa 3 thẻ: tiêu đề, ảnh, đường dẫn khi bấm, đổi thứ tự trái/phải) hoặc **Ẩn** |
| Ảnh nền trên điện thoại | Mỗi mục giới thiệu xe ở Trang chủ và mỗi bộ sưu tập có ô **Ảnh nền trên điện thoại** (để trống = nền trắng như trước; bấm ảnh nhỏ để dùng chung ảnh nền với máy tính, hoặc tải ảnh khác). Ảnh nằm sau hình xe, cắt vừa khung cao khoảng 260-340px |
| Trang chủ, các mục khác | Banner đầu trang cũng là một mục trong danh sách (đổi vị trí, tắt). **Đổi vị trí nhanh:** nắm biểu tượng ba gạch ngang (≡) ở đầu mỗi mục rồi kéo lên hoặc xuống (chuột hoặc ngón tay; kéo sát mép màn hình thì trang tự cuộn), hoặc bấm vào ≡ rồi dùng phím mũi tên lên xuống. Cũng còn nút Lên/Xuống trong từng mục. Các mục giới thiệu xe trên trang chủ (ảnh xe lớn và dải xe bên dưới): thêm mục mới hoặc **banner ảnh** xen giữa hoặc **khối HTML** (nội dung tự do, có tab Xem trước, đặt ở vị trí nào cũng được), đổi tên, **ảnh nền** (có sẵn 4 kiểu hoặc tải ảnh riêng), thứ tự, bật/tắt, và **danh sách xe** (tự động theo hãng hoặc tự chọn từng xe và sắp xếp). Chưa lưu thì mỗi hãng một mục. |
| Danh mục | Quản lý **hãng xe**, **loại xe** và **mục tin tức**: thêm, đổi tên, đổi thứ tự, tắt "Đang hiện", chọn hãng nằm ở menu Xe máy hay Xe điện, mục tin nào hiện trên menu. Mục đang có xe hoặc bài dùng thì không xoá được (chỉ tắt hiển thị). Các ô chọn trong Sản phẩm, Bài viết, bộ lọc và menu đổi theo. |
| Danh mục, mục Menu đầu trang | Menu nhiều cấp (tối đa 4), mỗi mục có tên, **đường dẫn tự do** (trang trong site, `https://`, `tel:`, `mailto:`, hoặc để trống để chỉ làm nhóm), bật/tắt, đổi thứ tự. Mục con tự nhập hoặc lấy từ hãng xe, mục tin tức hay các bộ sưu tập. |
| Bộ sưu tập | Nhóm xe có tên và trang riêng `/bo-suu-tap/tên` (như Collections của Shopify). **Chọn tay** từng xe và sắp thứ tự, hoặc **tự động theo luật** (hãng, loại xe, khoảng giá) để xe mới phù hợp tự vào; có đếm sẵn số xe khớp luật. Dùng được ở trang chủ (mục xe: "Hoặc lấy xe từ một bộ sưu tập") và menu (mục con "các bộ sưu tập xe"). Trang `/bo-suu-tap` liệt kê tất cả bộ sưu tập đang hiện. Khối "Bộ sưu tập" ở cuối trang chủ hiện tất cả hoặc chỉ những bộ bạn chọn và sắp thứ tự, theo kiểu **giới thiệu** (mỗi bộ một khối ảnh xe lớn trên ảnh nền riêng của bộ đó, dải xe bên dưới) hoặc kiểu **thẻ ảnh**. Ảnh nền của từng bộ chọn ở trang sửa bộ sưu tập (mục trang chủ lấy xe từ một bộ sưu tập cũng dùng nền của bộ đó). Mỗi bộ có **mô tả chi tiết** (HTML) hiện ở trang `/bo-suu-tap/tên` với nút Xem thêm. |
| Hình ảnh | Tất cả ảnh đã tải lên: ảnh nhỏ, **tên** (sửa được bằng nút Đổi tên), dung lượng, ngày tải, mã, và **số vị trí đang dùng** (bấm để xem danh sách: bài viết, xe, banner, trang chủ, bộ sưu tập, thông tin cửa hàng). Có **ô tìm kiếm** (theo tên ảnh, mã, hoặc tên nơi đang dùng, không phân biệt dấu) và lọc đang dùng / chưa dùng. Các chỗ dùng ảnh **chỉ lưu mã** của ảnh (dạng `/uploads/<mã>`), nên đổi tên hay thay ảnh không phải sửa lại chỗ nào. Nút **Sao chép link** (dán vào ô ảnh ở nơi khác), **Thay thế** (mọi chỗ đang dùng tự hiện ảnh mới) và **Xoá** (cảnh báo nếu đang dùng). Chỉ gồm ảnh tải lên qua admin, không gồm ảnh có sẵn trong thư mục /sites. |
| Thông tin cửa hàng | Tên, hotline, link Facebook, địa chỉ chân trang, danh sách cửa hàng |

Ảnh tải lên được nén lại thành WebP (tối đa 1600px) và **xoá dữ liệu EXIF/vị trí GPS**. Tối đa 10 MB mỗi ảnh.

### Thuộc tính của xe (Phiên bản, Màu sắc, Dung tích...)

Trong form sửa xe, mục "Phiên bản và màu": thêm hoặc đổi tên **thuộc tính** (tối đa 6), rồi mỗi **dòng** là một tổ hợp giá trị
với ảnh và giá riêng (tối đa 60 dòng). Trang xe hiện mỗi thuộc tính thành một nhóm lựa chọn; chọn xong thì ảnh chính và giá đổi
theo dòng khớp nhất. Thuộc tính có chữ "màu" trong tên hiện thành ô ảnh tròn, còn lại là nút chữ. Dữ liệu cũ chỉ có phiên bản và
màu được tự chuyển sang dạng này.

### Thông số kỹ thuật

Mục "Thông số kỹ thuật" trong form sửa xe: mỗi **nhóm** (Động cơ, Khung xe, Kích thước, Bảo hành...) gồm các dòng tên - giá trị (tối đa 12 nhóm, mỗi
nhóm 60 dòng). Trang xe hiện thành tab **Thông số kỹ thuật** cạnh tab **Thông tin sản phẩm**, mỗi nhóm là một mục thu gọn được.
Xe không có thông số thì không hiện tab này.

## Tìm kiếm trên website

Ô tìm kiếm ở đầu trang (và trong menu trên điện thoại) mở trang `/tim-kiem?q=...`: tìm trong tên xe, tên hãng, tiêu đề và mô tả bài viết.
Không phân biệt hoa thường và dấu (kể cả d / đ: "xe dien" ra "Xe điện"); mọi từ trong câu tìm đều phải khớp, thứ tự bất kỳ.
Hiện tối đa 48 xe và 30 bài. Trang này không được đưa lên Google (noindex).

## Bảo mật

- Một tài khoản duy nhất, mật khẩu lưu dạng băm scrypt trong biến môi trường, không nằm trong mã nguồn.
- Phiên đăng nhập là cookie httpOnly có chữ ký, hết hạn sau 12 giờ. Sai mật khẩu 5 lần thì khoá 15 phút (đếm theo địa chỉ IP, trong bộ nhớ, mất khi khởi động lại).
- Mọi trang và mọi thao tác ghi đều tự kiểm tra phiên, không chỉ dựa vào `proxy.ts`.
- HTML khi lưu được lọc theo danh sách thẻ cho phép (không script, không `style`, không sự kiện `on...`).
- Đổi mật khẩu: chạy lại `npm run admin:hash`, thay giá trị trong môi trường, khởi động lại ứng dụng.

## Chưa kiểm thử

Chưa chạy `docker compose up` thật (môi trường phát triển không có Docker daemon). Đã kiểm thử: MySQL 8.4 thật qua
`npm run db:dev`, build, và chạy bản standalone (`node .next/standalone/server.js`) giống image Docker.

## Chạy trên Vibe Host

Xem [`VIBEHOST.md`](VIBEHOST.md).

## Ô soạn HTML (bài viết, xe, bộ sưu tập)

Các ô HTML (nội dung bài viết, giới thiệu và chi tiết của xe, mô tả ngắn và chi tiết của bộ sưu tập) có hai tab: **HTML** (mã nguồn) và **Xem trước** (đúng như trang sẽ hiện, sau khi lọc thẻ).

Để chèn ảnh đã có: vào mục **Hình ảnh**, bấm **Sao chép link** ở ảnh, rồi **dán (Ctrl+V)** vào ô HTML. Link tự thành thẻ `<img>` tại con trỏ. Dán nhiều link (mỗi dòng một link) thì ra nhiều ảnh; link ảnh ở trang khác (`https://...jpg`) cũng được. Dán chữ thường thì vẫn là chữ. Thẻ ảnh chỉ lưu mã (`/uploads/<mã>`), nên khi bạn **Thay thế** ảnh đó ở mục Hình ảnh thì mọi chỗ có ảnh, kể cả trong các mô tả HTML, tự hiện ảnh mới. Dán một ảnh đang copy (Ctrl+V) hoặc kéo thả file ảnh vào ô thì ảnh được tải lên rồi chèn như trên.

**Ảnh từ trang web khác:** dán link ảnh của trang khác (`https://...jpg`, `png`, `webp`...), hoặc dán cả đoạn HTML có thẻ `<img>` copy từ trang khác, thì ảnh được **tự tải về mục Hình ảnh** và link đổi thành `/uploads/<mã>` (không còn phụ thuộc trang kia). Nếu trong ô vẫn còn ảnh link ngoài (gõ tay hoặc dán từ trước), phía dưới ô hiện thông báo vàng kèm nút "Tải N ảnh về mục Hình ảnh". Link nào không tải được (lỗi 404, không phải ảnh, quá 10 MB) thì giữ nguyên và báo rõ. Máy chủ chỉ tải từ địa chỉ công khai trên internet, không tải từ địa chỉ nội bộ.

**Thẻ HTML được phép:** các ô HTML giữ nguyên những gì bạn viết, **cho phép mọi thẻ và thuộc tính** (div, span, style, class, iframe, button, script, onclick...). Nhờ vậy dán được khung nhúng (YouTube, Google Maps), bố cục tự chỉnh bằng `style`, mã theo dõi. Lưu ý:
- Chỉ dán mã bạn tin tưởng: mã chạy trên mọi trang khách xem.
- Tab **Xem trước** chạy trong khung cô lập, **không chạy script** (để mã dán từ nơi khác không thao tác được trong trang quản trị). Bố cục, `style` và `<style>` vẫn hiện đúng.
- Trên trang công khai, `<script>` trong nội dung chạy **một lần mỗi lượt xem trang**: cả khi khách tải thẳng trang lẫn khi bấm link chuyển trang trong site hoặc bấm nút Back (website tự chạy lại các script của nội dung mới, xem `RunContentScripts`). Script nạp từ file ngoài (`<script src="...">`) cũng vậy. Nếu muốn một mã chỉ chạy một lần cho cả lượt khách vào site (không phải mỗi trang), hãy tự kiểm tra bằng một biến, ví dụ `if (!window.__daChay) { window.__daChay = 1; ... }`.
