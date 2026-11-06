// Hướng dẫn dùng bộ công cụ MCP cho AI. Phần ngắn gửi kèm khi kết nối (instructions);
// phần chi tiết theo chủ đề lấy bằng công cụ huong_dan.

export const MCP_INSTRUCTIONS = `Đây là trang quản trị của một website bán xe. Bạn đọc và sửa nội dung giống người quản trị.
Cách làm: (1) gọi tong_quan để biết có gì; (2) tìm bằng tim_* hoặc xem_*; (3) sửa bằng luu_*; (4) nói lại cho người dùng đã đổi gì.
Quy ước chung:
- Xem trước khi sửa. Sửa một xe, bài viết, bộ sưu tập, mẫu: chỉ gửi trường cần đổi, trường không gửi giữ nguyên.
- Trang chủ (banner, các mục) và menu: danh sách gửi lên thay cả danh sách cũ, nên lấy từ xem_trang_chu hoặc xem_menu, sửa rồi gửi lại đủ. Gửi ít mục hơn thì bị từ chối trừ khi có cho_phep_bo: true.
- Ảnh: dùng link /uploads/<mã> trong kho. Ảnh đã đưa lên kho thì dùng lại, đừng tải lại. Cách đưa ảnh lên, theo thứ tự ưu tiên: (1) ảnh có link công khai: tai_anh_tu_link; (2) người dùng đính kèm ảnh trong khung chat và ứng dụng cho truyền tệp: tai_anh_tu_file; (3) bạn chạy được lệnh (Bash): lay_lenh_tai_anh_len rồi chạy lệnh curl nó trả về; (4) không có cách nào ở trên: tao_link_tai_anh, đưa link cho người dùng mở bằng trình duyệt và chọn ảnh, sau đó tìm ảnh bằng tim_hinh_anh; (5) chỉ khi ảnh rất nhỏ: tai_anh_len (base64, dễ sai nếu ảnh lớn). Máy chủ không đọc được đường dẫn file trên máy người dùng. Link ảnh ngoài gửi trong luu_xe, luu_bai_viet, luu_trang_chu, luu_bo_suu_tap được tự tải về.
- Xoá (xoa_*) cần confirm: true và không khôi phục được; chỉ làm khi người dùng yêu cầu rõ.
- Lỗi trả về tiếng Việt, đọc rồi sửa đúng chỗ, đừng gửi lại y nguyên.
- Chưa chắc cách dùng một phần: gọi huong_dan với phan là xe, bai_viet, trang_chu, bo_suu_tap, mau, hinh_anh, menu, danh_muc, cua_hang.`;

const TOPICS: Record<string, string> = {
  xe: `XE. tim_xe (q: từ khoá trong tên hoặc mã; brand: mã hãng; active; page, per_page) → xem_xe (theo id) → luu_xe. Không có id là tạo mới (bắt buộc name); có id là sửa. Hãng (brand) và loại (types) là MÃ lấy từ xem_danh_muc. Giá bằng đồng (price từ, priceMax đến). variants là các dòng phiên bản và màu, specs là nhóm thông số. bat_tat_xe ẩn hoặc hiện. xoa_xe cần confirm. Ảnh xe, gallery, ảnh dòng phiên bản đều nhận link ngoài và tự tải về.`,
  bai_viet: `BÀI VIẾT. tim_bai_viet (q, section là mã mục tin, published, page, per_page) → xem_bai_viet (theo id) → luu_bai_viet (không id: tạo, bắt buộc title; có id: sửa). date dạng YYYY-MM-DD. html được lọc an toàn; thẻ img link ngoài tự tải về. Mã mục tin lấy từ xem_danh_muc. bat_tat_bai_viet ẩn hoặc hiện, xoa_bai_viet cần confirm.`,
  trang_chu: `TRANG CHỦ. xem_trang_chu trả slides (banner đầu trang) và sections (các mục). luu_trang_chu nhận slides và/hoặc sections; phần nào không gửi thì giữ nguyên, phần đã gửi thay cả danh sách. Mỗi banner cần ảnh (img); mỗi mục có kind và name. Bỏ bớt banner hoặc mục thì cần cho_phep_bo: true.`,
  bo_suu_tap: `BỘ SƯU TẬP. xem_bo_suu_tap → luu_bo_suu_tap (không id: tạo, cần name; có id: sửa). mode manual: chọn xe bằng slugs; mode auto: theo brands, types, priceMin, priceMax. Bộ chọn tay chưa có xe được tạo ở trạng thái ẩn. sap_xep_bo_suu_tap dời lên hoặc xuống, xoa_bo_suu_tap cần confirm.`,
  mau: `MẪU (khối giao diện dùng lại). xem_mau liệt kê mẫu có sẵn và mẫu riêng; luu_mau tạo hoặc sửa mẫu riêng; nhan_ban_mau sao một mẫu để chỉnh; xoa_mau cần confirm.`,
  hinh_anh: `HÌNH ẢNH (kho ảnh). tim_hinh_anh, xem_hinh_anh (kèm nơi đang dùng). Thêm ảnh: tai_anh_tu_link (url, khi ảnh có link công khai); tai_anh_tu_file (file: ứng dụng tự truyền tệp người dùng đính kèm, ví dụ ChatGPT; link tải của tệp chỉ sống ngắn nên gọi ngay, nếu báo hết hạn thì xin người dùng gửi lại ảnh); lay_lenh_tai_anh_len (khi bạn có Bash: trả lệnh curl upload tệp, key lấy từ biến môi trường YENTHOA_MCP_KEY); tao_link_tai_anh (không có cách nào ở trên: trả một địa chỉ trang web dùng một lần, người dùng mở bằng trình duyệt và chọn ảnh; sau đó gọi tim_hinh_anh với tên ảnh đã đặt để lấy link); tai_anh_len (du_lieu_base64, chỉ cho ảnh rất nhỏ khi không có cách nào khác; JPG PNG WebP GIF AVIF, tối đa 10 MB), đều trả link /uploads/<mã> rồi dùng link đó ở banner, xe, bài viết. doi_ten_hinh_anh đổi tên. thay_hinh_anh đổi nội dung, mọi nơi dùng tự đổi (cần confirm). xoa_hinh_anh từ chối khi ảnh đang dùng trừ khi ke_ca_dang_dung: true.`,
  menu: `MENU ĐẦU TRANG. xem_menu → luu_menu với main (menu chính) và/hoặc secondary (menu phụ). Cây gửi lên thay cả cây cũ nên lấy từ xem_menu rồi sửa. Bỏ bớt mục thì cần cho_phep_bo: true.`,
  danh_muc: `DANH MỤC (hãng xe, loại xe, mục tin). xem_danh_muc → luu_danh_muc (brands, types, sections; mục có id là sửa, không id là thêm; không xoá mục nào; muốn ẩn thì active: false). Xoá hẳn: xoa_muc_danh_muc với loai (brands, types hoặc sections) và id, cần confirm; bị từ chối nếu còn xe hoặc bài đang dùng.`,
  cua_hang: `THÔNG TIN CỬA HÀNG. xem_thong_tin_cua_hang → luu_thong_tin_cua_hang (brand là tên cửa hàng, hotlines, facebook, branches là các dòng địa chỉ chân trang, stores là danh sách cửa hàng). Trường không gửi giữ nguyên; danh sách đã gửi thay cả danh sách cũ.`,
};

export const GUIDE_TOPICS = Object.keys(TOPICS);

export function guideFor(topic?: string): string {
  if (!topic) return `${MCP_INSTRUCTIONS}\n\nChủ đề chi tiết: ${GUIDE_TOPICS.join(", ")}.`;
  return TOPICS[topic] ?? `Không có chủ đề "${topic}". Chủ đề có: ${GUIDE_TOPICS.join(", ")}.`;
}
