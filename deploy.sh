#!/usr/bin/env bash
# deploy.sh — push Ladle & Spoon frontend files to GitHub Pages in one command.
#
# Run it after downloading index.html (and any other changed files) from Claude.
# GitHub Pages serves straight from main, so the push IS the deploy for the frontend.
# Code.gs still needs a manual Apps Script redeploy — this cannot do that part.
#
#   chmod +x deploy.sh        (once)
#   ./deploy.sh               push whatever changed
#   ./deploy.sh "message"     push with your own commit message
#
set -euo pipefail

# ─── set these two once ────────────────────────────────────────────────────────
REPO="/c/Users/tonye/OneDrive/Documents/GitHub/ladle_and_spoon"        # your local clone
DOWNLOADS="$HOME/Downloads"              # where the files land from Claude
# ───────────────────────────────────────────────────────────────────────────────

# Files worth copying if a newer copy is sitting in Downloads.
FILES=(index.html share.html og-image.jpg)

MSG="${1:-}"

[ -d "$REPO/.git" ] || { echo "✗ $REPO is not a git clone — fix REPO at the top of this script."; exit 1; }
cd "$REPO"

copied=()
for f in "${FILES[@]}"; do
  src="$DOWNLOADS/$f"
  [ -f "$src" ] || continue
  # Only copy when the download is genuinely newer, so an old file sitting in
  # Downloads from three weeks ago cannot quietly overwrite current work.
  if [ ! -f "$f" ] || [ "$src" -nt "$f" ]; then
    cp "$src" "$f"
    copied+=("$f")
  fi
done

if [ ${#copied[@]} -gt 0 ]; then
  echo "→ copied from Downloads: ${copied[*]}"
else
  echo "→ nothing newer in Downloads; using the repo as it stands"
fi

if git diff --quiet && git diff --cached --quiet; then
  echo "✓ nothing to push — repo already matches"
  exit 0
fi

# Pull the app version out of index.html so the commit message says something useful
# instead of "update" forty times in a row.
VER="$(grep -o 'APP VERSION: [^"]*' index.html 2>/dev/null | head -1 | sed 's/APP VERSION: //')"
[ -n "$MSG" ] || MSG="${VER:-frontend update}"

echo "→ changes:"
git --no-pager diff --stat

git add -A
git commit -m "$MSG"
git push origin main

echo
echo "✓ pushed: $MSG"
echo "  GitHub Pages usually reflects it within a minute."
echo "  https://acebuilds51.github.io/ladle_and_spoon/"
echo
echo "  Reminder: if Code.gs changed, redeploy the Apps Script web app separately —"
echo "  pencil on the live deployment → Version: New version → Deploy."
