#!/usr/bin/env python3
"""Assemble the wall and the poster pages from the components in src/.

Each poster is one self-contained file in src/posters/ carrying a header, its
own styles, markup and — where it renders live data — its own init script.
Every poster becomes a page of its own at /poster/<name>/, full screen, sized
to whatever viewport it is given. The wall at / is a grid of frames: one
<iframe> per poster, pinned to the size and proportion src/posters.json
assigns, stacked into the dependency tiers src/graph.json implies.

Type comes from the x-amz-dev bundle in the private x-amz/webfonts repo,
fetched into fonts/ (see fetch-fonts.sh and .github/workflows/deploy.yml):
its fonts.css and preload.html are inlined into both shells. Everything is
written to dist/, which the deploy workflow hands to GitHub Pages. Nothing
generated is committed. There is no dependency beyond the standard library.

Why not Jekyll, which Pages would run for free: the http-files.org poster
prints `{{host}}` as part of a real .http specimen, and Liquid would consume
it. `.nojekyll` stays, and the placeholders here are HTML comments for the
same reason.

    ./fetch-fonts.sh            # once, and after a FONTS_VERSION bump
    python3 build.py            # write dist/
"""

import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
FONTS = os.path.join(ROOT, 'fonts')
DIST = os.path.join(ROOT, 'dist')

# Served as they are, beside the generated pages.
STATIC = ('js', 'fonts', 'favicon.png', 'combined.png', 'blob', 'support', 'requiem', '.nojekyll', 'CNAME')

SHAPES = ('app', 'service', 'site', 'lib', 'shelf', 'sheet')



def read(*parts):
    with open(os.path.join(*parts), encoding='utf-8') as fh:
        return fh.read()


def fail(msg):
    raise SystemExit('build: ' + msg)


# ── Components ──────────────────────────────────────────────────────────────

def parse_component(name, text):
    """A component is a header comment holding JSON, then optional <style>,
    the poster's root element, and an optional <script>."""
    head = re.match(r'\s*<!--\s*(\{.*?\})\s*-->\n', text, re.S)
    if not head:
        fail(f'{name!r} has no JSON header comment')
    try:
        meta = json.loads(head.group(1))
    except ValueError as e:
        fail(f'{name!r} header is not valid JSON: {e}')
    for key in ('title', 'ideal', 'k', 'bleed'):
        if key not in meta:
            fail(f'{name!r} header lacks {key!r}')
    body = text[head.end():]

    style, script = [], []
    body = re.sub(r'<style>\n?(.*?)</style>\n?', lambda m: style.append(m.group(1)) or '', body, flags=re.S)
    body = re.sub(r'<script>\n?(.*?)</script>\n?', lambda m: script.append(m.group(1)) or '', body, flags=re.S)
    markup = body.strip('\n')

    root = re.match(r'\s*<(a|div)\b([^>]*)>', markup)
    if not root:
        fail(f'{name!r} has no recognisable poster root element')
    attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', root.group(2)))
    classes = attrs.get('class', '').split()
    if 'poster' not in classes or f'p-{name}' not in classes:
        fail(f'{name!r} root must carry classes "poster" and "p-{name}"')
    for c in classes:
        if c.startswith('poster--') and c != 'poster--unreleased':
            fail(f'{name!r} carries shape class {c!r}; shape belongs to posters.json')
    if root.group(1) == 'a' and 'href' not in attrs:
        fail(f'{name!r} is an <a> without href')
    if root.group(1) == 'div' and 'data-unreleased' not in attrs:
        fail(f'{name!r} is a <div> without a data-unreleased reason')

    acc = re.search(r'--acc:\s*([^;]+);', ''.join(style))
    if not acc:
        fail(f'{name!r} declares no --acc for its hover ring')

    return {
        'name': name,
        'meta': meta,
        'acc': acc.group(1).strip(),
        'style': ''.join(style).strip('\n'),
        'script': ''.join(script).strip('\n'),
        'markup': markup,
        'attrs': attrs,
    }


def esc(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def tiers(nodes, edges):
    """Tier = the longest dependency chain starting at a node, so every poster
    sits above everything it depends on. Raises on a cycle."""
    deps = {n: [] for n in nodes}
    for e in edges:
        for end in (e['from'], e['to']):
            if end not in deps:
                fail(f'graph edge names unknown poster {end!r}')
        deps[e['from']].append(e['to'])

    memo = {}

    def depth(n, seen=()):
        if n in memo:
            return memo[n]
        if n in seen:
            fail(f'dependency cycle through {n!r}')
        memo[n] = 0 if not deps[n] else 1 + max(depth(d, seen + (n,)) for d in deps[n])
        return memo[n]

    for n in nodes:
        depth(n)
    return memo


# ── Outputs ─────────────────────────────────────────────────────────────────

def poster_page(c, shell, fonts, kit, poster_css):
    meta = c['meta']
    w, h = meta['ideal']
    k = meta['k'] if isinstance(meta['k'], list) else [meta['k'], meta['k']]
    root = f"--ideal-w:{w}px;--ideal-h:{h}px;--kw:{k[0]};--kh:{k[1]};background:{meta['bleed']}"
    if 'production' in meta:
        root += f";--production:{meta['production'][0]};--production-hover:{meta['production'][1]}"
    description = meta.get('description', f"{meta['title']} — a poster from the X-AMZ wall.")
    page = shell
    page = page.replace('<!--{ root }-->', esc(root))
    page = page.replace('<!--{ name }-->', c['name'])
    page = page.replace('<!--{ title }-->', esc(meta['title']))
    page = page.replace('<!--{ description }-->', esc(description))
    page = page.replace('<!--{ font preloads }-->\n', fonts['preload'])
    page = page.replace('<!--{ fonts.css }-->', fonts['css'])
    page = page.replace('<!--{ kit.css }-->', kit)
    page = page.replace('<!--{ poster.css }-->', poster_css)
    page = page.replace('<!--{ poster style }-->', c['style'])
    page = page.replace('<!--{ poster }-->', c['markup'])
    page = page.replace('<!--{ poster script }-->', (c['script'] + '\n') if c['script'] else '')
    return page


def wall_slot(c, shape):
    """The frame the wall pins the poster page in. The frame carries the click —
    through to the poster's own page — and the hover ring; the page inside is
    display only."""
    label = esc(c['attrs'].get('aria-label') or c['meta']['title'])
    style = esc(f'--acc:{c["acc"]};background:{c["meta"]["bleed"]}')
    return (f'        <a class="poster poster--{shape}" data-node="{c["name"]}" style="{style}" '
            f'href="/poster/{c["name"]}/" aria-label="{label}">'
            f'<iframe src="/poster/{c["name"]}/#wall" title="{esc(c["meta"]["title"])}" '
            f'tabindex="-1" aria-hidden="true"></iframe></a>\n')


def build():
    spec = json.loads(read(SRC, 'posters.json'))
    inventory = spec['posters']
    for name, shape in inventory.items():
        if shape not in SHAPES:
            fail(f'{name!r} has unknown shape {shape!r}')
    # Every component gets a page; only the names in `wall` hang on the wall.
    hung = spec.get('wall', list(inventory))
    for name in hung:
        if name not in inventory:
            fail(f'wall names unknown poster {name!r}')
    graph = json.loads(read(SRC, 'graph.json'))
    tiers(list(inventory), graph['edges'])            # the whole graph must be sound
    edges = [e for e in graph['edges'] if e['from'] in hung and e['to'] in hung]
    depth = tiers(hung, edges)
    order = graph.get('order', [])

    def rank(n):
        return order.index(n) if n in order else len(order)

    components = {}
    for name in inventory:
        path = os.path.join(SRC, 'posters', name + '.html')
        if not os.path.exists(path):
            fail(f'posters.json names missing poster {name!r}')
        components[name] = parse_component(name, read(path))

    if not os.path.exists(os.path.join(FONTS, 'fonts.css')):
        fail('fonts/fonts.css is missing — run ./fetch-fonts.sh')
    fonts = {
        'css': indent(read(FONTS, 'fonts.css').rstrip(), 4),
        'preload': ''.join('  ' + ln + '\n' for ln in read(FONTS, 'preload.html').split('\n') if ln.strip()),
    }
    kit = read(SRC, 'kit.css').rstrip()
    outputs = {}

    shell = read(SRC, 'poster.html')
    poster_css = read(SRC, 'poster.css').rstrip()
    for name, c in components.items():
        outputs[os.path.join('poster', name, 'index.html')] = poster_page(c, shell, fonts, kit, poster_css)

    blocks = []
    for tier in sorted(set(depth.values()), reverse=True):
        blocks.append(f'      <div class="layer" data-tier="{tier}">\n')
        for name in sorted([n for n in hung if depth[n] == tier], key=rank):
            blocks.append(wall_slot(components[name], inventory[name]))
        blocks.append('      </div>\n\n')

    page = read(SRC, 'page.html')
    page = page.replace('<!--{ font preloads }-->\n', fonts['preload'])
    page = page.replace('<!--{ fonts.css }-->', fonts['css'])
    page = page.replace('<!--{ kit.css }-->', kit)
    page = page.replace('<!--{ base.css }-->', read(SRC, 'base.css').rstrip())
    page = page.replace('<!--{ sections }-->', ''.join(blocks))
    page = page.replace('<!--{ graph }-->', json.dumps({'edges': edges}, separators=(',', ':')))
    # <!--{ if wall }--> … <!--{ end }--> blocks only appear when something hangs.
    page = re.sub(r'<!--\{ if wall \}-->\n(.*?)<!--\{ end \}-->\n',
                  lambda m: m.group(1) if hung else '', page, flags=re.S)
    banner = (f'<!-- Generated by build.py from src/ — {len(hung)} of {len(inventory)} posters hung, '
              f'{len(set(depth.values()))} dependency tiers. Edit src/, not this file. -->\n')
    outputs['index.html'] = page.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n' + banner, 1)
    return outputs


def indent(text, spaces):
    pad = ' ' * spaces
    return '\n'.join(pad + ln if ln.strip() else ln for ln in text.split('\n'))


if __name__ == '__main__':
    outputs = build()
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST)
    for rel, html in outputs.items():
        path = os.path.join(DIST, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(html)
    for name in STATIC:
        src = os.path.join(ROOT, name)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DIST, name))
        else:
            shutil.copy2(src, os.path.join(DIST, name))
    n = len(outputs) - 1
    print(f'dist/ — index.html + {n} poster pages, {sum(len(h) for h in outputs.values()):,} bytes of HTML')
