#!/bin/bash
# Đầu mỗi phiên cloud: cài MySQL + thư viện (nếu thiếu), bật MySQL + dữ liệu mẫu + website cổng 3000.
# Chỉ chạy trên web (CLAUDE_CODE_REMOTE). Chụp ảnh: tools/dev/run.sh shot / /xe /admin
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# MySQL 8 (apt) — chỉ cài khi thiếu
if ! command -v mysqld >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq mysql-server-8.0
fi
mkdir -p /var/lib/mysql-files

# Thư viện npm — chỉ cài lại khi file khai báo đổi
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm install --no-audit --no-fund
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

# Bật MySQL + nạp dữ liệu mẫu (không ghi đè) + website. Không để lỗi bật site làm hỏng phiên.
tools/dev/run.sh up || echo "run.sh up thất bại — xem /tmp/yenthoa/*.log"
