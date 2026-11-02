"""Regenerate the approved Shared tile kit through ../build.py --final.

Uses the existing local Space Grotesk OFL font. Artwork is outlined, not embedded.
The skill-local Python renders/audits the output after this construction step.
"""
from pathlib import Path
from html import escape
import json
import math
import re
import subprocess
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FINAL = Path(__file__).resolve().parent
ROOT = FINAL.parents[2]
PUBLIC = ROOT/'packages/site/public'
FONT = Path('/var/home/darko/Work/wts/blog/dist/client/fonts/space-grotesk-latin.woff2')
SKILL = Path('/home/darko/.claude/skills/logo-design')
INK, COBALT, PAPER, REVERSED, GRAPHITE = '#192029', '#0a6ddd', '#f8fafd', '#eff2f6', '#161b22'
assert FONT.is_file(), FONT
font = instantiateVariableFont(TTFont(FONT), {'wght':600})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()


def path(d, fill, css_class=None):
    css = f' class="{css_class}"' if css_class else ''
    return f'<path{css} fill="{fill}" d="{d}"/>'


def svg(title,width,height,body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
            f'width="{width}" height="{height}" role="img" aria-labelledby="title">\n'
            f'<title id="title">{escape(title)}</title>\n{body}\n</svg>\n')


def outline(text, font, size, baseline, x=0, tracking=0):
    gs, cm = font.getGlyphSet(), font.getBestCmap()
    scale = size/font['head'].unitsPerEm
    parts=[]
    start=x
    for char in text:
        glyph = cm[ord(char)]
        pen = SVGPathPen(gs)
        gs[glyph].draw(TransformPen(pen,(scale,0,0,-scale,x,baseline)))
        d=re.sub(r'-?\d+\.\d+',lambda m:f'{float(m.group()):.2f}'.rstrip('0').rstrip('.'),pen.getCommands())
        if d:
            parts.append(path(d,INK))
        x += font['hmtx'][glyph][0]*scale+tracking
    return ''.join(parts),x-start


wordmark, word_advance = outline('relatinator',font,80,62,tracking=.35)
# Original approved Shared tile geometry, including open negative space.
def symbol(ink=INK, mono=False, favicon=False, classes=False):
    corners = ('M2 2H42V17H17V42H2Z','M47 22H62V62H22V47H47Z') if favicon else ('M8 8H40V20H20V40H8Z','M44 24H56V56H24V44H44Z')
    term = 'M22 22H42V42H22Z' if favicon else 'M24 24H40V40H24Z'
    return (path(corners[0],ink,'ink' if classes else None)+
            path(term,ink if mono else COBALT)+
            path(corners[1],ink,'ink' if classes else None))


horizontal = '<g id="symbol" transform="translate(0 2)">'+symbol()+'</g><g id="wordmark" transform="translate(82 0)">'+wordmark+'</g>'
stacked = '<g id="symbol" transform="translate(120 8) scale(3)">'+symbol()+'</g><g id="wordmark" transform="translate(2 198)">'+wordmark+'</g>'
master_bodies = {
    'a-symbol': (64,64,symbol()),
    'a-symbol-reversed': (64,64,symbol(REVERSED)),
    'a-lockup': (507,72,horizontal),
    'a-lockup-reversed': (507,72,horizontal.replace(INK,REVERSED)),
    'a-lockup-stacked': (432,288,stacked),
    'a-lockup-stacked-reversed': (432,288,stacked.replace(INK,REVERSED)),
    'a-symbol-mono': (64,64,symbol('currentColor',mono=True)),
}
for name,(width,height,body) in master_bodies.items():
    (FINAL/f'{name}.svg').write_text(svg(f'relatinator / Shared tile / {name}',width,height,body))

favicon = svg('relatinator favicon',64,64,
    '<style>@media (prefers-color-scheme: dark) { .ink { fill: '+REVERSED+'; } }</style>'+symbol(favicon=True,classes=True))
(PUBLIC/'favicon.svg').write_text(favicon)
(PUBLIC/'logo.svg').write_text((FINAL/'a-lockup.svg').read_text())
(PUBLIC/'logo-stacked.svg').write_text((FINAL/'a-lockup-stacked.svg').read_text())
(ROOT/'logo.svg').write_text((FINAL/'a-lockup-stacked.svg').read_text())

font500 = instantiateVariableFont(TTFont(FONT), {'wght':500})
tagline,tagline_advance = outline('Find related posts when your site builds.',font500,32,378,x=104)
assert tagline_advance < 990,tagline_advance
og = svg('relatinator / Find related posts when your site builds.',1200,630,
    f'<rect width="1200" height="630" fill="{PAPER}"/>'+
    '<rect x="40.5" y="40.5" width="1119" height="549" fill="none" stroke="#dadee3" stroke-width="1"/>'+
    '<g transform="translate(90 178) scale(1.8)">'+horizontal+'</g>'+tagline)
(FINAL/'og.svg').write_text(og)
# Visible symbol bounds are 36..144: 20% of 180px on every side.
apple = svg('relatinator Apple touch icon',180,180,
    f'<rect width="180" height="180" fill="{PAPER}"/>'+
    '<g transform="translate(18 18) scale(2.25)">'+symbol()+'</g>')
(FINAL/'apple-touch-icon.svg').write_text(apple)

parts=[f'<rect width="1440" height="1380" fill="{PAPER}"/>']
def label(x,y,text,size=15,color=INK,weight=400):
    parts.append(f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}" font-family="Cantarell, sans-serif">{escape(text)}</text>')
def place(name,x,y,width,height=None):
    raw=(FINAL/f'{name}.svg').read_text()
    vb=re.search(r'viewBox="([^"]+)"',raw).group(1)
    _,_,w,h=map(float,vb.split())
    height=height if height is not None else width*h/w
    body=raw.split('</title>',1)[1].rsplit('</svg>',1)[0]
    body=re.sub(r' id="[^"]+"','',body)
    parts.append(f'<svg x="{x}" y="{y}" width="{width}" height="{height}" viewBox="{vb}">{body}</svg>')
label(56,59,'relatinator / Shared tile',30,weight=600)
label(56,89,'Approved direction A · final digital artwork',16)
label(56,139,'HORIZONTAL / LIGHT',12,weight=600)
place('a-lockup',56,172,660)
label(56,325,'STACKED / LIGHT',12,weight=600)
place('a-lockup-stacked',72,354,384)
label(530,325,'SYMBOL / ONE COLOR',12,weight=600)
place('a-symbol-mono',530,357,128)
label(56,686,'FAVICON / ACTUAL PIXELS',12,weight=600)
for x,size in [(56,16),(152,32),(248,48)]:
    raw=favicon.split('</title>',1)[1].rsplit('</svg>',1)[0]
    parts.append(f'<svg x="{x}" y="711" width="{size}" height="{size}" viewBox="0 0 64 64">{raw}</svg>')
    label(x,790,str(size)+' px',12)
label(398,686,'APPLE TOUCH / 180 PX',12,weight=600)
place('apple-touch-icon',398,704,180)
parts.append(f'<rect x="752" y="122" width="632" height="762" rx="12" fill="{GRAPHITE}"/>')
label(784,156,'DARK GROUND / REVERSED INK',12,REVERSED,600)
place('a-lockup-reversed',784,190,560)
place('a-lockup-stacked-reversed',864,347,384)
for x,size in [(800,16),(896,32),(992,48)]:
    raw=symbol(REVERSED,favicon=True)
    parts.append(f'<svg x="{x}" y="702" width="{size}" height="{size}" viewBox="0 0 64 64">{raw}</svg>')
    label(x,790,str(size)+' px',12,REVERSED)
label(56,938,'OPEN GRAPH / 1200 × 630 SOURCE, SHOWN AT HALF SIZE',12,weight=600)
place('og',56,960,600)
label(752,980,'Production values',19,weight=600)
label(752,1016,'Ink '+INK+' · cobalt '+COBALT)
label(752,1044,'Paper '+PAPER+' · reversed ink '+REVERSED)
label(752,1088,'Space Grotesk 600 / logo lettering, outlined')
label(752,1116,'Space Grotesk 500 / Open Graph line, outlined')
label(752,1144,'SIL Open Font License 1.1')
label(752,1188,'Favicon: 2px visual padding on a 64px grid')
label(752,1216,'Touch icon: 20% visual padding per side')
label(56,1339,'A shared term stays visible between two related document corners.',16)
(FINAL/'sheet.svg').write_text(svg('relatinator final Shared tile logo kit',1440,1380,''.join(parts)))

(FINAL/'source.json').write_text(json.dumps({
    'direction':'A / Shared tile','colors':{'ink':INK,'cobalt':COBALT,'paper':PAPER,'reversed_ink':REVERSED},
    'palette_authority':'User-specified HEX values. No replacement conversion applied.',
    'font_file':str(FONT),'font_license':'SIL Open Font License 1.1',
    'font_license_evidence':'Local font name table entry 14: https://scripts.sil.org/OFL',
    'logo_weight':600,'tagline_weight':500,'tagline_size_px':32,
    'favicon_visual_padding':2,'touch_icon_visual_padding_px':36,
    'horizontal_optical_alignment':'Symbol shifted to center on outlined wordmark, not artboard center.',
    'regeneration':'Run designs/logo/build.py --final with Python and fontTools. Rendering uses the skill-local Python.'},indent=2)+'\n')
subprocess.run([str(SKILL/'.venv/bin/python'),'-B',str(FINAL/'render_final.py')],check=True)
print('Built approved Shared tile kit and site assets.')
