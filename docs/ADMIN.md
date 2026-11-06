# Quản trị website và cơ sở dữ liệu

Bài viết, sản phẩm, banner trang chủ và thông tin cửa hàng nằm trong MySQL. Trang quản trị ở `/admin`.
Các file JSON trong `src/content` chỉ còn là **dữ liệu mẫu** để nạp lần đầu.

## Dựng database chỉ bằng một file: `db/seed.sql`

`db/seed.sql` tự tạo database `yenthoa_db` (utf8mb4), các bảng và toàn bộ dữ liệu mẫu (119 bài, 113 xe, banner, thông tin cửa hàng).
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
| Trang chủ, mục Banner đầu trang | Tối đa 10 banner trang chủ (tự chạy 5 giây một ảnh, khách nắm kéo ngang bằng chuột hoặc vuốt bằng ngón tay để đổi ảnh, không có nút mũi tên; mỗi banner có ô **Hiển thị ảnh**: *Lấp đầy khung* (khung cao cố định 640px máy tính, 460px điện thoại, phần thừa bị cắt) hoặc *Vừa ảnh* (khung cao theo đúng tỉ lệ ảnh, không cắt; nên dùng các ảnh cùng tỉ lệ để khung không nhảy khi đổi slide), và có thể có **ảnh riêng cho điện thoại**, để trống thì dùng ảnh máy tính): chữ (**tiêu đề có thể để trống**, banner chỉ có ảnh cũng được), **ô Làm tối ảnh** (bỏ chọn thì ảnh hiện sáng nguyên bản, không có lớp phủ tối), ảnh, thứ tự, bật/tắt, **đường dẫn khi bấm vào ảnh** (cả banner là một link, không còn nút "Xem xe"; trang trong website như `/xe-may`, hoặc bất kỳ link `https://`, `tel:`, `mailto:`; để trống thì ảnh không bấm được) |
| Lưu nhanh | Ở Trang chủ, tiêu đề trang và nút **Lưu trang chủ** nằm trên cùng và đứng yên khi cuộn (không còn nút lưu ở cuối trang, không còn nút khôi phục mặc định). Ở mọi trang quản trị có nút bắt đầu bằng "Lưu" hoặc "Cập nhật", bấm **Ctrl+S** (Cmd+S trên Mac) là bấm nút đó; trang không có nút lưu thì Ctrl+S vẫn là của trình duyệt |
| Trang chủ, mục Dải số liệu | Dải số lớn nền xám đậm ngay dưới banner (mặc định: số mẫu xe, số hãng, số cửa hàng, kèm nút gọi hotline). Mỗi số **tự đếm** theo dữ liệu hoặc **tự nhập** (ví dụ `12+`), đổi chữ mô tả, thêm tối đa 4 số, đổi chỗ trái/phải, đổi câu phía trên nút gọi. Tắt được (bỏ chọn Đang hiện) nhưng không xoá được; kéo mục để đổi vị trí như các mục khác |
| Trang chủ, thẻ góc banner | Trong mục Banner đầu trang, phần **Thẻ nhỏ ở góc phải dưới banner** (chỉ hiện trên màn hình từ cỡ tablet): **Tự động** (hai bài viết mới nhất, mặc định), **Tự tạo** (tối đa 3 thẻ: tiêu đề, ảnh, đường dẫn khi bấm, đổi thứ tự trái/phải) hoặc **Ẩn** |
| Ảnh nền trên điện thoại | Mỗi mục giới thiệu xe ở Trang chủ và mỗi bộ sưu tập có ô **Ảnh nền trên điện thoại** (để trống = nền trắng như trước; bấm ảnh nhỏ để dùng chung ảnh nền với máy tính, hoặc tải ảnh khác). Ảnh nằm sau hình xe, cắt vừa khung cao khoảng 260-340px |
| Trang chủ, các mục khác | Banner đầu trang cũng là một mục trong danh sách (đổi vị trí, tắt). **Đổi vị trí nhanh:** nắm biểu tượng ba gạch ngang (≡) ở đầu mỗi mục rồi kéo lên hoặc xuống (chuột hoặc ngón tay; kéo sát mép màn hình thì trang tự cuộn), hoặc bấm vào ≡ rồi dùng phím mũi tên lên xuống. Cũng còn nút Lên/Xuống trong từng mục. Các mục giới thiệu xe trên trang chủ (ảnh xe lớn và dải xe bên dưới): thêm mục mới hoặc **banner ảnh** xen giữa hoặc **khối HTML** (nội dung tự do, có tab Xem trước, đặt ở vị trí nào cũng được), đổi tên, **ảnh nền** (có sẵn 4 kiểu hoặc tải ảnh riêng), thứ tự, bật/tắt, và **danh sách xe** (tự động theo hãng hoặc tự chọn từng xe và sắp xếp). Chưa lưu thì mỗi hãng một mục. |
| Danh mục | Quản lý **hãng xe**, **loại xe** và **mục tin tức**: thêm, đổi tên, đổi thứ tự, tắt "Đang hiện", chọn hãng nằm ở menu Xe máy hay Xe điện, mục tin nào hiện trên menu. Mục đang có xe hoặc bài dùng thì không xoá được (chỉ tắt hiển thị). Các ô chọn trong Sản phẩm, Bài viết, bộ lọc và menu đổi theo. |
| Danh mục, mục Menu đầu trang | Menu nhiều cấp (tối đa 4), mỗi mục có tên, **đường dẫn tự do** (trang trong site, `https://`, `tel:`, `mailto:`, hoặc để trống để chỉ làm nhóm), bật/tắt, đổi thứ tự. Mục con tự nhập hoặc lấy từ hãng xe, mục tin tức hay các bộ sưu tập. |
| Bộ sưu tập | Nhóm xe có tên và trang riêng `/bo-suu-tap/tên` (như Collections của Shopify). **Chọn tay** từng xe và sắp thứ tự, hoặc **tự động theo luật** (hãng, loại xe, khoảng giá) để xe mới phù hợp tự vào; có đếm sẵn số xe khớp luật. Dùng được ở trang chủ (mục xe: "Hoặc lấy xe từ một bộ sưu tập") và menu (mục con "các bộ sưu tập xe"). Trang `/bo-suu-tap` liệt kê tất cả bộ sưu tập đang hiện. Khối "Bộ sưu tập" ở cuối trang chủ hiện tất cả hoặc chỉ những bộ bạn chọn và sắp thứ tự, theo kiểu **giới thiệu** (mỗi bộ một khối ảnh xe lớn trên ảnh nền riêng của bộ đó, dải xe bên dưới) hoặc kiểu **thẻ ảnh**. Ảnh nền của từng bộ chọn ở trang sửa bộ sưu tập (mục trang chủ lấy xe từ một bộ sưu tập cũng dùng nền của bộ đó). Mỗi bộ có **mô tả chi tiết** (HTML) hiện ở trang `/bo-suu-tap/tên` với nút Xem thêm. |
| Hình ảnh | Tất cả ảnh đã tải lên: ảnh nhỏ, **tên** (sửa được bằng nút Đổi tên), dung lượng, ngày tải, mã, và **số vị trí đang dùng** (bấm để xem danh sách: bài viết, xe, banner, trang chủ, bộ sưu tập, thông tin cửa hàng). Có **ô tìm kiếm** (theo tên ảnh, mã, hoặc tên nơi đang dùng, không phân biệt dấu) và lọc đang dùng / chưa dùng. Các chỗ dùng ảnh **chỉ lưu mã** của ảnh (dạng `/uploads/<mã>`), nên đổi tên hay thay ảnh không phải sửa lại chỗ nào. Nút **Sao chép link** (dán vào ô ảnh ở nơi khác), **Thay thế** (mọi chỗ đang dùng tự hiện ảnh mới) và **Xoá** (cảnh báo nếu đang dùng). Chỉ gồm ảnh tải lên qua admin, không gồm ảnh có sẵn trong thư mục /sites. |
| Thông tin cửa hàng | Tên, hotline, link Facebook, địa chỉ chân trang, danh sách cửa hàng |
| Kết nối | Tạo và xoá **key** cho AI (Claude Desktop, Claude Code) kết nối vào website qua MCP, xem lần dùng cuối của từng key. Xem mục "Kết nối AI (MCP)" bên dưới |

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
- HTML do quản trị viên nhập được **giữ nguyên** (kể cả `<script>`, `style`, `iframe`, sự kiện `on...`) theo lựa chọn của cửa hàng; chỉ người đăng nhập admin hoặc giữ một key MCP mới ghi được. Phần tóm tắt và tiêu đề luôn được rút thành chữ thường (`htmlToText`). Khung xem trước trong admin không chạy script.
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

## Mẫu (template)

Mục **Mẫu** trong menu quản trị. Một mẫu là một đoạn HTML (có thể kèm `<style>`, `<script>`) cộng với các **ô nhập** (trường). Ở **Trang chủ** chọn **+ Thêm từ mẫu**, điền các ô rồi lưu; trên trang web các giá trị được đổ vào đúng chỗ trong HTML. Sửa mẫu thì mọi khối dùng mẫu đó đổi theo, các giá trị đã nhập được giữ.

- **Có sẵn:** Đồng hồ đếm ngược, Máy tính trả góp (không sửa trực tiếp, bấm **Tạo bản sao** để sửa).
- **Tạo mẫu mới:** viết HTML ở tab *Giao diện*, tạo ô nhập ở tab *Ô nhập*, xem thử ở tab *Xem thử* (script chạy trong khung riêng, không chạm được trang quản trị). Hoặc dán thẳng JSON ở tab *JSON*.
- **Nhờ AI chuyển HTML thành mẫu:** bấm **Tải prompt chuyển HTML sang mẫu**, đưa file đó cùng đoạn HTML của bạn cho AI, dán JSON nó trả về vào tab *JSON* rồi *Áp dụng JSON*.
- **Kiểu ô nhập:** chữ một dòng, chữ nhiều dòng, HTML, ảnh, đường dẫn, số, màu, chọn một mục, bật/tắt, ngày giờ, danh sách (nhiều dòng lặp lại, mỗi dòng có các ô con; không lồng danh sách).
- **Chỗ trống trong HTML:** `{{key}}` (chữ được tự thoát ký tự đặc biệt, ô *HTML* chèn nguyên văn, ảnh và link được kiểm tra), `{{#if key}}..{{else}}..{{/if}}`, `{{#unless key}}..{{/unless}}`, `{{#each danh_sach}}..{{@index}} {{@number}}..{{/each}}`, `{{_id}}` (mã riêng của từng khối, dùng cho mọi id mà script tìm để hai khối cùng mẫu không rối nhau), `{{site.products}} {{site.brands}} {{site.branches}} {{site.hotline}} {{site.name}}` (số liệu cửa hàng).
- **Xoá mẫu:** không xoá được khi còn khối ở trang chủ đang dùng. Khối dùng mẫu đã bị xoá thì không hiện ra ngoài trang.
- Mã: `src/lib/template.ts` (bộ máy, có thể thử bằng `npm run test:template`), `src/lib/template-samples.ts` (mẫu có sẵn), `src/lib/template-prompt.ts` (nội dung prompt).

## Kết nối AI (MCP)

Website có sẵn một máy chủ MCP ở `https://<tên-miền>/api/mcp` (Streamable HTTP, không giữ phiên) để AI đọc và sửa nội dung giống như trang quản trị.

**Tạo key:** vào **Kết nối**, nhập tên gợi nhớ (ví dụ "Claude Desktop"), bấm **Tạo key**. Key (dạng `ytk_...`) chỉ hiện đầy đủ **một lần**, sao chép ngay. Database chỉ lưu mã băm SHA-256 của key và vài ký tự đầu để nhận ra trong danh sách; mất key thì xoá và tạo cái mới. **Tắt một key** (bấm "Đang bật" ở cột Trạng thái, bấm lại để bật) khi chưa cần dùng mà không phải xoá và tạo lại: key đang tắt bị từ chối (401, báo "Key đang tắt") và không bị tính vào lần sai key. **Xoá một key là thu hồi hẳn**: lần gọi sau của key đó bị từ chối (401). Mỗi key có cột "Dùng lần cuối". Sai key liên tiếp 5 lần thì địa chỉ đó bị khoá 15 phút (HTTP 429).

**Cài vào Claude Code:**

```bash
claude mcp add --transport http yenthoa https://<tên-miền>/api/mcp --header "Authorization: Bearer <key>"
```

**Cài vào Claude Desktop** (hoặc client khác nhận cấu hình URL), thêm vào file cấu hình MCP:

```json
{"mcpServers":{"yenthoa":{"url":"https://<tên-miền>/api/mcp","headers":{"Authorization":"Bearer <key>"}}}}
```

**Cài vào ChatGPT** (chỉ có OAuth hoặc "Không xác thực", không có ô nhập key): thêm server MCP tuỳ chỉnh, chọn **Không xác thực** và dán ô **"Địa chỉ có sẵn key"** hiện ra ngay sau khi tạo key, dạng `https://<tên-miền>/api/mcp/<key>`. Lưu ý: key nằm trong địa chỉ nên có thể xuất hiện trong nhật ký của máy chủ trung gian và lịch sử ChatGPT. Hãy tạo **một key riêng cho ChatGPT**, đừng dùng chung với các thiết bị khác, và xoá key khi không dùng nữa. Cách này vẫn đi qua cùng bước kiểm tra key (sai thì 401, sai 5 lần thì khoá 15 phút).

**Các công cụ (đủ quyền đọc và ghi):**

| Nhóm | Công cụ |
|---|---|
| Tổng quan | `tong_quan` (số xe, số bài, đang ẩn, tên cửa hàng) |
| Xe | `tim_xe`, `xem_xe`, `luu_xe` (tạo hoặc sửa), `bat_tat_xe`, `xoa_xe` |
| Bài viết | `tim_bai_viet`, `xem_bai_viet`, `luu_bai_viet` (tạo hoặc sửa), `bat_tat_bai_viet`, `xoa_bai_viet` |
| Cửa hàng | `xem_thong_tin_cua_hang`, `luu_thong_tin_cua_hang` |
| Hướng dẫn | `huong_dan` (AI tự hỏi cách dùng, chung hoặc theo phần: xe, bai_viet, trang_chu, bo_suu_tap, mau, hinh_anh, menu, danh_muc, cua_hang). Phần hướng dẫn chung cũng được gửi kèm ngay khi AI kết nối (`instructions` của MCP), sửa ở `src/lib/mcp-guide.ts` |
| Danh mục | `xem_danh_muc` (hãng, loại xe, mục tin), `luu_danh_muc` (thêm hoặc sửa, không xoá mục nào), `xoa_muc_danh_muc` (xoá một mục, bị từ chối nếu còn xe hoặc bài đang dùng) |
| Menu đầu trang | `xem_menu`, `luu_menu` |
| Trang chủ | `xem_trang_chu` (banner đầu trang và các mục), `luu_trang_chu` |
| Bộ sưu tập | `xem_bo_suu_tap`, `luu_bo_suu_tap` (tạo hoặc sửa), `sap_xep_bo_suu_tap`, `xoa_bo_suu_tap` |
| Mẫu | `xem_mau`, `luu_mau`, `nhan_ban_mau`, `xoa_mau` |
| Hình ảnh | `tim_hinh_anh`, `xem_hinh_anh` (kèm nơi đang dùng), `tai_anh_tu_link`, `tai_anh_tu_file` (ảnh người dùng đính kèm trong chat, ứng dụng tự truyền tệp, ví dụ ChatGPT), `lay_lenh_tai_anh_len` (cho AI có Bash: trả lệnh `curl` upload tệp), `tao_link_tai_anh` (dự phòng: trang web dùng một lần để người dùng tự chọn ảnh), `tai_anh_len` (base64, chỉ cho ảnh rất nhỏ), `doi_ten_hinh_anh`, `thay_hinh_anh` (thay nội dung, mọi nơi dùng tự đổi), `xoa_hinh_anh` |

- Sửa (`luu_xe`, `luu_bai_viet`, `luu_thong_tin_cua_hang`): trường nào không gửi thì giữ nguyên. Mọi kiểm tra dữ liệu (hãng, mục, link ảnh, đường dẫn không trùng...) dùng đúng hàm của trang quản trị (`src/lib/admin-service.ts`).
- Xoá (`xoa_xe`, `xoa_bai_viet`) bắt buộc gửi `confirm: true`, thiếu là bị từ chối. Không có công cụ xoá hàng loạt hay đặt lại dữ liệu.
- Ô HTML đi qua cùng bộ lọc như trang quản trị, tức là **giữ nguyên mọi thẻ kể cả `<script>`** (xem "Bảo mật"). Người giữ key có quyền như quản trị viên, nên giữ key như mật khẩu.
- Mỗi thao tác ghi in một dòng ra nhật ký máy chủ (`[mcp] key="<tên key>" tool=... id=...`), không bao giờ in key.
- **Ảnh từ trang web khác** (`<img src="https://...">` trong nội dung, ảnh bìa, ảnh xe, thư viện ảnh, ảnh của dòng phiên bản) gửi trong lần gọi `luu_bai_viet` hoặc `luu_xe` được **tự tải về server** vào mục Hình ảnh và đổi thành `/uploads/<mã>`, giống như dán link vào trang quản trị. Ảnh không tải được thì giữ nguyên link và công cụ trả thêm `canh_bao_anh_khong_tai_duoc`. Chỉ xử lý các trường có trong lần gọi, nội dung đã lưu trước đó không bị tải lại. Mỗi ảnh tối đa 10 MB và mỗi lần lưu tải tối đa 30 ảnh (ảnh vượt giới hạn giữ nguyên link và có cảnh báo, lưu lần nữa để tải tiếp); server chỉ tải từ địa chỉ công khai trên internet.

**Tải tệp ảnh lên bằng lệnh (không gõ base64).** Cho AI có Bash (Claude Code…): gọi `lay_lenh_tai_anh_len` để lấy địa chỉ và lệnh mẫu, rồi chạy

```bash
curl -sS -H "Authorization: Bearer $YENTHOA_MCP_KEY" -F "file=@/duong/dan/anh.webp" -F "name=banner-24-11" https://<tên-miền>/api/mcp-upload
```

- Key là key MCP ở trang Kết nối, đặt trong biến môi trường `YENTHOA_MCP_KEY` (với Claude Code trên web: nhập ở phần bí mật của môi trường, đừng dán vào hội thoại). Máy chạy lệnh phải truy cập được tên miền của website. Claude Desktop không có Bash nên không dùng được cách này.
- Chỉ nhận key trong header `Authorization: Bearer`, không dùng phiên đăng nhập admin. Thiếu hoặc sai key: 401; key tắt: 401; sai nhiều lần: 429 (cùng bộ đếm với `/api/mcp`).
- Đúng một tệp, trường tên `file`, trường `name` tuỳ chọn. JPG, PNG, WebP, GIF, AVIF, tối đa 10 MB (quá giới hạn: 413). Loại ảnh xác định bằng nội dung tệp, không tin phần mở rộng hay Content-Type; SVG và tệp hỏng bị từ chối (422, kèm kích thước, chữ ký tệp và lỗi gốc). Ảnh được nén WebP, bỏ EXIF/GPS, mỗi lần tải là một mã mới (không ghi đè).
- Trả `{"link":"/uploads/<mã>","id":"<mã>"}`. Nhật ký máy chủ ghi một dòng `tool=tai_anh_len_tep`, không ghi key.
- Kiểm thử: `BASE_URL=http://127.0.0.1:3000 MCP_KEY=<key> npm run test:upload` (chạy vào server đang chạy, ảnh thử được xoá lại).
**Ảnh đính kèm trong chat (`tai_anh_tu_file`).** Công cụ khai báo `_meta: {"openai/fileParams": ["file"]}` (Apps SDK của OpenAI). Ứng dụng chat đổi tệp người dùng đính kèm thành đối tượng `file` gồm `download_url` và `file_id` (tuỳ chọn `mime_type`, `file_name`), nên AI không phải mã hoá gì. Server tải ngay từ `download_url` trong lần gọi đó (link tạm sẽ hết hạn, hết hạn thì báo AI nhờ người dùng gửi lại ảnh) và trả `image_id`, `url`, `size`, `mime_type` (ảnh lưu dạng WebP, `kich_thuoc_goc` là dung lượng tệp gốc).
- Chỉ nhận link **https**, mỗi bước chuyển hướng (tối đa 4) đều kiểm tra lại; địa chỉ nội bộ, riêng tư, metadata đám mây bị chặn; chờ tối đa 15 giây, tối đa 10 MB; loại ảnh xác định bằng nội dung tệp chứ không tin Content-Type (link tạm thường trả `application/octet-stream`).
- Biến môi trường tuỳ chọn `MCP_FILE_HOSTS` (danh sách tên miền cách nhau bằng dấu phẩy, gồm cả tên miền con) giới hạn nơi được phép tải tệp, ví dụ `MCP_FILE_HOSTS=files.example.com` (thay bằng tên miền thật của link tạm). Để trống thì nhận mọi địa chỉ https công khai. Nên đặt sau khi đã xem nhật ký thật để biết tên miền link tạm của ứng dụng chat đang dùng.
- Nhật ký chỉ ghi `file_id`, không ghi `download_url` (link có chữ ký).

**Trang tải ảnh dùng một lần (`tao_link_tai_anh`).** Cho ứng dụng không truyền được tệp và không có Bash. AI gọi công cụ (tuỳ chọn `name`, `phut` từ 1 đến 30, mặc định 10) để lấy địa chỉ `https://<tên-miền>/tai-anh/ytu_...`; người dùng mở bằng trình duyệt, chọn ảnh, bấm Tải lên; AI gọi `tim_hinh_anh` với tên ảnh đã đặt để lấy link `/uploads/<mã>`.
- Địa chỉ là bí mật duy nhất: ngẫu nhiên 192 bit, **dùng một lần**, hết hạn sau vài phút; cơ sở dữ liệu (bảng `upload_links`) chỉ lưu băm SHA-256, không lưu địa chỉ. Mở trang không làm mất lượt (để ứng dụng xem trước link không tiêu hao); chỉ lần tải thành công mới dùng hết. Tệp bị từ chối (không phải ảnh, quá lớn) thì địa chỉ vẫn dùng lại được. Hai lần tải cùng lúc chỉ một lần thành công.
- Trang không có script, gửi kèm CSP chặt, `noindex`, `no-store`. Đoán sai địa chỉ quá 5 lần trong 15 phút từ một địa chỉ mạng: 429.
- Kiểm thử: `BASE_URL=http://127.0.0.1:3000 MCP_KEY=<key> npm run test:upload-link` (phần `tai_anh_tu_file` cần server chạy với `IMPORT_ALLOW_PRIVATE=1 NODE_TLS_REJECT_UNAUTHORIZED=0`, chỉ để thử; đặt `SKIP_FILE_TOOL=1` để bỏ qua). Phần tải tệp không cần cơ sở dữ liệu: `npm run test:file-fetch`.
- **Danh sách gửi nguyên cái** (`luu_trang_chu` cho banner và các mục, `luu_menu` cho cây menu): danh sách gửi lên thay thế cả danh sách cũ, nên lấy từ `xem_trang_chu` hoặc `xem_menu` rồi sửa. Gửi ít mục hơn hiện tại thì bị từ chối, trừ khi gửi `cho_phep_bo: true`. Phần không gửi (ví dụ chỉ gửi `sections`, không gửi `slides`) thì giữ nguyên.
- **Hình ảnh:** `xoa_hinh_anh` từ chối khi ảnh đang được dùng (liệt kê nơi dùng), trừ khi gửi `ke_ca_dang_dung: true`; `thay_hinh_anh` và `xoa_hinh_anh` đều cần `confirm: true`. Ảnh ngoài ở trang chủ, bộ sưu tập (ảnh, ảnh nền, HTML) cũng được tự tải về server như ở xe và bài viết.
- Không qua MCP, cố ý: trang Kết nối (tạo, xoá key), nạp dữ liệu mẫu, đăng nhập, và đường dẫn file trên máy bạn (máy chủ không đọc được; gửi ảnh bằng lệnh từ `lay_lenh_tai_anh_len`, bằng tệp đính kèm `tai_anh_tu_file`, bằng trang `tao_link_tai_anh`, hoặc link bằng `tai_anh_tu_link`).

## Quy tắc ảnh (giống nhau ở mọi nơi)

Khung HTML, mọi ô nhập ảnh (banner, nền, thẻ, bộ sưu tập, bài viết, xe, cửa hàng, lựa chọn màu), ô danh sách ảnh của xe và trang Hình ảnh đều theo cùng một bộ quy tắc. Mã nằm ở `src/lib/image-rules.ts` (phía trình duyệt) và `src/lib/uploads.ts`, `src/lib/import-image.ts`, `src/lib/media-ref.ts` (phía server).

| Quy tắc | Cách hoạt động |
|---|---|
| Ảnh lưu bằng mã | Chỗ nào dùng ảnh cũng chỉ giữ `/uploads/<mã>`. Thay ảnh ở trang Hình ảnh thì mọi chỗ đang dùng ảnh đó đổi theo |
| Dán ảnh đã sao chép (Ctrl+V) | Ảnh được tải lên rồi mới dùng. Ô một ảnh thì lấy ảnh đó, ô danh sách thì thêm một dòng, khung HTML thì chèn thẻ ảnh |
| Kéo thả tệp ảnh vào ô | Giống dán ảnh |
| Khung HTML tự định dạng | HTML dính thành một dòng dài (bài Facebook, nội dung dán, tệp Word) tự được xuống dòng và thụt lề giữa các thẻ khối khi mở, khi dán/nhập tệp và khi bấm ra ngoài khung. Chỉ đổi khoảng trắng giữa các thẻ, không đổi chữ. HTML đã xuống dòng sẵn hoặc có `display:inline`, `float` thì để nguyên |
| Nút **Nhập từ tệp** (khung HTML) | Chọn hoặc kéo thả tệp **Word (.docx)**: giữ tiêu đề (Heading 1 thành `<h2>`, Heading 2 thành `<h3>`, vì `<h1>` là tiêu đề bài), đoạn, danh sách, bảng, in đậm/nghiêng, link, **màu chữ**, **chữ tô nền**, **nền ô bảng** (hàng tiêu đề màu, ô nổi bật), **khung nổi bật** (đoạn có nền hoặc viền, thanh trích dẫn), căn lề đoạn (giữa, phải) (chữ trắng trên nền sáng bị bỏ để khỏi biến mất; chữ trên nền tối tự trắng) và **kích thước, vị trí (trái, giữa, phải) của ảnh** như trong Word (không phóng to hết bề ngang); không giữ cỡ chữ và font; ảnh trong tệp được lưu vào mục Hình ảnh. Tệp **PDF**: đọc theo vị trí và cỡ chữ để nhận ra tiêu đề (chữ to), đoạn văn, bảng (chữ chia cột trên cùng một dòng) và danh sách (dòng bắt đầu bằng • hoặc 1.); **ảnh** trong PDF được lưu vào mục Hình ảnh và đặt đúng thứ tự giữa các đoạn, giữ kích thước và vị trí trái/giữa/phải; không giữ màu và bố cục trang, ảnh nằm cạnh chữ (chữ bao quanh ảnh) thì ảnh đứng riêng một dòng (dấu chấm đầu dòng vẽ bằng hình thay vì ký tự thì không nhận ra danh sách); PDF quét thành ảnh thì chèn từng trang dưới dạng ảnh. Tệp ảnh (thiết kế Canva xuất PNG/JPG) được tải lên rồi chèn thẻ ảnh. Tối đa 10 MB mỗi tệp. Nội dung chèn vào chỗ con trỏ |
| Link ảnh của trang khác (`https://...`) | Tự tải về kho Hình ảnh và đổi thành `/uploads/<mã>`. Ở ô nhập ảnh tự tải khi dán hoặc khi bấm ra ngoài, hoặc bấm nút **Tải ảnh về**. Ở khung HTML cũng tự tải, ảnh còn sót thì bấm nút nhắc ở dưới khung |
| Tải về không được | Giữ nguyên link gốc, hiện lỗi và nhắc là ảnh có thể mất nếu trang kia xoá |
| Link ảnh của chính trang này | Dùng luôn, link đầy đủ (kèm tên miền) được cắt ngắn thành `/uploads/<mã>`, không tải lại |
| Giới hạn | Tối đa 10 MB mỗi ảnh (server nhận tối đa 12 MB một lần gửi, đặt ở `next.config.ts`; mặc định của Next chỉ 1 MB nên ảnh lớn hơn bị lỗi 500), định dạng JPG, PNG, WebP, GIF hoặc AVIF. Khi lưu, ảnh được nén lại thành WebP (rộng tối đa 1600px) và bỏ thông tin EXIF/GPS. Cùng một giới hạn và cùng một thông báo ở trình duyệt lẫn server |
| Link ngoài và địa chỉ nội bộ | Server chỉ tải từ địa chỉ công khai (chặn địa chỉ mạng nội bộ). Công tắc `IMPORT_ALLOW_PRIVATE` chỉ để thử trên máy dev, tuyệt đối không đặt trên server thật |

