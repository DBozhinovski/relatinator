"""Build concepts, or run `build.py --final` to regenerate the approved Shared tile kit.

Lettering source: Space Grotesk, weight 600, SIL Open Font License 1.1.
The local font has the OFL URL in name table entry 14. No font is embedded.
Symbols and the shared crossbar use hand-authored, filled geometry.
"""
from pathlib import Path
import json
import math
import re
from html import escape
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import runpy
import sys

OUT = Path(__file__).resolve().parent
FONT = Path('/var/home/darko/Work/wts/blog/dist/client/fonts/space-grotesk-latin.woff2')
PAPER = '#f8fafc'


def oklch_hex(lightness, chroma, hue):
    a, b = chroma * math.cos(math.radians(hue)), chroma * math.sin(math.radians(hue))
    l = (lightness + 0.3963377774*a + 0.2158037573*b)**3
    m = (lightness - 0.1055613458*a - 0.0638541728*b)**3
    s = (lightness - 0.0894841775*a - 1.2914855480*b)**3
    rgb = (4.0767416621*l-3.3077115913*m+0.2309699292*s,
           -1.2684380046*l+2.6097574011*m-0.3413193965*s,
           -0.0041960863*l-0.7034186147*m+1.7076147010*s)
    encoded = [12.92*c if c <= .0031308 else 1.055*c**(1/2.4)-.055 for c in rgb]
    channels = [round(min(1,max(0,c))*255) for c in encoded]
    return '#' + ''.join(f'{c:02x}' for c in channels), channels, encoded, rgb


def build_palette():
    palette = {}
    for name, values in [('ink', (.24,.02,258)), ('cobalt', (.58,.20,256)), ('graphite', (.22,.016,260))]:
        color, rgb, unrounded, linear = oklch_hex(*values)
        palette[name] = {'oklch': values, 'hex': color, 'rgb': rgb,
                         'srgb_before_clipping_and_rounding': unrounded,
                         'linear_srgb_before_clipping': linear,
                         'in_srgb_gamut': all(0 <= c <= 1 for c in linear),
                         'conversion': 'OKLab D65 to linear sRGB, sRGB transfer, channel clipping, nearest 8-bit rounding'}
    return palette


def rounded(commands):
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.2f}'.rstrip('0').rstrip('.'), commands)


def path(d, fill='#000000'):
    return f'<path fill="{fill}" d="{d}"/>'


class Lettering:
    def __init__(self):
        self.font = instantiateVariableFont(TTFont(FONT), {'wght': 600})
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()

    def letter(self, char, x, scale=.08, baseline=62, stem_only=False):
        pen = SVGPathPen(self.glyphs)
        self.glyphs[self.cmap[ord(char)]].draw(TransformPen(pen, (scale,0,0,-scale,x,baseline)))
        d = rounded(pen.getCommands())
        if stem_only:
            d = d.split('Z',1)[0]+'Z'
        return d

    def wordmark(self, custom=False):
        x, items, positions = 0, [], []
        for index, char in enumerate('relatinator'):
            positions.append(x)
            items.append(path(self.letter(char,x,stem_only=custom and index==5)))
            x += self.font['hmtx'][self.cmap[ord(char)]][0]*.08 + .35
        if custom:
            # A single shared term bar replaces the i dot and meets the first t stem.
            left, right = positions[4]+156.3*.08, positions[5]+206.3*.08
            top, bottom = 62-686*.08, 62-576*.08
            items.append(path(f'M{left:.2f} {top:.2f}H{right:.2f}V{bottom:.2f}H{left:.2f}Z'))
        return ''.join(items), round(x-2,2)


def svg(title, width, height, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
            f'width="{width}" height="{height}" role="img" aria-labelledby="title">\n'
            f'<title id="title">{escape(title)}</title>\n{body}\n</svg>\n')


def build_masters(normal_word, shared_word, word_width):
    # Two page corners surround one common term. All holes are real negative space.
    a_symbol = path('M8 8H40V20H20V40H8Z') + path('M24 24H40V40H24Z') + path('M44 24H56V56H24V44H44Z')
    # The stepped shoulder comes from two offset result edges. One continuous r silhouette.
    c_symbol = path('M12 54V10H24V16H30V10H52V24H38V30H30V38H24V54Z')
    # The small r uses one contour to avoid a seam at the shared-bar terminal.
    b_favicon = path('M13 54V10H25V14L29 10H51V20H40C31 20 25 27 25 37V54Z')
    return {
        'a-symbol': (64,64,a_symbol),
        'a-lockup': (math.ceil(word_width+90),80, '<g id="symbol" transform="translate(0 8)">'+a_symbol+'</g><g id="wordmark" transform="translate(82 0)">'+normal_word+'</g>'),
        'b-wordmark': (math.ceil(word_width+14),80, '<g id="wordmark" transform="translate(6 0)">'+shared_word+'</g>'),
        'b-favicon': (64,64,b_favicon),
        'c-monogram': (64,64,c_symbol),
    }


def color_master(name, body, ink, cobalt):
    color = body.replace('#000000',ink)
    if name.startswith('a-'):
        return color.replace(path('M24 24H40V40H24Z',ink),path('M24 24H40V40H24Z',cobalt))
    if name == 'b-wordmark':
        # Only the new shared bar receives the accent.
        start = color.rfind('<path')
        return color[:start]+color[start:].replace(ink,cobalt)
    if name == 'b-favicon':
        return color + path('M29 10H51V20H29Z',cobalt)
    # The continuous monogram uses one cobalt fill.
    return color.replace(ink,cobalt)


def write_masters(masters, ink, cobalt):
    for name, (width,height,body) in masters.items():
        (OUT/f'{name}.svg').write_text(svg(f'relatinator / {name} / black',width,height,body))
        color = color_master(name,body,ink,cobalt)
        (OUT/f'{name}-color.svg').write_text(svg(f'relatinator / {name} / ink and cobalt',width,height,color))


class ConceptSheet:
    """Collect presentation text and samples without changing the outlined masters."""

    def __init__(self, palette, normal_word, word_width):
        self.ink = palette['ink']['hex']
        self.cobalt = palette['cobalt']['hex']
        self.dark = palette['graphite']['hex']
        self.normal_word = normal_word
        self.word_width = word_width
        self.parts = []

    def add(self, text):
        self.parts.append(text)

    def label(self, x, y, text, size=15, color=None, weight=400):
        if color is None:
            color = self.ink
        self.add(f'<text x="{x}" y="{y}" fill="{color}" font-family="Cantarell, sans-serif" font-size="{size}" font-weight="{weight}">{escape(text)}</text>')

    def line(self, x, y, text, color=None):
        self.label(x,y,text,14,color)

    def place(self, name, x, y, width=None, height=None, reverse=False):
        raw=(OUT/f'{name}.svg').read_text()
        view=re.search(r'viewBox="([^"]+)"',raw).group(1)
        _,_,vw,vh=map(float,view.split())
        if height is None:
            height=width*vh/vw
        if width is None:
            width=height*vw/vh
        body=raw.split('</title>',1)[1].rsplit('</svg>',1)[0]
        if reverse:
            body=body.replace('#000000',PAPER).replace(self.ink,PAPER)
        self.add(f'<svg x="{x}" y="{y}" width="{width}" height="{height}" viewBox="{view}">{body}</svg>')

    def header_sample(self, x, icon, lockup):
        self.label(x+24,514,'HEADER / 28 PX',12,weight=600)
        if lockup:
            self.place(lockup,x+24,536,height=28)
        else:
            self.place(icon,x+24,536,height=28)
            # Context only: companion site wordmark, not a C master lockup.
            self.add(f'<svg x="{x+64}" y="536" width="{self.word_width*28/80}" height="28" viewBox="0 0 {self.word_width} 80">{self.normal_word}</svg>')

    def favicon_samples(self, x, y, label_y, icon, reverse=False):
        for size in (16,28,32,64):
            self.place(icon,x,y,width=size,reverse=reverse)
            self.label(x,label_y,str(size),12,PAPER if reverse else self.ink)
            x+=96

    def dark_samples(self, x, icon, lockup):
        self.add(f'<rect x="{x+16}" y="749" width="432" height="263" rx="10" fill="{self.dark}"/>')
        self.label(x+32,779,'DARK / REVERSED SHAPES',12,PAPER,600)
        if lockup:
            self.place(lockup,x+32,797,height=28,reverse=True)
        else:
            self.place(icon,x+32,797,height=28,reverse=True)
            self.add(f'<svg x="{x+72}" y="797" width="{self.word_width*28/80}" height="28" viewBox="0 0 {self.word_width} 80">{self.normal_word.replace("#000000",PAPER)}</svg>')
        self.favicon_samples(x+32,857,971,icon,reverse=True)

    def color_sample(self, x, icon, lockup):
        self.label(x+24,1051,'ONE COLOR PASS / INK + COBALT',12,weight=600)
        if lockup:
            self.place(lockup+'-color',x+24,1076,height=42)
        else:
            self.place(icon+'-color',x+24,1065,width=64)

    def tradeoffs(self, x, key):
        self.line(x+24,1171,'Tradeoff')
        for i,text in enumerate({'A':['The modular shape can suggest code blocks.','Its document meaning needs the product context.'], 'B':['The shared detail becomes subtle at header size.','The long name needs horizontal space.'], 'C':['The stepped shoulder is more abstract.','The initial does not teach the library name.']}[key]):
            self.line(x+24,1199+i*24,text)
        if key=='C':
            self.label(x+24,1284,'Header wordmark is context, not a C lockup.',11)

    def column(self, x, key, title, icon, lockup):
        self.add(f'<rect x="{x}" y="122" width="464" height="1196" rx="16" fill="#ffffff"/>')
        self.label(x+24,161,f'{key} / {title}',24,weight=600)
        self.label(x+24,189,{'A':'Symbol + lowercase wordmark','B':'Wordmark only + small r','C':'Single r monogram'}[key],15)
        if key=='A':
            self.label(x+342,219,'RECOMMENDED',11,self.cobalt,600)
        if key=='B':
            self.place(lockup,x+25,252,width=414)
            self.place(icon,x+192,332,width=80)
        else:
            self.place(icon,x+144,222,width=176)
        self.line(x+24,438,{'A':'Two document corners frame a shared term.','B':'A t and i share one explicit crossbar.','C':'Offset result edges form a stepped r.'}[key])
        self.line(x+24,464,{'A':'The name stays readable beside the symbol.','B':'The shared bar repeats on the small r.','C':'One silhouette, without a separate symbol.'}[key])
        self.header_sample(x,icon,lockup)
        self.label(x+24,609,'FAVICON / ACTUAL PIXELS',12,weight=600)
        self.favicon_samples(x+24,632,719,icon)
        self.dark_samples(x,icon,lockup)
        self.color_sample(x,icon,lockup)
        self.tradeoffs(x,key)

    def write(self):
        self.add(f'<rect width="1600" height="1400" fill="{PAPER}"/>')
        self.label(48,56,'relatinator / three logo directions',30,weight=600)
        self.label(48,87,'Black first. Shared terms, related documents, no network hub.',16)
        self.label(1552,58,'CONCEPT CHECKPOINT',13,weight=600)
        # Right-aligned deck label without a dependency on text-anchor defaults.
        self.parts[-1]=self.parts[-1].replace('x="1552"','x="1552" text-anchor="end"')
        columns=[(48,'A','Shared tile','a-symbol','a-lockup'),(568,'B','Shared crossbar','b-favicon','b-wordmark'),(1088,'C','Ranked r','c-monogram',None)]
        for column in columns:
            self.column(*column)
        self.label(48,1364,f'Palette: ink {self.ink} / cobalt {self.cobalt}. Dark samples reverse ink to paper. Font: Space Grotesk 600, SIL OFL 1.1.',14)
        (OUT/'overview.svg').write_text(svg('relatinator logo concept overview',1600,1400,''.join(self.parts)))


def write_lettering_source():
    source = {'font_file': str(FONT), 'font_family': 'Space Grotesk', 'weight':600,
              'license':'SIL Open Font License 1.1', 'license_evidence':'Font name table entry 14: https://scripts.sil.org/OFL',
              'word':'relatinator', 'tracking_svg_units':.35, 'font_units_to_svg':.08,
              'custom_detail':'B replaces the i dot with a filled crossbar that meets the first t stem.',
              'c_header':'The companion wordmark appears only as site context in the overview.'}
    (OUT/'lettering-source.json').write_text(json.dumps(source,indent=2)+'\n')


def build_concepts():
    lettering = Lettering()
    palette = build_palette()
    (OUT/'palette.json').write_text(json.dumps(palette, indent=2)+'\n')
    normal_word, word_width = lettering.wordmark()
    shared_word, _ = lettering.wordmark(True)
    masters = build_masters(normal_word,shared_word,word_width)
    write_masters(masters,palette['ink']['hex'],palette['cobalt']['hex'])
    ConceptSheet(palette,normal_word,word_width).write()
    write_lettering_source()
    print(json.dumps({'palette':palette, 'masters':list(masters), 'overview':'overview.svg'},indent=2))


def main():
    if '--final' in sys.argv:
        runpy.run_path(str(OUT/'final'/'build_final.py'), run_name='__main__')
        return
    build_concepts()


if __name__ == '__main__':
    main()
