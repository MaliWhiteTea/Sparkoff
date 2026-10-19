#!/usr/bin/env bash

set -u

PROJECT_DIR="/home/mert/Documents/Proje/Sparkoff"
RUNTIME_DIR="$PROJECT_DIR/storage/framework/local-test"
SERVER_PID_FILE="$RUNTIME_DIR/server.pid"
VITE_PID_FILE="$RUNTIME_DIR/vite.pid"
LOG_FILE="$PROJECT_DIR/storage/logs/local-test.log"
TEST_URL="http://127.0.0.1:8000/randevu?test=$(date +%s)"

mkdir -p "$RUNTIME_DIR" "$PROJECT_DIR/storage/logs"
cd "$PROJECT_DIR" || exit 1

php artisan config:clear >>"$LOG_FILE" 2>&1
php artisan migrate --force >>"$LOG_FILE" 2>&1
php artisan db:seed --class=RolePermissionSeeder --force >>"$LOG_FILE" 2>&1

if ! php artisan admin:check >>"$LOG_FILE" 2>&1; then
    command -v notify-send >/dev/null 2>&1 && notify-send --urgency=critical "Sparkoff" "Aktif yönetici hesabı bulunamadı. Terminalde admin:create komutuyla bir hesap oluşturun."
fi

if ! curl --silent --fail --max-time 1 http://127.0.0.1:8000/up >/dev/null 2>&1; then
    setsid env ONLINE_BOOKING_ENABLED=true php artisan serve --host=127.0.0.1 --port=8000 >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$SERVER_PID_FILE"
fi

if ! curl --silent --fail --max-time 1 http://127.0.0.1:5173/@vite/client >/dev/null 2>&1; then
    setsid npm run dev -- --host=127.0.0.1 >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$VITE_PID_FILE"
fi

for _attempt in {1..30}; do
    if curl --silent --fail --max-time 1 http://127.0.0.1:8000/randevu >/dev/null 2>&1; then
        xdg-open "$TEST_URL" >/dev/null 2>&1 &
        command -v notify-send >/dev/null 2>&1 && notify-send "Sparkoff" "Test ortamı hazır; randevu sayfası açıldı."
        exit 0
    fi
    sleep 0.5
done

command -v notify-send >/dev/null 2>&1 && notify-send --urgency=critical "Sparkoff" "Test ortamı başlatılamadı. local-test.log dosyasını kontrol edin."
exit 1
