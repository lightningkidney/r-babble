#!/usr/bin/env bash
# Writes R-Babble.desktop pointing at this checkout (the file is git-ignored: it contains your local path).
d="$(cd "$(dirname "$0")/.." && pwd)"
cat > "$d/R-Babble.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=R-Babble
Exec=$d/run.sh
Path=$d
Terminal=true
Icon=audio-x-generic
EOF
chmod +x "$d/R-Babble.desktop"; echo "wrote $d/R-Babble.desktop (right-click > Allow Launching if needed)"
