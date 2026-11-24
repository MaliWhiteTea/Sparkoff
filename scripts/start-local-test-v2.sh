#!/usr/bin/env bash

set -u

PROJECT_DIR="/home/mert/Documents/Proje/Sparkoff/v2"
RUNTIME_DIR="/home/mert/Documents/Proje/Sparkoff/storage/framework/local-test-v2"
LOG_FILE="/home/mert/Documents/Proje/Sparkoff/storage/logs/local-test-v2.log"
PID_FILE="$RUNTIME_DIR/vite.pid"
TEST_URL="http://127.0.0.1:5174/"

notify() {
    command -v notify-send >/dev/null 2>&1 && notify-send "Sparkoff V2" "$1" || true
}

is_sparkoff_v2() {
    curl --silent --fail --max-time 2 "$TEST_URL" | grep -q '<title>Sparkoff</title>'
}

mkdir -p "$RUNTIME_DIR" "$(dirname "$LOG_FILE")"
cd "$PROJECT_DIR" || exit 1

if [[ ! -x node_modules/.bin/vite ]]; then
    notify "V2 bağımlılıkları eksik. v2 klasöründe npm ci çalıştırın."
    exit 1
fi

if ! is_sparkoff_v2; then
    if curl --silent --max-time 2 "$TEST_URL" >/dev/null 2>&1; then
        notify "5174 portu başka bir uygulama tarafından kullanılıyor."
        exit 1
    fi
    setsid npm run demo >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$PID_FILE"
fi

for _attempt in {1..40}; do
    if is_sparkoff_v2; then
        if [[ "${SPARKOFF_V2_NO_BROWSER:-}" != 1 ]]; then
            xdg-open "$TEST_URL" >/dev/null 2>&1 &
        fi
        notify "Yeni sistemin örnek modu açıldı: $TEST_URL"
        exit 0
    fi
    sleep 0.5
done

notify "V2 başlatılamadı. local-test-v2.log dosyasını kontrol edin."
exit 1
