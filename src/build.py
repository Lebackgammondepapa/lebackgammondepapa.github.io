"""Construit les deux versions du jeu à partir des mêmes sources (lancer : python3 src/build.py depuis la racine ou src/).
 - index.html (racine du dépôt) : version publique servie par GitHub Pages, relais MQTT intégré,
   polices hébergées sur le site (fonts/) et service worker (sw.js) pour jouer sans réseau
 - src/out/backgammon.html      : version publiée dans Claude (artifact), même code, polices Google Fonts"""
import os, re, hashlib
SRC = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(SRC)
rd = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()
head, app = rd('head.part'), rd('app.js')
eng = '\n'.join(l for l in rd('engine.js').splitlines() if not l.startswith("if (typeof module"))
mqtt = rd('vendor/mqtt.min.js'); assert '</script' not in mqtt.lower()
body = head.replace('/*__ENGINE__*/', eng) + '<script>\n' + app + '</script>\n'
os.makedirs(os.path.join(SRC, 'out'), exist_ok=True)
open(os.path.join(SRC, 'out', 'backgammon.html'), 'w', encoding='utf-8').write(body)
# version publique : les polices viennent du site (le service worker les garde pour le jeu hors connexion)
GFONTS = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]*">\n', body).group(0)
FONTS = ['cormorant-garamond-500.woff2', 'cormorant-garamond-600.woff2', 'manrope.woff2']
font_css = (
  "@font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:500;font-display:swap;src:url(fonts/cormorant-garamond-500.woff2) format('woff2')}"
  "@font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:600;font-display:swap;src:url(fonts/cormorant-garamond-600.woff2) format('woff2')}"
  "@font-face{font-family:'Manrope';font-style:normal;font-weight:200 800;font-display:swap;src:url(fonts/manrope.woff2) format('woff2-variations'),url(fonts/manrope.woff2) format('woff2')}")
font_preload = ''.join(f'<link rel="preload" href="fonts/{f}" as="font" type="font/woff2" crossorigin>\n' for f in FONTS)
pub_body = body.replace(GFONTS, '')
# service worker : nouvelle version (donc nouveau cache) dès que ses règles ou les polices changent
sw = rd('sw.js'); hv = hashlib.sha1(sw.encode())
for f in FONTS: hv.update(open(os.path.join(ROOT, 'fonts', f), 'rb').read())
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw.replace('__VERSION__', hv.hexdigest()[:10]))
pub_head = '''<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Backgammon</title>
<meta name="description" content="Backgammon : contre l'ordinateur, à deux, ou en ligne avec un ami.">
<meta name="theme-color" content="#0a142c">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Backgammon">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
''' + font_preload + '''<style>''' + font_css + '''</style>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
<style>html{box-sizing:border-box;color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script>
''' + mqtt + '''
</script>
</head><body>
'''
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(pub_head + pub_body + '</body></html>\n')
for name, html in [('artifact', body), ('public', open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())]:
    print(name, len(html), 'octets')
