#!/usr/bin/env bash
# Downloads raw source assets into assets-source/. Idempotent: skips anything already present.
# Usage: tools/fetch-assets.sh [kenney|polyhaven|ambientcg|quaternius|all]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets-source"
VENV="${RIFTFALL_VENV:-/tmp/riftfall-venv}"
WHAT="${1:-all}"

mkdir -p "$SRC"/{kenney,quaternius,polyhaven,ambientcg,mixamo}

log()  { printf '%-6s %s\n' "$1" "$2"; }
warn() { printf 'WARN   %s\n' "$*" >&2; }

# dl <url> <dest-file>
dl() {
  local url="$1" dest="$2"
  [[ -s "$dest" ]] && { log skip "$(basename "$dest")"; return 0; }
  log fetch "$(basename "$dest")"
  curl -fsSL --retry 3 --retry-delay 2 -A "riftfall-asset-fetch" -o "$dest.part" "$url" && mv "$dest.part" "$dest"
}

# dl_unzip <url> <dest-dir>   (zip is removed after extraction; dest-dir is the skip marker)
dl_unzip() {
  local url="$1" dir="$2" zip="$2.zip"
  [[ -d "$dir" ]] && { log skip "$(basename "$dir")/"; return 0; }
  dl "$url" "$zip"
  mkdir -p "$dir"
  unzip -qo "$zip" -d "$dir" && rm -f "$zip"
}

# ---------------------------------------------------------------- Kenney (CC0)
kenney() {
  local slug url
  for slug in "$@"; do
    url=$(curl -fsL "https://kenney.nl/assets/$slug" \
          | grep -oE 'https://kenney\.nl/media/pages/assets/[^"]+\.zip' | head -1 || true)
    [[ -n "$url" ]] || { warn "kenney: no zip link on /assets/$slug"; continue; }
    dl_unzip "$url" "$SRC/kenney/$slug"
  done
}

# ------------------------------------------------------------ Poly Haven (CC0)
# polyhaven <id> [res]   -> assets-source/polyhaven/<id>_<res>.hdr
polyhaven() {
  local id="$1" res="${2:-2k}" url
  url=$(curl -fs "https://api.polyhaven.com/files/$id" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['hdri']['$res']['hdr']['url'])" 2>/dev/null || true)
  [[ -n "$url" ]] || { warn "polyhaven: $id@$res not found"; return 0; }
  dl "$url" "$SRC/polyhaven/${id}_${res}.hdr"
}

# ------------------------------------------------------------- ambientCG (CC0)
# ambientcg <MaterialId> [variant]   default variant 1K-JPG
ambientcg() {
  local id="$1" variant="${2:-1K-JPG}"
  dl_unzip "https://ambientcg.com/get?file=${id}_${variant}.zip" "$SRC/ambientcg/${id}_${variant}"
}

# ---------------------------------------------------------- itch.io (free packs)
# Free itch.io uploads: GET page (csrf cookie+token) -> POST /file/<upload_id>?source=game_download -> signed URL.
# itch <dest-folder> <game-url> [upload-name-filter]
itch() {
  local name="$1" game="$2" filter="${3:-}" dir="$SRC/quaternius/$1"
  [[ -d "$dir" && -n "$(ls -A "$dir" 2>/dev/null)" ]] && { log skip "quaternius/$name/"; return 0; }
  local jar csrf page dlpage
  jar=$(mktemp); page=$(mktemp)
  curl -fsSL -c "$jar" -b "$jar" -A "Mozilla/5.0" "$game" -o "$page"
  csrf=$(grep -oE 'csrf_token" value="[^"]+"' "$page" | head -1 | sed 's/.*value="//;s/"$//')
  [[ -n "$csrf" ]] || { warn "itch: no csrf token on $game"; rm -f "$jar" "$page"; return 0; }
  # "No thanks, just take me to the downloads" -> temporary download page that lists the uploads
  dlpage=$(curl -fsSL -c "$jar" -b "$jar" -A "Mozilla/5.0" -X POST --data-urlencode "csrf_token=$csrf" "$game/download_url" \
           | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")
  [[ -n "$dlpage" ]] || { warn "itch: download_url failed for $game"; rm -f "$jar" "$page"; return 0; }
  curl -fsSL -c "$jar" -b "$jar" -A "Mozilla/5.0" "$dlpage" -o "$page"
  # upload ids + file names
  local uploads
  uploads=$(python3 - "$page" "$filter" <<'PY'
import re, sys, html
h = open(sys.argv[1], encoding="utf-8", errors="ignore").read(); flt = sys.argv[2].lower()
for m in re.finditer(r'data-upload_id="(\d+)".{0,400}?<strong[^>]*class="name"[^>]*>([^<]+)</strong>', h, re.S):
    uid, name = m.group(1), html.unescape(m.group(2)).strip()
    if flt and flt not in name.lower(): continue
    print(f"{uid}\t{name}")
PY
)
  [[ -n "$uploads" ]] || { warn "itch: no uploads found on $game (download manually)"; rm -f "$jar" "$page"; return 0; }
  local uid fname url
  while IFS=$'\t' read -r uid fname; do
    url=$(curl -fsSL -c "$jar" -b "$jar" -A "Mozilla/5.0" -X POST --data-urlencode "csrf_token=$csrf" \
          "$game/file/$uid?source=game_download" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")
    [[ -n "$url" ]] || { warn "itch: no url for upload $uid ($fname)"; continue; }
    mkdir -p "$dir"
    if [[ "$fname" == *.zip ]]; then
      dl "$url" "$dir/$fname" && { unzip -qo "$dir/$fname" -d "$dir/${fname%.zip}" && rm -f "$dir/$fname"; }
    else
      dl "$url" "$dir/$fname"
    fi
  done <<< "$uploads"
  rm -f "$jar" "$page"
}

# ------------------------------------------------------------ Quaternius (CC0)
# Older "Ultimate" packs are hosted on Google Drive folders -> gdown.
# Newer packs are on itch.io -> itch() above.
ensure_gdown() {
  if [[ ! -x "$VENV/bin/gdown" ]]; then
    log setup "python venv + gdown -> $VENV"
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -q --upgrade pip gdown truststore
  fi
}
# gdown via truststore so Python trusts the same CA chain as the OS (needed behind corporate TLS proxies)
gdown_cli() {
  "$VENV/bin/python" - "$@" <<'PY'
import sys, truststore
truststore.inject_into_ssl()
from gdown.__main__ import main
sys.argv = ["gdown", *sys.argv[1:]]
main()
PY
}
# quaternius <folder-name> <drive-folder-url>
quaternius() {
  local name="$1" url="$2" dir="$SRC/quaternius/$1"
  [[ -d "$dir" && -n "$(ls -A "$dir" 2>/dev/null)" ]] && { log skip "quaternius/$name/"; return 0; }
  ensure_gdown
  log fetch "quaternius/$name/"
  gdown_cli --folder -q -O "$dir" "$url" || warn "quaternius: gdown failed for $name (download manually: $url)"
}

# ============================================================================ #
run_kenney() {
  kenney \
    prototype-kit prototype-textures \
    input-prompts ui-pack ui-pack-sci-fi game-icons kenney-fonts \
    particle-pack smoke-particles \
    nature-kit platformer-kit castle-kit graveyard-kit space-kit \
    interface-sounds impact-sounds sci-fi-sounds digital-audio
}

run_polyhaven() {
  # Sky Ruins
  polyhaven kloofendal_48d_partly_cloudy_puresky 2k
  polyhaven qwantani_puresky 2k
  polyhaven kloppenheim_06_puresky 2k
  # Fire Rift
  polyhaven the_sky_is_on_fire 2k
  polyhaven kiara_1_dawn 2k
  polyhaven belfast_sunset_puresky 2k
  # Void
  polyhaven satara_night 2k
  polyhaven moonless_golf 2k
  polyhaven rogland_moonlit_night 2k
  # 1k mobile fallbacks for the primary sky of each biome
  polyhaven kloofendal_48d_partly_cloudy_puresky 1k
  polyhaven the_sky_is_on_fire 1k
  polyhaven satara_night 1k
}

run_ambientcg() {
  # rock / cliff
  ambientcg Rock030; ambientcg Rock035; ambientcg Rock051; ambientcg Rock058; ambientcg Rock063; ambientcg Rock064
  # ground / grass / moss  (Sky Ruins)
  ambientcg Ground037; ambientcg Ground068; ambientcg Grass004; ambientcg Grass005; ambientcg Moss002
  # ruins / stone wall / paving
  ambientcg Bricks085; ambientcg Bricks097; ambientcg PavingStones138; ambientcg Tiles143
  # sand
  ambientcg Ground054; ambientcg Ground080
  # lava / volcanic  (Fire Rift)
  ambientcg Lava001; ambientcg Lava002; ambientcg Lava004; ambientcg Lava005
  # ice / crystal-ish  (Void / future Frozen)
  ambientcg Ice002; ambientcg Ice003; ambientcg Onyx006
  # metal
  ambientcg Metal032; ambientcg Metal049A
}

run_quaternius() {
  # itch.io-hosted (scriptable). Filter picks the GLB/Standard upload where a pack offers several.
  itch universal-animation-library   "https://quaternius.itch.io/universal-animation-library"
  itch universal-animation-library-2 "https://quaternius.itch.io/universal-animation-library-2"
  itch universal-base-characters     "https://quaternius.itch.io/universal-base-characters"
  itch sci-fi-essentials-kit         "https://quaternius.itch.io/sci-fi-essentials-kit"
  itch fantasy-props-megakit         "https://quaternius.itch.io/fantasy-props-megakit"
  itch stylized-nature-megakit       "https://quaternius.itch.io/stylized-nature-megakit"

  # Google-Drive-hosted (older "Ultimate" packs). Blocked on some corporate networks -> manual fallback.
  quaternius ultimate-animated-character  "https://drive.google.com/drive/folders/1sNi1AfenfPRrvRt5yfaj5QMMd6KKcUJ5"
  quaternius ultimate-modular-characters  "https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX"
  quaternius ultimate-modular-ruins       "https://drive.google.com/drive/folders/1ETp2ldaHaP0BkS4FBmkT-g9Yf88T_cIX"
  quaternius ultimate-stylized-nature     "https://drive.google.com/drive/folders/1IV3bXHzkNvuNWFHPi4KPx-G4ghuxIuT-"
  quaternius ultimate-nature              "https://drive.google.com/drive/folders/1-Kl0L_Jg8awbh0S5T-z3zxh4mVlnxTpa"
  quaternius ultimate-modular-scifi       "https://drive.google.com/drive/folders/1zpr6HxVa-sCV93IHubN3A1d8HhF2wGbM"
  quaternius ultimate-monsters            "https://drive.google.com/drive/folders/18m4KpzpEzhC9wl7jzr6dUc0N8Jozr79C"
  quaternius ultimate-platformer          "https://drive.google.com/drive/folders/1NDZn_aGnn0vfFV3M22Y8GPcDjO8BVcLs"
  quaternius modular-platformer           "https://drive.google.com/drive/folders/1ku_XmbHOZ5ypgKCAjpzX6hlXaOJT7Uoq"
  quaternius animated-monster             "https://drive.google.com/drive/folders/102H-oyUM8SGYi1mW0GOgkjEu7xSdaORA"
  quaternius medieval-dungeon             "https://drive.google.com/drive/folders/13MoeF0Uy9PHqXXi6gh63tV2PLRD6YXJv"
}

case "$WHAT" in
  kenney)     run_kenney ;;
  polyhaven)  run_polyhaven ;;
  ambientcg)  run_ambientcg ;;
  quaternius) run_quaternius ;;
  all)        run_kenney; run_polyhaven; run_ambientcg; run_quaternius ;;
  *) echo "usage: $0 [kenney|polyhaven|ambientcg|quaternius|all]" >&2; exit 2 ;;
esac

echo
echo "Done. Raw assets in: $SRC"
echo "Google-Drive-hosted Quaternius packs + Mixamo need a browser -> see assets-source/MANUAL-DOWNLOADS.md"
