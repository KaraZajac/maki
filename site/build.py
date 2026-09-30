#!/usr/bin/env python3
"""Build maki.netslum.io from maki's repositories.

The site describes maki as its repositories do, so it's made from them rather than written
beside them: the home, download and developer pages from site/pages; the docs from the user guide
(docs/*.md here), the SDK's README and PROTOCOL.md (the firmware repository) and CHANGELOG.md;
the app catalogue from the store as it's published (maki-apps' store/index.json, what maki
desktop reads), an icon and a page for each app. To change the site, change a repository, then
run this again. Nothing here is edited by hand in the output.

    site/build.py --out DIR [--firmware REPO] [--store REPO] [--netslum-lib DIR]

--firmware is a checkout of maki-firmware (default xous-core, inside this repository, as
DEVELOPMENT.md lays them out), --store one of maki-apps (default apps), --netslum-lib the
directory holding netslum_md.py, the household's markdown converter (default /usr/local/lib,
where the other docs builders find it). The home, download and developer pages are site/pages;
site/releases.json says what the download page offers. On the server, /usr/local/bin/maki-site
pulls the three repositories and runs this.
"""

import argparse
import base64
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE = "https://maki.netslum.io"
GH = "https://github.com/KaraZajac"
REPOS = {
    "maki": (f"{GH}/maki", "main"),
    "firmware": (f"{GH}/maki-firmware", "maki"),
    "desktop": (f"{GH}/maki-desktop", "main"),
    "store": (f"{GH}/maki-apps", "main"),
}

# ── the docs: (id, title, blurb, source) in sidebar groups ─────────────────────────────────────
# a source is ("maki", path) or ("firmware", path): a whole markdown file from that repository
DOCS = [
    ("Start here", [
        ("getting-started", "Getting started", "What maki is, what you need, and the order of things.", ("maki", "docs/getting-started.md")),
        ("flashing", "Flashing maki", "Developer mode, update mode, and the three files that make a badge a maki.", ("maki", "docs/flashing.md")),
        ("first-boot", "First boot", "The PIN, the recovery phrase and a name, then the home screen.", ("maki", "docs/first-boot.md")),
        ("updates", "Updating maki", "What an update keeps: firmware, storage, apps and backups, and how they stay separate.", ("maki", "docs/updates.md")),
    ]),
    ("Using maki", [
        ("desktop", "maki desktop", "The tray app that links maki to your computer: the link, the time, backups and apps.", ("maki", "docs/desktop.md")),
        ("extension", "The browser extension", "Logins, codes and passkeys, and maki's accounts for sites, asked on maki's screen.", ("maki", "docs/extension.md")),
        ("apps", "Apps and the store", "Installing apps, what their permissions mean, and taking them away again.", ("maki", "docs/apps.md")),
        ("wallets", "Wallets", "Bitcoin (multisig too), Ethereum, Monero and Solana: every payment shown on maki first.", ("maki", "docs/wallets.md")),
        ("signing", "SSH, git and files", "SSH sign-ins and git signatures, gpg, minisign and age, each waiting for your yes.", ("maki", "docs/signing.md")),
        ("sudo", "sudo, with a yes on maki", "Every command sudo runs, shown whole on maki and signed before it runs.", ("maki", "docs/sudo.md")),
        ("nostr", "Nostr", "Your Nostr key for sites and for Nostr apps, every event shown before it's signed.", ("maki", "docs/nostr.md")),
    ]),
    ("Reference", [
        ("security", "Security model", "What maki protects you from, and what it doesn't.", ("maki", "docs/security.md")),
        ("faq", "Questions", "Short answers, and what to do when something's wrong.", ("maki", "docs/faq.md")),
        ("sdk", "Writing apps", "The SDK: the maki-app crate, the maki tool, the permissions and the example apps.", ("firmware", "sdk/README.md")),
        ("protocol", "The link protocol", "What maki desktop and maki say to each other over USB, message by message.", ("firmware", "libs/maki-proto/PROTOCOL.md")),
        ("changelog", "What's new", "What each preview brought, newest first.", ("maki", "CHANGELOG.md")),
    ]),
]

# what each permission lets an app do, as the docs say it
PERMISSIONS = {
    "ask": "Put questions on maki's own screen, naming the app, even while it isn't open; and pages before one, on maki's review screen.",
    "keys": "Keys of its own from your recovery phrase: the same on a restored maki, different for every app. maki holds them and signs for it.",
    "link": "Messages with software on your computer, through maki desktop, which can wake the app to answer.",
    "keyboard": "Typing into your computer as a USB keyboard, while it's in front, with “typing” in maki's bar.",
    "camera": "Reading QR codes, through maki's own scanner.",
    "motion": "The accelerometer.",
    "wallet": "Keys from your recovery phrase for the accounts its manifest names, and no others; it signs only what you've gone through on maki's screen.",
}

MARK = ('<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1d3a2a" stroke="#4d8a66" '
        'stroke-width="1.2"/><circle cx="32" cy="32" r="25" fill="#f3efe6"/><circle cx="32" cy="32" r="11" fill="#ff7a59"/></svg>')

ONION = "af66yyiibhovxq7tkvejh2lrnxynr4ub52bosvkblg6aabv3guk3yhqd.onion"


def esc(t):
    return html.escape(t, quote=True)


def git(repo: Path, *a):
    try:
        return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return "unknown"


# ── the frame every page shares ────────────────────────────────────────────────────────────────

def page(*, path, title, description, body, nav, css_version, wide=False, extra_head=""):
    """A whole page. `path` is where it's served (/docs/wallets.html), `nav` which tab is lit."""
    def tab(key, href, label, cls=""):
        here = ' class="here" aria-current="page"' if key == nav else (f' class="{cls}"' if cls else "")
        return f'<a href="{href}"{here}>{label}</a>'
    full_title = "maki" if path == "/" else f"{title} — maki"
    canonical = BASE + path
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css?v={css_version}">
<meta name="theme-color" content="#1e1e2e">
<meta property="og:title" content="{esc(full_title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="website">
<meta property="og:image" content="{BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
{extra_head}</head>
<body{' class="wide"' if wide else ''}>
<a class="skip" href="#main">Skip to the page</a>
<div class="glow"></div>
<div class="wrap">
<div class="top">
  <div class="house">
    <a href="https://netslum.io/">netslum.io</a><span class="sep">/</span>
    <a class="me" href="/">{MARK}maki</a>
  </div>
  <nav class="main" aria-label="maki">
    {tab("apps", "/apps/", "Apps")}
    {tab("docs", "/docs/", "Docs")}
    {tab("developers", "/developers/", "Developers")}
    {tab("security", "/docs/security.html", "Security")}
    {tab("download", "/download/", "Download")}
    <a class="gh" href="{GH}/maki">GitHub</a>
  </nav>
</div>
<div id="main">
{body}
</div>
<footer class="site">
  <div class="cols">
    <div>
      <div style="display:flex;align-items:center;gap:.6rem;color:var(--text);font-family:var(--mono);font-weight:700"><span style="width:1.6rem;height:1.6rem;display:inline-block">{MARK}</span>maki</div>
      <p style="margin:.7rem 0 0;max-width:22rem">A security key that shows you what you&rsquo;re signing, for the DEF CON 34 badge. By <a href="https://netslum.io">.leviathan</a>, part of <a href="https://netslum.io">netslum.io</a>. MIT License; the firmware builds on Xous (Apache 2.0): <a href="/download/#licenses">licenses</a>.</p>
    </div>
    <div><h4>maki</h4><ul>
      <li><a href="/apps/">Apps</a></li><li><a href="/docs/">Docs</a></li><li><a href="/download/">Download</a></li><li><a href="/docs/changelog.html">What&rsquo;s new</a></li>
    </ul></div>
    <div><h4>Start</h4><ul>
      <li><a href="/docs/getting-started.html">Getting started</a></li><li><a href="/docs/flashing.html">Flashing</a></li><li><a href="/docs/security.html">Security model</a></li><li><a href="/developers/">Developers</a></li>
    </ul></div>
    <div><h4>Source</h4><ul>
      <li><a href="{GH}/maki">maki</a></li><li><a href="{GH}/maki-firmware">maki-firmware</a></li><li><a href="{GH}/maki-desktop">maki-desktop</a></li><li><a href="{GH}/maki-apps">maki-apps</a></li>
    </ul></div>
  </div>
  <div class="onion-line"><span class="lab">Also on Tor:</span> <span class="onion">{ONION}</span></div>
</footer>
</div>
</body>
</html>
"""


# ── markdown: the household converter, with pictures and links made to fit the site ──────────

class Docs:
    def __init__(self, render, inline, firmware: Path, maki_root: Path):
        self.render, self.inline = render, inline
        self.roots = {"maki": maki_root, "firmware": firmware}
        self.ids = {}  # repository path -> doc id, for links between them
        for _group, pages in DOCS:
            for pid, _t, _b, (repo, path) in pages:
                self.ids[(repo, path)] = pid
        self.images = set()

    def strip_title(self, lines):
        out = list(lines)
        while out and not out[0].strip():
            out.pop(0)
        if out and out[0].startswith("# "):
            out.pop(0)
        return out

    def figures(self, lines, repo, path, headings):
        """Render. The converter reads flat markdown, so what it doesn't know is done here: a line
        that's only a picture (`![alt](file "caption")`) is a figure, a numbered list an <ol>, and
        a code block indented under a list item is lifted out to stand on its own."""
        chunks, cur = [], []
        i = 0
        while i < len(lines):
            line = lines[i]
            m = re.match(r'^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$', line)
            fence = re.match(r"^( +)```", line)
            if line.startswith("```"):  # a code block: as it is, whatever it holds
                cur.append(line)
                i += 1
                while i < len(lines):
                    cur.append(lines[i])
                    i += 1
                    if lines[i - 1].startswith("```"):
                        break
            elif m:
                chunks.append(("md", cur))
                cur = []
                chunks.append(("img", m.groups()))
                i += 1
            elif fence:
                pad = len(fence.group(1))
                cur.append(line[pad:])
                i += 1
                while i < len(lines):
                    body = lines[i]
                    cur.append(body[pad:] if not body[:pad].strip() else body)
                    i += 1
                    if body.strip().startswith("```"):
                        break
            elif re.match(r"^\d+\. ", line):
                items = []
                while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                    item = [re.sub(r"^\d+\. ", "", lines[i])]
                    i += 1
                    while i < len(lines) and lines[i].startswith(" ") and lines[i].strip():
                        item.append(lines[i].strip())
                        i += 1
                    items.append(" ".join(item))
                    if i + 1 < len(lines) and not lines[i].strip() and re.match(r"^\d+\. ", lines[i + 1]):
                        i += 1
                chunks.append(("md", cur))
                cur = []
                chunks.append(("ol", items))
            else:
                cur.append(line)
                i += 1
        chunks.append(("md", cur))
        out = []
        for kind, value in chunks:
            if kind == "md":
                if value:
                    out.append(self.render(value, headings))
                continue
            if kind == "ol":
                out.append("<ol>" + "".join(f"<li>{self.inline(x)}</li>" for x in value) + "</ol>")
                continue
            alt, src, caption = value
            name = os.path.basename(src)
            self.images.add((repo, str((Path(path).parent / src))))
            cap = f"<figcaption>{html.escape(caption)}</figcaption>" if caption else ""
            out.append(f'<figure><a class="zoom" href="/img/{esc(name)}"><img class="shot" src="/img/{esc(name)}" '
                       f'alt="{esc(alt)}" loading="lazy" decoding="async"></a>{cap}</figure>')
        return "\n".join(out)

    def links(self, content, repo, path):
        """Links as the repository has them, made to work on the site: another doc's page, else GitHub."""
        base_url, branch = REPOS[repo]
        here = Path(path).parent

        def fix(m):
            href = html.unescape(m.group(1))
            if href.startswith(BASE + "/"):  # the site itself: stay on whichever address it's read at
                return f'href="{esc(href[len(BASE):])}"'
            # a link to a file another doc is made from, on GitHub: that doc's page instead
            for (r, p), pid in self.ids.items():
                url, br = REPOS[r]
                if href.split("#")[0] == f"{url}/blob/{br}/{p}":
                    frag = href.partition("#")[2]
                    return f'href="/docs/{pid}.html{"#" + frag if frag else ""}"'
            if re.match(r"^[a-z]+:|^#|^/", href):
                return m.group(0)
            target, _, frag = href.partition("#")
            resolved = os.path.normpath(str(here / target)) if target else path
            if (repo, resolved) in self.ids:
                url = f"/docs/{self.ids[(repo, resolved)]}.html"
            else:
                kind = "tree" if not os.path.splitext(resolved)[1] else "blob"
                url = f"{base_url}/{kind}/{branch}/{resolved}"
            return f'href="{esc(url + ("#" + frag if frag else ""))}"'
        return re.sub(r'href="([^"]*)"', fix, content)

    def build(self, repo, path, headings):
        text = (self.roots[repo] / path).read_text()
        lines = self.strip_title(text.split("\n"))
        return self.links(self.figures(lines, repo, path, headings), repo, path)


# ── the store's apps ───────────────────────────────────────────────────────────────────────────

def icon_svg(b64: str) -> str:
    """A 64 x 64 icon as maki draws it, light on dark: a run of light pixels a rect."""
    raw = base64.b64decode(b64)
    words = [int.from_bytes(raw[i:i + 4], "little") for i in range(0, len(raw), 4)]
    d = []
    for y in range(64):
        x = 0
        while x < 64:
            light = ((words[y * 2 + (x >> 5)] >> (x & 31)) & 1) == 0
            if not light:
                x += 1
                continue
            s = x
            while x < 64 and ((words[y * 2 + (x >> 5)] >> (x & 31)) & 1) == 0:
                x += 1
            d.append(f"M{s + 8} {y + 8}h{x - s}v1h{s - x}z")
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" shape-rendering="crispEdges">'
            '<rect width="80" height="80" rx="14" fill="#11111b"/>'
            f'<path fill="#f3efe6" d="{"".join(d)}"/></svg>')


def slug_of(app_id: str) -> str:
    return app_id.split(".")[-1]


def first_sentence(t: str) -> str:
    """A description's first sentence, or all it says before its colon, for a card."""
    m = re.search(r"[.!?:](\s|$)", t)
    if not m:
        return t
    end = t[m.start()]
    return t[:m.start()] + ("." if end == ":" else end)


def fingerprint(hex_key: str) -> str:
    h = hashlib.sha256(bytes.fromhex(hex_key)).hexdigest()[:24]
    return " ".join(h[i:i + 4] for i in range(0, 24, 4))


def size(n: int) -> str:
    return f"{n / 1024:.0f} KiB" if n < 1024 * 1024 else f"{n / 1048576:.1f} MiB"


CATEGORY_ORDER = ["Finance", "Security", "Social", "Productivity", "Tools", "Games"]


def build_apps(index, out: Path, css_version):
    apps = sorted(index["apps"], key=lambda a: (CATEGORY_ORDER.index(a["category"]) if a["category"] in CATEGORY_ORDER else 99, a["name"].lower()))
    (out / "apps" / "icons").mkdir(parents=True, exist_ok=True)
    cards = []
    for a in apps:
        s = slug_of(a["id"])
        (out / "apps" / "icons" / f"{s}.svg").write_text(icon_svg(a["icon"]))
        perms = [p["name"] for p in a["permissions"]]
        chips = "".join(f'<span class="chip">{esc(p)}</span>' for p in perms) or '<span class="chip none">the basics</span>'
        native = ' <span class="st native">native</span>' if a["kind"] == "native" else ""
        cards.append(
            f'<a class="app" href="/apps/{s}.html" data-cat="{esc(a["category"])}">'
            f'<img src="/apps/icons/{s}.svg" alt="" width="64" height="64" loading="lazy">'
            f'<span class="nm">{esc(a["name"])}{native}</span><span class="ct">{esc(a["category"])}</span>'
            f'<span class="ds">{esc(first_sentence(a["description"]))}</span>'
            f'<span class="pm">{chips}</span></a>')
        write_app_page(a, out, css_version)
    counts = {}
    for a in apps:
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    filters = [f'<button type="button" data-f="" aria-pressed="true">All<span class="n">{len(apps)}</span></button>']
    for c in CATEGORY_ORDER:
        if c in counts:
            filters.append(f'<button type="button" data-f="{c}" aria-pressed="false">{c}<span class="n">{counts[c]}</span></button>')
    script = """<script>
document.querySelectorAll('.filters button').forEach(function (b) {
  b.addEventListener('click', function () {
    var f = b.dataset.f
    document.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false') })
    document.querySelectorAll('.app').forEach(function (a) { a.hidden = !!f && a.dataset.cat !== f })
  })
})
</script>"""
    body = f"""<div class="pagehead">
  <div class="kicker">The maki store</div>
  <h1>Apps for maki</h1>
  <p class="blurb">{len(apps)} apps, each rebuilt from its public source by the store before it&rsquo;s stamped, byte for byte.
  Install them from maki desktop&rsquo;s Apps page; maki shows you each one, and every permission it wants, before it goes on.</p>
</div>
<div class="filters" role="group" aria-label="Show a category">{"".join(filters)}</div>
<div class="appgrid">
{chr(10).join(cards)}
</div>
<section style="margin-top:3rem">
  <h2>Your own</h2>
  <p class="lede">Write one, <span class="hl">in Rust.</span></p>
  <p class="body">An app is a <code>.maki</code> file: WebAssembly (or native code the kernel confines), a manifest, a
  64&times;64 icon and its developer&rsquo;s signature. Sideload it through maki desktop, or send it to the store as a pull
  request naming the commit it&rsquo;s built from.</p>
  <div class="btns"><a class="btn" href="/docs/sdk.html">Writing apps</a><a class="btn ghost" href="{GH}/maki-apps">The store&rsquo;s repository</a></div>
</section>
{script}"""
    (out / "apps" / "index.html").write_text(page(
        path="/apps/", title="Apps", nav="apps", css_version=css_version, wide=True,
        description=f"The maki store: {len(apps)} apps for maki, the DEF CON 34 badge firmware, each rebuilt from its source.",
        body=body))
    return apps


def write_app_page(a, out: Path, css_version):
    s = slug_of(a["id"])
    src = a.get("source") or {}
    perms = "".join(
        f'<li><b>{esc(p["name"])}</b><span>&ldquo;{esc(p["reason"])}&rdquo;</span>'
        f'<span class="what">{esc(PERMISSIONS.get(p["name"], ""))}</span></li>'
        for p in a["permissions"]) or '<li><b>the basics</b><span>No permissions: the screen, the buttons, its own storage, the time and random numbers.</span></li>'
    source_link = ""
    if src:
        tree = f'{src["repo"]}/tree/{src["commit"]}/{src.get("path", "")}'.rstrip("/")
        source_link = f'<dt>Source</dt><dd><a href="{esc(tree)}">{esc(src.get("path") or src["repo"])}</a> at <code>{esc(src["commit"][:9])}</code></dd>'
    bundle = f'{GH}/maki-apps/blob/main/store/{a["path"]}'
    native = '<span class="st native">native</span>' if a["kind"] == "native" else '<span class="st later">WebAssembly</span>'
    body = f"""<div class="apphead">
  <img src="/apps/icons/{s}.svg" alt="{esc(a["name"])}&rsquo;s icon" width="128" height="128">
  <div>
    <div class="kicker"><a href="/apps/" style="text-decoration:none">The maki store</a> &middot; {esc(a["category"])}</div>
    <h1>{esc(a["name"])}</h1>
    <div class="meta">{native}<span>version {esc(a["label"])}</span><span>&middot;</span><span>{esc(size(a["bytes"]))}</span></div>
  </div>
</div>
<div class="appbody">
  <div>
    <p class="desc">{esc(a["description"])}</p>
    <h2 style="margin-top:2rem">What it asks for</h2>
    <p class="muted" style="margin:0">Each in its developer&rsquo;s words, as maki shows it before installing, and what it lets the app do.</p>
    <ul class="perms">{perms}</ul>
  </div>
  <div class="facts">
    <dl>
      <dt>ID</dt><dd><code>{esc(a["id"])}</code></dd>
      <dt>Version</dt><dd>{esc(a["label"])} <span style="color:var(--overlay0)">({a["version"]})</span></dd>
      <dt>Memory</dt><dd>{a["memory_kib"]} KiB</dd>
      <dt>Storage</dt><dd>{a["storage_kib"]} KiB{"" if a["storage_kib"] else " (none)"}</dd>
      <dt>Backup</dt><dd>{"its data goes in maki&rsquo;s backups" if a["backup"] else "its data stays out of backups"}</dd>
      <dt>Developer</dt><dd><code>{esc(fingerprint(a["developer"]))}</code></dd>
      {source_link}
      <dt>Bundle</dt><dd><a href="{esc(bundle)}">stamped by the store</a><br><code style="font-size:.7rem;color:var(--overlay0)">sha256 {esc(a["sha256"][:16])}&hellip;</code></dd>
    </dl>
    <a class="btn" href="/docs/apps.html#installing-an-app">How to install it</a>
  </div>
</div>"""
    (out / "apps" / f"{s}.html").write_text(page(
        path=f"/apps/{s}.html", title=a["name"], nav="apps", css_version=css_version, wide=True,
        description=f'{a["name"]} for maki: {first_sentence(a["description"])}', body=body))


# ── the docs ───────────────────────────────────────────────────────────────────────────────────

def build_docs(docs: Docs, out: Path, css_version, commits):
    (out / "docs").mkdir(parents=True, exist_ok=True)
    flat = [(g, p) for g, pages in DOCS for p in pages]
    for n, (group, (pid, title, blurb, (repo, path))) in enumerate(flat):
        src = docs.roots[repo] / path
        if not src.exists():
            print(f"  ! docs: {repo}:{path} is missing, {pid} skipped", file=sys.stderr)
            continue
        headings = []
        content = docs.build(repo, path, headings)
        nav = [f'<h4>Overview</h4><ul><li><a href="/docs/">All the docs</a></li></ul>']
        for g, pages in DOCS:
            items = []
            for qid, qtitle, _b, _s in pages:
                here = ' class="here" aria-current="page"' if qid == pid else ""
                items.append(f'<li><a href="/docs/{qid}.html"{here}>{qtitle}</a></li>')
                if qid == pid:
                    for level, text, sid in headings:
                        if level == 2:
                            items.append(f'<li class="sub"><a href="#{sid}">{esc(text)}</a></li>')
            nav.append(f"<h4>{g}</h4><ul>{''.join(items)}</ul>")
        prev_ = flat[n - 1][1] if n > 0 else None
        next_ = flat[n + 1][1] if n + 1 < len(flat) else None
        pager = '<nav class="pager" aria-label="Next and previous">'
        if prev_:
            pager += f'<a href="/docs/{prev_[0]}.html"><small>Previous</small>{prev_[1]}</a>'
        if next_:
            pager += f'<a class="next" href="/docs/{next_[0]}.html"><small>Next</small>{next_[1]}</a>'
        pager += "</nav>"
        base_url, branch = REPOS[repo]
        body = f"""<div class="docs">
<aside aria-label="The docs">{"".join(nav)}</aside>
<main>
<span class="kicker">{esc(group)}</span>
<h1>{title}</h1>
<p class="blurb">{blurb}</p>
{content}
{pager}
<p class="src">Made from <a href="{base_url}/blob/{branch}/{path}">{repo}: {esc(path)}</a> at {esc(commits[repo])}. To change this page, change that.</p>
</main>
</div>"""
        (out / "docs" / f"{pid}.html").write_text(page(
            path=f"/docs/{pid}.html", title=title, nav="security" if pid == "security" else "docs",
            description=blurb, body=body, css_version=css_version, wide=True))
    groups = []
    for g, pages in DOCS:
        cards = "".join(f'<a class="card" href="/docs/{pid}.html"><h3>{t}</h3><p>{b}</p></a>' for pid, t, b, _ in pages)
        groups.append(f'<section class="{"first" if not groups else ""}"><h2>{g}</h2><div class="cards three">{cards}</div></section>')
    body = f"""<div class="pagehead">
  <div class="kicker">Documentation</div>
  <h1>maki&rsquo;s docs</h1>
  <p class="blurb">From flashing a badge to writing apps. Made from maki&rsquo;s repositories, so they say what the code does:
  the user guide from <a href="{GH}/maki/tree/main/docs">maki</a>, the SDK and the protocol from
  <a href="{GH}/maki-firmware">maki-firmware</a>.</p>
</div>
{"".join(groups)}"""
    (out / "docs" / "index.html").write_text(page(
        path="/docs/", title="Docs", nav="docs", css_version=css_version, wide=True,
        description="maki's documentation: flashing, first boot, maki desktop, the extension, wallets, signing, sudo, Nostr, the security model and writing apps.",
        body=body))


# ── the pages written by hand ──────────────────────────────────────────────────────────────────

def files_table(entry):
    rows = []
    for f in entry["files"]:
        rows.append(
            f'<tr><td><a href="{esc(f["url"])}">{esc(f["name"])}</a></td><td class="sz">{esc(size(f["bytes"]))}</td>'
            f'<td class="sum">sha256 {esc(f["sha256"])}</td></tr>')
    return f'<table class="files">{"".join(rows)}</table>'


def build_pages(out: Path, css_version, releases, apps):
    fills = {
        "files:firmware": lambda: files_table(releases["firmware"]),
        "files:desktop": lambda: files_table(releases["desktop"]),
        "files:extension": lambda: files_table(releases["extension"]),
        "release:firmware": lambda: esc(releases["firmware"]["release"]),
        "release:desktop": lambda: esc(releases["desktop"]["release"]),
        "version:firmware": lambda: esc(releases["firmware"]["name"]),
        "version:desktop": lambda: esc(releases["desktop"]["name"]),
        "commit:firmware": lambda: esc(releases["firmware"]["commit"][:9]),
        "commit:desktop": lambda: esc(releases["desktop"]["commit"][:9]),
        "date:firmware": lambda: esc(releases["firmware"]["date"]),
        "sums:firmware": lambda: esc(releases["firmware"]["sums"]),
        "sums:desktop": lambda: esc(releases["desktop"]["sums"]),
        "notices:firmware": lambda: esc(releases["firmware"]["notices"]),
        "notices:desktop": lambda: esc(releases["desktop"]["notices"]),
        "notices:extension": lambda: esc(releases["extension"]["notices"]),
        "protocol:firmware": lambda: str(releases["firmware"]["protocol"]),
        "version:extension": lambda: esc(releases["extension"]["name"]),
        "size:desktop": lambda: esc(size(releases["desktop"]["files"][0]["bytes"])),
        "url:desktop": lambda: esc(releases["desktop"]["files"][0]["url"]),
        "name:desktop": lambda: esc(releases["desktop"]["files"][0]["name"]),
        "perms:table": lambda: '<div class="tbl"><table><tr><th>Permission</th><th>What it lets an app do</th></tr>' + "".join(
            f'<tr><td><code>{esc(k)}</code></td><td>{esc(v)}</td></tr>' for k, v in PERMISSIONS.items()) + "</table></div>",
        "apps:count": lambda: str(len(apps)),
        "apps:strip": lambda: "".join(
            f'<a href="/apps/{slug_of(a["id"])}.html" title="{esc(a["name"])}"><img src="/apps/icons/{slug_of(a["id"])}.svg" alt="{esc(a["name"])}" width="56" height="56" loading="lazy"></a>'
            for a in apps),
    }
    for src in sorted((HERE / "pages").glob("*.html")):
        text = src.read_text()
        m = re.match(r"<!--(\{.*?\})-->\n", text, re.S)
        meta = json.loads(m.group(1))
        body = text[m.end():]
        body = re.sub(r"\{\{([a-z]+:[a-z]+)\}\}", lambda k: fills[k.group(1)](), body)
        dest = out / meta["path"].lstrip("/")
        if meta["path"].endswith("/"):
            dest = dest / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page(path=meta["path"], title=meta["title"], description=meta["description"], nav=meta["nav"],
                             body=body, css_version=css_version, wide=meta.get("wide", False)))


def main():
    ap = argparse.ArgumentParser(description="Build maki.netslum.io from maki's repositories.")
    ap.add_argument("--out", required=True)
    ap.add_argument("--firmware", default=str(ROOT / "xous-core"))
    ap.add_argument("--store", default=str(ROOT / "apps"))
    ap.add_argument("--netslum-lib", default="/usr/local/lib")
    args = ap.parse_args()
    sys.path.insert(0, args.netslum_lib)
    from netslum_md import inline, render  # the household's one converter

    out = Path(args.out)
    firmware, store = Path(args.firmware), Path(args.store)
    out.mkdir(parents=True, exist_ok=True)
    css = (HERE / "site.css").read_text()
    css_version = hashlib.sha256(css.encode()).hexdigest()[:10]
    (out / "site.css").write_text(css)
    commits = {"maki": git(ROOT, "rev-parse", "--short", "HEAD"), "firmware": git(firmware, "rev-parse", "--short", "HEAD")}

    index = json.loads((store / "store" / "index.json").read_text())
    apps = build_apps(index, out, css_version)
    docs = Docs(render, inline, firmware, ROOT)
    build_docs(docs, out, css_version, commits)
    releases = json.loads((HERE / "releases.json").read_text())
    build_pages(out, css_version, releases, apps)

    # the pictures: the site's own, then the repository's screenshots the docs use
    img = out / "img"
    img.mkdir(exist_ok=True)
    for f in (HERE / "static").glob("*"):
        if f.is_file():
            shutil.copy2(f, out / f.name)
    for f in sorted((ROOT / "docs").glob("*.png")):  # the repository's screenshots, for any page
        shutil.copy2(f, img / f.name)
    for repo, path in sorted(docs.images):
        shutil.copy2(docs.roots[repo] / path, img / os.path.basename(path))

    # every page, for search engines
    pages = sorted(p.relative_to(out) for p in out.rglob("*.html"))
    urls = "".join(f"<url><loc>{BASE}/{str(p).replace('index.html', '')}</loc></url>" for p in pages)
    (out / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    print(f"  maki-site: {len(pages)} pages, {len(apps)} apps, from maki {commits['maki']} and maki-firmware {commits['firmware']}, into {out}")


if __name__ == "__main__":
    main()
