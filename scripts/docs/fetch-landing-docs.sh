#!/usr/bin/env bash
# Quarto pre-render hook: brings the landing docs into landing/ so the portal
# documents both repositories without copying their files into this one.
#
# By default it shallow-clones the public landing repository at LANDING_REF
# (main). Set LANDING_DOCS_DIR to a local landing checkout to render from it
# instead, e.g. while editing the landing docs; that copy is refreshed on every
# run, so local edits always show up. Only the clone is cached between runs.
#
# Besides the Markdown pages it brings what the landing README links to with
# relative paths (src/assets/brand/ images and LICENSE), so they resolve in the
# published site.
set -euo pipefail

repo_url="${LANDING_REPO_URL:-https://github.com/aso-computacion-unl/aso-computacion-landing.git}"
ref="${LANDING_REF:-main}"
target="landing"

# Copies the published landing files from the checkout at $1 into $target.
copy_landing() {
  local src="$1"

  mkdir -p "$target/docs" "$target/src/assets"
  cp "$src"/{README,PRODUCT,CONTRIBUTING,SECURITY}.md "$src/LICENSE" "$target/"
  cp "$src"/docs/*.md "$target/docs/"
  [[ ! -d "$src/docs/assets" ]] || cp -r "$src/docs/assets" "$target/docs/"
  cp -r "$src/src/assets/brand" "$target/src/assets/"
}

if [[ -n "${LANDING_DOCS_DIR:-}" ]]; then
  # A local checkout is cheap to copy and may have changed since the last run.
  rm -rf "$target"
  copy_landing "$LANDING_DOCS_DIR"
# Quarto runs the hook once per render; a preview re-render must not re-clone.
elif [[ -n "${QUARTO_PROJECT_RENDER_ALL:-}" || ! -f "$target/docs/REFERENCIA.md" || ! -f "$target/LICENSE" ]]; then
  rm -rf "$target"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  git clone --quiet --depth 1 --branch "$ref" --filter=blob:none --sparse "$repo_url" "$tmp/repo"
  git -C "$tmp/repo" sparse-checkout set --no-cone /README.md /PRODUCT.md /CONTRIBUTING.md /SECURITY.md /LICENSE '/docs/*.md' /docs/assets/ /src/assets/brand/
  copy_landing "$tmp/repo"
fi

for page in README.md PRODUCT.md CONTRIBUTING.md SECURITY.md docs/REFERENCIA.md docs/DEPLOY.md; do
  [[ -f "$target/$page" ]] || { echo "fetch-landing-docs: missing $target/$page" >&2; exit 1; }
done
