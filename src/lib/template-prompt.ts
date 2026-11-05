import { FIELD_TYPES } from "./template.ts";

// The prompt the admin downloads and gives to an AI together with a piece of HTML: the answer is a template that can be pasted in the JSON tab.
export const TEMPLATE_PROMPT_FILE = "prompt-html-sang-mau.md";

export const TEMPLATE_PROMPT = `# Chuyển một đoạn HTML thành "mẫu" có ô nhập (schema JSON)

Bạn nhận một đoạn HTML (kèm CSS và JavaScript nếu có). Hãy chuyển nó thành một mẫu trong định dạng JSON bên dưới để người quản trị website tạo nhiều khối từ cùng một mẫu và chỉ cần điền vào các ô nhập, không phải sửa HTML.

**Chỉ trả về một khối JSON hợp lệ, không giải thích, không thêm chữ nào ngoài JSON.**

## Định dạng

\`\`\`json
{
  "name": "Tên mẫu (ngắn, tiếng Việt)",
  "description": "Một câu nói mẫu này dùng để làm gì",
  "html": "<HTML đã thay chữ, ảnh, link... bằng {{tên_trường}}>",
  "fields": [
    { "key": "tieu_de", "label": "Tiêu đề", "type": "text", "default": "Nội dung gốc trong HTML" }
  ]
}
\`\`\`

## Các kiểu trường (\`type\`)

${FIELD_TYPES.map((t) => `- \`${t.id}\`: ${t.label}`).join("\n")}

- \`select\` cần \`"options": [{ "value": "a", "label": "Nhãn" }, ...]\` (hoặc một mảng chữ).
- \`list\` cần \`"fields": [ ...các trường con, KHÔNG được có list lồng trong list ]\`, tùy chọn \`"max"\` (số dòng tối đa, mặc định 12, tối đa 50) và \`"default": [ { "tên_trường_con": "giá trị" }, ... ]\`.
- Mỗi trường có thể có \`"hint"\` (gợi ý ngắn dưới ô nhập) và \`"default"\` (giá trị mặc định = nội dung gốc của HTML để mẫu trông đúng ngay khi thêm).
- \`key\`: chữ thường không dấu, số, gạch dưới, bắt đầu bằng chữ, tối đa 31 ký tự, không trùng nhau, không dùng "site", "this", "index", "number".
- \`datetime\` lưu dạng \`YYYY-MM-DDTHH:mm\` (giờ Việt Nam, không có múi giờ).

## Cách viết \`html\`

- \`{{key}}\`: chèn giá trị của trường. Chữ được tự thoát ký tự đặc biệt; trường \`html\` chèn nguyên văn; \`image\` và \`link\` được kiểm tra (link \`javascript:\` bị bỏ).
- \`{{#if key}}...{{else}}...{{/if}}\` hiện khi giá trị không rỗng / không tắt / khác 0. \`{{#unless key}}...{{/unless}}\` ngược lại.
- \`{{#each danh_sach}}...{{/each}}\` lặp qua từng dòng của một trường \`list\`; bên trong dùng tên trường con, \`{{@index}}\` (0, 1, 2...) và \`{{@number}}\` (1, 2, 3...).
- \`{{_id}}\`: một mã riêng của từng khối trên trang. **Bắt buộc** dùng nó cho mọi \`id\` mà JavaScript tìm, và tìm bên trong phần tử gốc, để hai khối cùng mẫu trên một trang không làm rối nhau. Ví dụ: \`<div id="{{_id}}" ...>\` rồi trong script \`var root = document.getElementById('{{_id}}'); root.querySelector('[data-k=ten]')\`.
- Số liệu của cửa hàng có sẵn: \`{{site.products}}\` (số mẫu xe), \`{{site.brands}}\` (số hãng), \`{{site.branches}}\` (số cửa hàng), \`{{site.hotline}}\` (hotline đầu tiên), \`{{site.name}}\` (tên cửa hàng).
- Không dùng \`{{\` cho việc khác. Nếu JavaScript cần dấu ngoặc nhọn đôi, thêm khoảng trắng giữa hai dấu: \`{ {\`.
- Đặt \`<style>\` và \`<script>\` ngay trong \`html\`. Đặt tên class có tiền tố riêng của mẫu để không đụng CSS của trang. Script chỉ khởi tạo một lần (ví dụ đánh dấu \`data-ok\` trên phần tử gốc) và dừng timer khi phần tử gốc không còn trong trang (\`document.body.contains(root)\`).
- Đừng đặt chữ, ảnh, link của một lần dùng cụ thể vào HTML: đưa chúng vào trường, và để nội dung gốc làm \`default\`.
- Ảnh luôn là trường \`image\` (đường dẫn). Link bấm được luôn là trường \`link\`.
- Chữ hiển thị nên là \`text\` hoặc \`textarea\`; nội dung có thẻ định dạng (đậm, link, xuống dòng...) là \`html\`.
- Giá trị trong script (ví dụ ngày kết thúc) hãy đặt vào thuộc tính \`data-...\` của phần tử gốc rồi đọc bằng \`getAttribute\`, đừng chèn thẳng \`{{...}}\` vào trong chuỗi JavaScript.

## Ví dụ

HTML gốc:

\`\`\`html
<div class="uu-dai"><h3>Giảm 5 triệu</h3><p>Cho khách mua xe Honda trong tháng này</p><a href="/xe-may">Xem xe</a></div>
\`\`\`

Kết quả:

\`\`\`json
{
  "name": "Thẻ ưu đãi",
  "description": "Một khung ưu đãi có tiêu đề, mô tả và nút bấm",
  "html": "<style>.uu-dai{padding:24px;background:#2b2b2b;color:#fff}.uu-dai a{display:inline-block;margin-top:12px;background:#de0000;color:#fff;padding:10px 20px}</style><div id=\\"{{_id}}\\" class=\\"uu-dai\\"><h3>{{title}}</h3><p>{{text}}</p>{{#if link}}<a href=\\"{{link}}\\">{{button}}</a>{{/if}}</div>",
  "fields": [
    { "key": "title", "label": "Tiêu đề", "type": "text", "default": "Giảm 5 triệu" },
    { "key": "text", "label": "Mô tả", "type": "textarea", "default": "Cho khách mua xe Honda trong tháng này" },
    { "key": "button", "label": "Chữ trên nút", "type": "text", "default": "Xem xe" },
    { "key": "link", "label": "Đường dẫn của nút", "type": "link", "default": "/xe-may", "hint": "Để trống = không hiện nút." }
  ]
}
\`\`\`

Bây giờ hãy chuyển đoạn HTML sau (dán bên dưới dòng này) và chỉ trả về JSON:
`;
