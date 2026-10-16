#!/usr/bin/env bash

set -u

PROJECT_DIR="/home/mert/Documents/Proje/Sparkoff"
RUNTIME_DIR="$PROJECT_DIR/storage/framework/local-test"

stop_group() {
    local pid_file="$1"
    local pid

    [[ -f "$pid_file" ]] || return 0
    pid="$(<"$pid_file")"

    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
        kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi

    rm -f "$pid_file"
}

stop_group "$RUNTIME_DIR/server.pid"
stop_group "$RUNTIME_DIR/vite.pid"

command -v notify-send >/dev/null 2>&1 && notify-send "Sparkoff" "Test ortamı kapatıldı."
