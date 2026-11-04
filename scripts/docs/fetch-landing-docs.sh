#!/usr/bin/env bash
# Quarto pre-render hook: brings the landing docs into landing/ so the portal
# documents both repositories without copying their files into this one.
#
# By default it shallow-clones the public landing repository at LANDING_REF
# (main). Set LANDING_DOCS_DIR to a local landing checkout to render from it
# instead, e.g. while editing the landing docs.
set -euo pipefail

repo_url="${LANDING_REPO_URL:-https://github.com/aso-computacion-unl/aso-computacion-landing.git}"
ref="${LANDING_REF:-main}"
target="landing"

# Quarto runs the hook once per render; a preview re-render must not re-clone.
if [[ -n "${QUARTO_PROJECT_RENDER_ALL:-}" || ! -f "$target/docs/REFERENCIA.md" ]]; then
  rm -rf "$target"
  if [[ -n "${LANDING_DOCS_DIR:-}" ]]; then
    mkdir -p "$target/docs"
    for f in README.md PRODUCT.md CONTRIBUTING.md SECURITY.md; do cp "$LANDING_DOCS_DIR/$f" "$target/"; done
    cp "$LANDING_DOCS_DIR"/docs/*.md "$target/docs/"
    [[ -d "$LANDING_DOCS_DIR/docs/assets" ]] && cp -r "$LANDING_DOCS_DIR/docs/assets" "$target/docs/"
  else
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    git clone --quiet --depth 1 --branch "$ref" --filter=blob:none --sparse "$repo_url" "$tmp/repo"
    git -C "$tmp/repo" sparse-checkout set --no-cone /README.md /PRODUCT.md /CONTRIBUTING.md /SECURITY.md '/docs/*.md' /docs/assets/
    mkdir -p "$target"
    cp "$tmp/repo"/{README,PRODUCT,CONTRIBUTING,SECURITY}.md "$target/"
    cp -r "$tmp/repo/docs" "$target/"
  fi
fi

for page in README.md PRODUCT.md CONTRIBUTING.md SECURITY.md docs/REFERENCIA.md docs/DEPLOY.md; do
  [[ -f "$target/$page" ]] || { echo "fetch-landing-docs: missing $target/$page" >&2; exit 1; }
done
