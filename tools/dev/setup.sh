#!/usr/bin/env bash
# Cài môi trường chạy thử Yên Thoa trên máy cloud mới (chạy một lần; dán vào "Setup script" của môi trường để khỏi cài lại).
# Cần: MySQL 8 (apt), node_modules (npm ci), Chromium + Playwright (đã có sẵn ở /opt/pw-browsers).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 1) MySQL 8 — datadir riêng (run.sh tự khởi tạo), không dùng bản mặc định
if ! command -v mysqld >/dev/null; then
  apt-get update -qq && apt-get install -y -qq mysql-server-8.0
fi
mkdir -p /var/lib/mysql-files

# 2) Thư viện của dự án
cd "$ROOT" && npm ci --no-audit --no-fund

echo "Xong. Tiếp theo: tools/dev/run.sh up"
