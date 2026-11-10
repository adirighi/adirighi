import re, sys, json
src, out = sys.argv[1], sys.argv[2]
urls = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
html = open(f"{src}/index.html", encoding="utf8").read()
css = open(f"{src}/styles.css", encoding="utf8").read()
js = open(f"{src}/script.js", encoding="utf8").read()

body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'\s*<script src="script.js" defer></script>', "", body)
body = body.replace('<span id="jahr">2026</span>', '<span class="arq-jahr">2026</span>')
for k in ["lightbox", "lightbox-img", "lightbox-count"]:
    body = body.replace(f'id="{k}"', f'id="arq-{k}"')
for k in ["start", "arbeiten", "statement", "vita", "kontakt"]:
    body = body.replace(f'id="{k}"', f'id="{k}"')  # Anker bleiben lesbar

# CSS: Variablen umbenennen, auf .arq begrenzen
css = re.sub(r"--([a-z0-9-]+)", r"--arq-\1", css)
css = css.replace(":root {", ".arq {", 1)
css = css.replace("*, *::before, *::after { box-sizing: border-box; }", ".arq, .arq *, .arq *::before, .arq *::after { box-sizing: border-box; }")
css = css.replace("html { scroll-behavior: smooth; scroll-padding-top: 4rem; -webkit-text-size-adjust: 100%; }", "html { scroll-behavior: smooth; scroll-padding-top: 4rem; }")
css = css.replace("\nbody {", "\n.arq {", 1)
css = css.replace("html { scroll-behavior: auto; }", "html { scroll-behavior: auto; }")
def scope(block):
    sel, rest = block.group(1), block.group(2)
    s = sel.strip()
    if s.startswith(("@", ".arq", "html", "from", "to")) or s == "": return block.group(0)
    parts = [p.strip() for p in sel.split(",")]
    return ", ".join(".arq " + p for p in parts) + " {" + rest
# nur einfache Regeln (keine @-Blöcke) prefixen; in @media ebenfalls
css = re.sub(r"(?m)^(\s*)([^@{}\n/][^{}\n]*?)\s*\{", lambda m: m.group(1) + scope(re.match(r"(.*)\{(.*)", m.group(2) + " {", re.S)) if False else m.group(1) + (m.group(2) if m.group(2).strip().startswith((".arq","html","from","to")) else ", ".join(".arq " + p.strip() for p in m.group(2).split(","))) + " {", css)
css = css.replace(".arq .lightbox::backdrop { background: var(--arq-paper); }", "#arq-lightbox::backdrop { background: #ffffff; }")
css = css.replace("url(\"fonts/instrument-sans.woff2\")", f"url(\"{urls.get('instrument-sans.woff2','fonts/instrument-sans.woff2')}\")")
css = css.replace("font-family: var(--arq-font);", "font-family: var(--arq-font); margin: 0;", 1)

js = js.replace("getElementById('jahr')", "querySelector('.arq-jahr')")
for k in ["lightbox-img", "lightbox-count"]:
    js = js.replace(f"getElementById('{k}')", f"getElementById('arq-{k}')")
js = js.replace("getElementById('lightbox')", "getElementById('arq-lightbox')")

def img(m):
    name = m.group(1)
    return urls.get(name, "bilder/" + name)
body = re.sub(r"bilder/([a-z0-9-]+\.jpg)", img, body)
# Oxygen- oder Theme-Abstände neutralisieren
pre = ".arq { position: relative; isolation: isolate; }\n.arq p, .arq h1, .arq h2, .arq h3, .arq dl, .arq dd, .arq ul, .arq figure, .arq dialog { margin: 0; }\n"
out_html = f'<div class="arq">\n<style>\n{pre}{css}\n</style>\n{body.strip()}\n<script>\n{js}\n</script>\n</div>\n'
open(out, "w", encoding="utf8").write(out_html)
print(len(out_html))
