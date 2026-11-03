#!/usr/bin/env bash
# Bật MySQL + dữ liệu mẫu + website (cổng 3000) rồi chụp ảnh 390x844 và 1280x800.
# Dùng:  tools/dev/run.sh up                       # bật mọi thứ (lần đầu: tạo DB, nạp dữ liệu mẫu)
#        tools/dev/run.sh shot /  /xe  /admin      # chụp các đường dẫn ở cả hai cỡ → $OUT (mặc định /tmp/yenthoa/shots)
#        tools/dev/run.sh status | down
# Admin: user admin / mật khẩu YenThoa2026demo (chỉ để thử, đặt qua biến môi trường của tiến trình, không ghi file).
# Seed an toàn: chỉ thêm cái còn thiếu, KHÔNG dùng --force. Không DROP/TRUNCATE (xem AGENTS.md).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
W=/tmp/yenthoa; mkdir -p "$W"; export OUT="${OUT:-$W/shots}"; mkdir -p "$OUT"
SOCK=/tmp/yt-my8.sock; DB=xemay_hungphat_db; PORT=3000; ADMIN_PW='YenThoa2026demo'
# Cloud có thể đặt sẵn DB_* trỏ MySQL ngoài; DATABASE_URL=mysql:// được ưu tiên nên các biến đó không ảnh hưởng.
export DATABASE_URL="mysql://yenthoa:yenthoa123@127.0.0.1:3306/$DB"

up() {
  if ! mysqladmin --no-defaults -uroot -S $SOCK ping >/dev/null 2>&1; then
    [ -d /var/lib/yt-my8/mysql ] || mysqld --no-defaults --initialize-insecure --user=mysql --datadir=/var/lib/yt-my8
    (nohup mysqld --no-defaults --user=mysql --datadir=/var/lib/yt-my8 --socket=$SOCK --port=3306 --bind-address=127.0.0.1 --mysqlx=OFF > $W/mysql.log 2>&1 &)
    for i in $(seq 1 30); do mysqladmin --no-defaults -uroot -S $SOCK ping >/dev/null 2>&1 && break; sleep 2; done
  fi
  mysql --no-defaults -uroot -S $SOCK -e "CREATE DATABASE IF NOT EXISTS $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'yenthoa'@'%' IDENTIFIED BY 'yenthoa123'; GRANT ALL ON $DB.* TO 'yenthoa'@'%';" || { echo "Không bật được MySQL, xem $W/mysql.log"; return 1; }
  cd "$ROOT"
  [ -d node_modules ] || npm ci --no-audit --no-fund
  node scripts/db-seed.mjs 2>&1 | tail -1                 # chỉ thêm phần còn thiếu, an toàn chạy lại
  if ! curl -s -o /dev/null http://127.0.0.1:$PORT/; then
    eval "$(node scripts/hash-password.mjs "$ADMIN_PW" | sed 's/^/export /')"
    (nohup npm run dev -- -p $PORT -H 127.0.0.1 > $W/web.log 2>&1 &)
  fi
  for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/ | grep -q 200 && break; sleep 3; done
  echo "Sẵn sàng: http://127.0.0.1:$PORT  (admin: /admin/login, admin / $ADMIN_PW)  log trong $W"
}

shot() {
  shift; [ $# -gt 0 ] || set -- /
  NODE_PATH=$(npm root -g) ADMIN_PW="$ADMIN_PW" node "$ROOT/tools/dev/shot.mjs" "$@"
}

down() {
  fuser -k $PORT/tcp >/dev/null 2>&1
  mysqladmin --no-defaults -uroot -S $SOCK shutdown >/dev/null 2>&1
  echo "Đã tắt website và MySQL (dữ liệu giữ ở /var/lib/yt-my8)."
}

status() {
  mysqladmin --no-defaults -uroot -S $SOCK ping >/dev/null 2>&1 && echo "MySQL: chạy" || echo "MySQL: tắt"
  echo "Web: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/)"
}

case "${1:-}" in
  up) up ;; shot) shot "$@" ;; down) down ;; status) status ;;
  *) echo "Dùng: $0 up | shot <đường dẫn...> | status | down"; exit 1 ;;
esac
