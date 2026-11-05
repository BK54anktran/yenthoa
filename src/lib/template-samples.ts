// Templates that come with the site (they cannot be edited; "Tạo bản sao" makes an editable copy).
import type { Template } from "./template.ts";

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "mau-dem-nguoc",
    name: "Đồng hồ đếm ngược",
    description: "Khung đếm ngược đến một ngày giờ, có nút bấm. Để trống ngày thì tự đếm đến hết hôm nay, mỗi ngày bắt đầu lại.",
    builtIn: true,
    fields: [
      { key: "eyebrow", label: "Dòng nhỏ phía trên", type: "text", default: "Ưu đãi xe máy tháng 11" },
      { key: "title", label: "Tiêu đề", type: "text", default: "Chương trình kết thúc sau" },
      { key: "sub", label: "Mô tả ngắn", type: "text", default: "Giá tốt, hỗ trợ trả góp, giao xe nhanh. Liên hệ cửa hàng để giữ xe." },
      { key: "end", label: "Thời điểm kết thúc (giờ Việt Nam)", type: "datetime", default: "2026-11-30T23:59", hint: "Để trống = đếm đến hết ngày hôm nay, mỗi ngày bắt đầu lại." },
      { key: "btn_text", label: "Chữ trên nút", type: "text", default: "Xem xe ưu đãi →" },
      { key: "btn_link", label: "Đường dẫn của nút", type: "link", default: "/xe-may", hint: "Để trống = không hiện nút." },
      { key: "ended_title", label: "Tiêu đề khi đã hết giờ", type: "text", default: "Chương trình đã kết thúc" },
      { key: "ended_text", label: "Lời nhắn khi đã hết giờ", type: "text", default: "Hẹn bạn ở đợt ưu đãi sau!" },
    ],
    html: `<style>
.hp-cd { margin: 0 0 40px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px 32px; padding: 26px 30px; background: #2b2b2b; color: #fff; border-left: 6px solid #de0000; line-height: 1.25; }
.hp-cd-info { flex: 1 1 260px; min-width: 0; }
.hp-cd-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #ff6b6b; }
.hp-cd-title { margin-top: 8px; font-size: 26px; font-weight: 600; text-transform: uppercase; }
.hp-cd-sub { margin-top: 8px; font-size: 13px; color: #b5b5b5; }
.hp-cd-boxes { display: flex; gap: 8px; }
.hp-cd-box { width: 84px; padding: 13px 4px 11px; border: 1px solid rgba(255,255,255,.22); background: #1f1f1f; text-align: center; }
.hp-cd-box.hp-cd-sec { border-color: #de0000; background: #de0000; }
.hp-cd-num { display: block; font-size: 34px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.hp-cd-lbl { display: block; margin-top: 8px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #a8a8a8; }
.hp-cd-sec .hp-cd-lbl { color: #ffd9d9; }
.hp-cd .hp-cd-btn { display: inline-block; padding: 14px 26px; background: #de0000; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; text-decoration: none; white-space: nowrap; }
.hp-cd .hp-cd-btn:hover { background: #fff; color: #de0000; }
.hp-cd-end { display: none; font-size: 18px; font-weight: 600; text-transform: uppercase; }
@media (max-width: 900px) {
  .hp-cd { padding: 22px 16px; }
  .hp-cd-boxes { width: 100%; }
  .hp-cd-box { flex: 1; width: auto; }
  .hp-cd-num { font-size: 28px; }
  .hp-cd .hp-cd-btn { display: block; width: 100%; box-sizing: border-box; text-align: center; }
  .hp-cd-title { font-size: 22px; }
}
</style>

<div id="{{_id}}" class="hp-cd" data-end="{{end}}" data-ended-title="{{ended_title}}">
  <div class="hp-cd-info">
    {{#if eyebrow}}<div class="hp-cd-eyebrow">{{eyebrow}}</div>{{/if}}
    <div data-k="title" class="hp-cd-title">{{title}}</div>
    {{#if sub}}<div class="hp-cd-sub">{{sub}}</div>{{/if}}
  </div>

  <div data-k="boxes" class="hp-cd-boxes">
    <div class="hp-cd-box"><span data-k="d" class="hp-cd-num">00</span><span class="hp-cd-lbl">Ngày</span></div>
    <div class="hp-cd-box"><span data-k="h" class="hp-cd-num">00</span><span class="hp-cd-lbl">Giờ</span></div>
    <div class="hp-cd-box"><span data-k="m" class="hp-cd-num">00</span><span class="hp-cd-lbl">Phút</span></div>
    <div class="hp-cd-box hp-cd-sec"><span data-k="s" class="hp-cd-num">00</span><span class="hp-cd-lbl">Giây</span></div>
  </div>
  <div data-k="end" class="hp-cd-end">{{ended_text}}</div>

  {{#if btn_link}}<a class="hp-cd-btn" href="{{btn_link}}">{{btn_text}}</a>{{/if}}
</div>

<script>
(function () {
  var root = document.getElementById('{{_id}}');
  if (!root || root.getAttribute('data-ok')) return; // start once per block
  root.setAttribute('data-ok', '1');

  var q = function (k) { return root.querySelector('[data-k=' + k + ']'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var raw = root.getAttribute('data-end') || '';
  if (/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d$/.test(raw)) raw += ':00+07:00'; // typed in the admin without a zone: Vietnam time

  // the end: the date typed, or (when empty) the end of today in Vietnam, starting again every day
  function endTime() {
    var t = raw ? Date.parse(raw) : NaN;
    if (!isNaN(t)) return t;
    var vn = new Date(Date.now() + 7 * 3600 * 1000);
    return Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1) - 7 * 3600 * 1000;
  }

  var timer;
  function tick() {
    if (!document.body.contains(root)) { clearInterval(timer); return; } // the visitor went to another page
    var left = Math.max(0, endTime() - Date.now());
    var s = Math.floor(left / 1000);
    q('d').textContent = pad(Math.floor(s / 86400));
    q('h').textContent = pad(Math.floor(s % 86400 / 3600));
    q('m').textContent = pad(Math.floor(s % 3600 / 60));
    q('s').textContent = pad(s % 60);
    if (left === 0) {
      q('title').textContent = root.getAttribute('data-ended-title') || '';
      q('boxes').style.display = 'none';
      q('end').style.display = 'block';
      clearInterval(timer);
    }
  }
  timer = setInterval(tick, 1000);
  tick();
})();
</script>
`,
  },
  {
    id: "mau-tra-gop",
    name: "Máy tính trả góp",
    description: "Khách kéo thanh để xem số tiền phải trả mỗi tháng (tính theo dư nợ giảm dần).",
    builtIn: true,
    fields: [
      { key: "eyebrow", label: "Dòng nhỏ phía trên", type: "text", default: "Mua xe trả góp" },
      { key: "title", label: "Tiêu đề", type: "text", default: "Tính trả góp nhanh" },
      { key: "sub", label: "Mô tả ngắn", type: "text", default: "Kéo thanh để xem số tiền phải trả mỗi tháng. Số liệu chỉ để tham khảo." },
      { key: "price", label: "Giá xe mặc định (đồng)", type: "number", default: 30000000 },
      { key: "down", label: "Trả trước mặc định (%)", type: "number", default: 30, hint: "Từ 10 đến 70, bước 5." },
      { key: "rate", label: "Lãi suất mặc định (%/tháng)", type: "number", default: 0.55 },
      { key: "months", label: "Các kỳ hạn (tháng)", type: "list", max: 8, fields: [{ key: "n", label: "Số tháng", type: "number" }], default: [{ n: 6 }, { n: 12 }, { n: 18 }, { n: 24 }, { n: 36 }] },
      { key: "months_default", label: "Kỳ hạn chọn sẵn (tháng)", type: "number", default: 12 },
      { key: "note", label: "Ghi chú dưới kết quả", type: "text", default: "Tính theo dư nợ giảm dần, chưa gồm phí hồ sơ và bảo hiểm. Liên hệ cửa hàng để nhận báo giá chính xác." },
    ],
    html: `<style>
.hp-tg { margin: 0 0 40px; display: flex; flex-wrap: wrap; border: 1px solid #e5e5e5; border-left: 6px solid #de0000; background: #fff; line-height: 1.3; }
.hp-tg-form { flex: 1 1 380px; min-width: 0; padding: 26px 30px; }
.hp-tg-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #de0000; }
.hp-tg-title { margin-top: 8px; font-size: 26px; font-weight: 600; text-transform: uppercase; color: #111; }
.hp-tg-sub { margin-top: 8px; font-size: 13px; color: #777; }
.hp-tg-f { display: block; margin-top: 18px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #333; }
.hp-tg-f b { color: #de0000; }
.hp-tg-in { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 11px 12px; border: 1px solid #d4d4d4; border-radius: 0; background: #fff; font: inherit; font-size: 16px; font-weight: 500; text-transform: none; letter-spacing: 0; color: #111; }
.hp-tg-in:focus { outline: none; border-color: #de0000; }
.hp-tg input[type=range].hp-tg-in { padding: 0; border: 0; height: 22px; accent-color: #de0000; }
.hp-tg-row { display: flex; gap: 14px; }
.hp-tg-row .hp-tg-f { flex: 1; min-width: 0; }
.hp-tg-out { flex: 0 1 340px; min-width: 260px; box-sizing: border-box; padding: 26px 30px; background: #2b2b2b; color: #fff; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.hp-tg-lbl { font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #ff6b6b; }
.hp-tg-big { margin-top: 10px; font-size: 38px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.hp-tg-det { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.18); font-size: 13px; line-height: 1.7; color: #c4c4c4; }
.hp-tg-det b { color: #fff; font-weight: 600; }
.hp-tg-note { margin-top: 14px; font-size: 11px; color: #8d8d8d; }
@media (max-width: 900px) {
  .hp-tg-form, .hp-tg-out { padding: 22px 16px; }
  .hp-tg-out { flex: 1 1 100%; }
  .hp-tg-title { font-size: 22px; }
  .hp-tg-row { flex-direction: column; gap: 0; }
}
</style>

<div id="{{_id}}" class="hp-tg">
  <div class="hp-tg-form">
    {{#if eyebrow}}<div class="hp-tg-eyebrow">{{eyebrow}}</div>{{/if}}
    <div class="hp-tg-title">{{title}}</div>
    {{#if sub}}<div class="hp-tg-sub">{{sub}}</div>{{/if}}

    <label class="hp-tg-f">Giá xe (đồng)
      <input data-k="gia" class="hp-tg-in" type="number" value="{{price}}" min="1000000" step="500000">
    </label>
    <label class="hp-tg-f">Trả trước: <b data-k="tt-v">{{down}}%</b>
      <input data-k="tt" class="hp-tg-in" type="range" min="10" max="70" step="5" value="{{down}}">
    </label>
    <div class="hp-tg-row">
      <label class="hp-tg-f">Số tháng
        <select data-k="thang" class="hp-tg-in" data-default="{{months_default}}">
          {{#each months}}<option value="{{n}}">{{n}} tháng</option>{{/each}}
        </select>
      </label>
      <label class="hp-tg-f">Lãi suất (%/tháng)
        <input data-k="lai" class="hp-tg-in" type="number" value="{{rate}}" step="0.05" min="0">
      </label>
    </div>
  </div>

  <div class="hp-tg-out">
    <div class="hp-tg-lbl">Mỗi tháng trả</div>
    <div data-k="kq-big" class="hp-tg-big">0₫</div>
    <div data-k="kq" class="hp-tg-det"></div>
    {{#if note}}<div class="hp-tg-note">{{note}}</div>{{/if}}
  </div>
</div>

<script>
(function () {
  var root = document.getElementById('{{_id}}');
  if (!root || root.getAttribute('data-ok')) return; // start once per block
  root.setAttribute('data-ok', '1');

  var q = function (k) { return root.querySelector('[data-k=' + k + ']'); };
  var vnd = function (n) { return Math.round(n).toLocaleString('vi-VN') + '₫'; };
  var sel = q('thang');
  if (sel.getAttribute('data-default')) sel.value = sel.getAttribute('data-default');

  function tinh() {
    var gia = Math.max(0, +q('gia').value || 0);
    var tt = +q('tt').value;
    var n = +sel.value || 12;
    var r = (+q('lai').value || 0) / 100;

    q('tt-v').textContent = tt + '%';
    var traTruoc = gia * tt / 100;
    var vay = gia - traTruoc;
    var moiThang = r > 0 ? vay * r / (1 - Math.pow(1 + r, -n)) : vay / n;
    var tongLai = moiThang * n - vay;

    q('kq-big').textContent = vnd(moiThang);
    q('kq').innerHTML =
      'Trả trước <b>' + vnd(traTruoc) + '</b><br>Vay <b>' + vnd(vay) + '</b> · ' + n + ' tháng<br>Tổng lãi tạm tính: <b>' + vnd(tongLai) + '</b>';
  }

  ['gia', 'tt', 'thang', 'lai'].forEach(function (k) { q(k).addEventListener('input', tinh); });
  tinh();
})();
</script>
`,
  },
];
