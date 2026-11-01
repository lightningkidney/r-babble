#!/usr/bin/env bash
# Start the local R-Babble app and open it in the browser. Needs Node 18+.
cd "$(dirname "$(readlink -f "$0")")" || exit 1
PORT="${PORT:-8765}"; URL="http://127.0.0.1:$PORT/"

# Find node even when launched from a file manager (nvm is only on PATH in a login shell).
if ! command -v node >/dev/null 2>&1; then
  for n in "$HOME"/.nvm/versions/node/*/bin/node /usr/local/bin/node /usr/bin/node; do
    [ -x "$n" ] && PATH="$(dirname "$n"):$PATH" && break
  done
fi
if ! command -v node >/dev/null 2>&1; then
  msg="Node.js 18+ not found. Install it with: sudo dnf install nodejs"
  echo "$msg" >&2; command -v notify-send >/dev/null && notify-send "Animalese Synth" "$msg"; read -r -p "Press Enter…" _; exit 1
fi

open_browser() { command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 & }

# Already running? Just open it.
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then echo "Already running at $URL"; open_browser; exit 0; fi

(sleep 0.8; open_browser) &
PORT="$PORT" node server.mjs || { echo "Server failed to start (see error above)." >&2; read -r -p "Press Enter…" _; exit 1; }
