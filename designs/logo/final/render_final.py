"""Render and audit the final kit using the logo-design skill interpreter."""
from pathlib import Path
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from PIL import Image

sys.dont_write_bytecode=True
FINAL=Path(__file__).resolve().parent
ROOT=FINAL.parents[2]
PUBLIC=ROOT/'packages/site/public'
SKILL=Path('/home/darko/.claude/skills/logo-design')
sys.path.insert(0,str(SKILL/'scripts'))
import render_png
PAPER,GRAPHITE='#f8fafd','#161b22'

def render(source,target,width,height,bg=None):
    assert render_png.render(str(source),str(target),width,height,bg=bg,backend='cairosvg'),target
    assert render_png.png_size(target)==(width,height),target

def render_favicons():
    pngs=[]
    for size in (16,32,48):
        target=FINAL/f'favicon-{size}-light.png'
        render(PUBLIC/'favicon.svg',target,size,size)
        pngs.append(str(target))
    render_png.write_ico(pngs,str(PUBLIC/'favicon.ico'))
    with Image.open(PUBLIC/'favicon.ico') as ico:
        assert ico.ico.sizes()=={(16,16),(32,32),(48,48)},ico.ico.sizes()
    # Browser screenshots separately check real color-scheme media handling.
    for size in (16,32):
        render(PUBLIC/'favicon.svg',FINAL/f'favicon-{size}-light-ground.png',size,size,PAPER)


def validate_svg(file):
    root=ET.fromstring(file.read_text())
    for element in root.iter():
        assert element.tag.rsplit('}',1)[-1] not in {'script','foreignObject','image'},file
        for key,value in element.attrib.items():
            assert not key.lower().startswith('on'),file
            assert key.rsplit('}',1)[-1] != 'href',file
            assert 'url(' not in value,file


def audit_svgs(files):
    audit=[]
    for file in files:
        bg=GRAPHITE if 'reversed' in file.name else PAPER
        result=subprocess.run([sys.executable,str(SKILL/'scripts/svg_audit.py'),str(file),'--json','--bg',bg],check=True,capture_output=True,text=True)
        findings=json.loads(result.stdout)
        for item in findings:
            item['file']=str(file.relative_to(ROOT))
        audit.extend(findings)
    (FINAL/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    return [{'file':item['file'],'score':item['score'],'findings':item['findings']} for item in audit]


def write_render_report(summary):
    (FINAL/'render-checks.json').write_text(json.dumps({
        'renderer':'CairoSVG through skill render_png.py',
        'og_dimensions':[1200,630],'touch_dimensions':[180,180],
        'ico_images':[[16,16],[32,32],[48,48]],
        'favicon_light_sizes':[16,32,48],'sheet_dimensions':[1440,1380],
        'svg_active_content_check':'No scripts, raster images, external references, event handlers, or foreignObject.',
        'audit':summary},indent=2)+'\n')
    for item in summary:
        print(item['file'],item['score'],[(f['level'],f['code']) for f in item['findings']])
    print('Rendered sheet, OG, touch icon, and ICO. Actual dark-mode SVG screenshots use the browser check.')


def main():
    render(FINAL/'og.svg',PUBLIC/'og.png',1200,630)
    render(FINAL/'apple-touch-icon.svg',PUBLIC/'apple-touch-icon.png',180,180)
    render(FINAL/'sheet.svg',FINAL/'sheet.png',1440,1380)
    render_favicons()
    files=sorted(FINAL.glob('*.svg'))+[PUBLIC/'favicon.svg',PUBLIC/'logo.svg',PUBLIC/'logo-stacked.svg',ROOT/'logo.svg']
    for file in files:
        validate_svg(file)
    write_render_report(audit_svgs(files))


if __name__ == '__main__':
    main()
