#!/bin/sh
# Fetch the x-amz-dev font bundle from the private x-amz/webfonts release
# pinned in FONTS_VERSION into fonts/. CI does the same with an App token;
# locally this needs a `gh` login that can read x-amz/webfonts.
set -eu
cd "$(dirname "$0")"
version=$(cat FONTS_VERSION)
tmp=$(mktemp -d)
gh release download "$version" --repo x-amz/webfonts --pattern x-amz-dev.tar.gz --dir "$tmp"
rm -rf fonts && mkdir fonts
tar xzf "$tmp/x-amz-dev.tar.gz" -C fonts
rm -rf "$tmp"
test -f fonts/fonts.css
echo "fonts/ ← $version ($(find fonts -name '*.woff2' | wc -l | tr -d ' ') faces)"
