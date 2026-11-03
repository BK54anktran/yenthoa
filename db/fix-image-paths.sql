-- Sửa đường dẫn ảnh nếu dữ liệu đã nạp bị đổi thành /sites/xemay_hungphat_db/... (thư mục ảnh thật là /sites/hungphat/).
-- Chạy trong đúng database của website. An toàn khi chạy lại.
UPDATE posts         SET img = REPLACE(img, '/sites/xemay_hungphat_db/', '/sites/hungphat/'), html = REPLACE(html, '/sites/xemay_hungphat_db/', '/sites/hungphat/');
UPDATE products      SET img = REPLACE(img, '/sites/xemay_hungphat_db/', '/sites/hungphat/'),
                         gallery = REPLACE(gallery, '/sites/xemay_hungphat_db/', '/sites/hungphat/'),
                         variants = REPLACE(variants, '/sites/xemay_hungphat_db/', '/sites/hungphat/'),
                         short_html = REPLACE(short_html, '/sites/xemay_hungphat_db/', '/sites/hungphat/'),
                         html = REPLACE(html, '/sites/xemay_hungphat_db/', '/sites/hungphat/');
UPDATE hero_slides   SET img = REPLACE(img, '/sites/xemay_hungphat_db/', '/sites/hungphat/');
UPDATE settings      SET v = CAST(REPLACE(CAST(v AS CHAR), '/sites/xemay_hungphat_db/', '/sites/hungphat/') AS JSON);
