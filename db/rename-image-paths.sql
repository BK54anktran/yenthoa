-- Đổi đường dẫn ảnh cũ (/sites/hungphat/ và /sites/xemay_hungphat_db/) sang /sites/yenthoa/ (thư mục ảnh thật hiện nay).
-- Chạy trong đúng database của website sau khi triển khai bản mới. An toàn khi chạy lại.
UPDATE posts         SET img = REPLACE(REPLACE(img, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/'), html = REPLACE(REPLACE(html, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/');
UPDATE products      SET img = REPLACE(REPLACE(img, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/'),
                         gallery = REPLACE(REPLACE(gallery, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/'),
                         variants = REPLACE(REPLACE(variants, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/'),
                         short_html = REPLACE(REPLACE(short_html, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/'),
                         html = REPLACE(REPLACE(html, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/');
UPDATE hero_slides   SET img = REPLACE(REPLACE(img, '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/');
UPDATE settings      SET v = CAST(REPLACE(REPLACE(CAST(v AS CHAR), '/sites/hungphat/', '/sites/yenthoa/'), '/sites/xemay_hungphat_db/', '/sites/yenthoa/') AS JSON);
