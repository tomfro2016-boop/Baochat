#!/usr/bin/env bash
# Sao lưu database Baochat bằng pg_dump (nén gzip) và giữ lại 14 bản gần nhất.
# Dùng:  DATABASE_URL=postgres://... bash scripts/backup.sh
# Gợi ý chạy tự động mỗi ngày bằng cron:  0 3 * * * cd /path/to/baochat && bash scripts/backup.sh
set -euo pipefail

: "${DATABASE_URL:?Thiếu DATABASE_URL}"
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/baochat-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$FILE"
echo "Đã sao lưu: $FILE"

# Xoá bản cũ, giữ 14 bản mới nhất
ls -1t "$DIR"/baochat-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
